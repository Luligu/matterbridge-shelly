/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { AnsiLogger, BLUE, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, nf, rs, wr, zb } from 'node-ansi-logger';
import coap, { Server, IncomingMessage, OutgoingMessage } from 'coap';
import dgram from 'dgram';
import os from 'os';

const COIOT_OPTION_GLOBAL_DEVID = '3332';
const COIOT_OPTION_STATUS_VALIDITY = '3412';
const COIOT_OPTION_STATUS_SERIAL = '3420';

const COAP_MULTICAST_ADDRESS = '224.0.1.187';

export interface CoapMessage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any;
  host: string;
  deviceType: string;
  deviceId: string;
  protocolRevision: string;
  validFor: number;
  serial: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export class CoapServer {
  private log;
  private coapAgent;
  private coapServer: Server | undefined;
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;

  private callback?: (msg: CoapMessage) => void;

  constructor() {
    this.log = new AnsiLogger({ logName: 'coapServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

    this.registerShellyOptions();

    this.coapAgent = new coap.Agent();
    this.coapAgent._nextToken = () => Buffer.alloc(0);
  }

  get isScanning() {
    return this._isScanning;
  }

  getDeviceDescription(host: string) {
    this.log.debug(`Requesting device description from ${host}...`);
    const response = coap
      .request({
        host,
        method: 'GET',
        pathname: '/cit/d',
        agent: this.coapAgent,
      })
      .on('response', (msg: IncomingMessage) => {
        this.log.debug(`Coap got device description ("/cit/d") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
        this.parseShellyMessage(msg);
      })
      .on('error', (err) => {
        this.log.error('Coap error getting device description ("/cit/d"):', err);
      })
      .end();
  }

  getDeviceStatus(host: string) {
    this.log.debug(`Requesting device status from ${host}...`);
    const response = coap
      .request({
        host,
        method: 'GET',
        pathname: '/cit/s',
        agent: this.coapAgent,
      })
      .on('response', (msg: IncomingMessage) => {
        this.log.debug(`Coap got device status ("/cit/s") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
        this.parseShellyMessage(msg);
      })
      .on('error', (err) => {
        this.log.error('Coap error getting device status ("/cit/s"):', err);
      })
      .end();
  }

  getMulticastDeviceStatus() {
    this.log.debug('Requesting multicast device status...');
    const response = coap
      .request({
        host: COAP_MULTICAST_ADDRESS,
        method: 'GET',
        pathname: '/cit/s',
        agent: this.coapAgent,
        multicast: true,
        multicastTimeout: 60 * 1000,
      })
      .on('response', (msg: IncomingMessage) => {
        this.log.debug(`Multicast device status code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
        this.parseShellyMessage(msg);
      })
      .on('error', (err) => {
        this.log.error('Coap error requesting multicast device status ("/cit/s"):', err);
      })
      .end();
  }

  private registerShellyOptions() {
    coap.registerOption(
      COIOT_OPTION_GLOBAL_DEVID,
      (str) => {
        this.log.debug('GLOBAL_DEVID str', str);
        // Ensure that 'str' is a string
        if (typeof str === 'string' || (str && typeof str.toString === 'function')) {
          return Buffer.from(str.toString());
        }
        // Handle null or incompatible types explicitly
        throw new TypeError('Expected a string for GLOBAL_DEVID');
      },
      (buf) => buf.toString(),
    );

    coap.registerOption(
      COIOT_OPTION_STATUS_VALIDITY,
      (str) => {
        this.log.debug('STATUS_VALIDITY str', str);
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16BE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_VALIDITY');
      },
      (buf) => buf.readUInt16BE(0),
    );

    coap.registerOption(
      COIOT_OPTION_STATUS_SERIAL,
      (str) => {
        this.log.debug('STATUS_SERIAL str', str);
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16BE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_SERIAL');
      },
      (buf) => buf.readUInt16BE(0),
    );
  }

  parseShellyMessage(msg: IncomingMessage) {
    this.log.debug(`Parsing device Coap response...`);

    const host = msg.rsinfo.address;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = msg.headers as any;

    let deviceType = '';
    let deviceId = '';
    let protocolRevision = '';
    let validFor = 0;
    let serial = 0;
    let payload;

    if (headers[COIOT_OPTION_GLOBAL_DEVID]) {
      const parts = headers[COIOT_OPTION_GLOBAL_DEVID].split('#');
      deviceType = parts[0];
      deviceId = parts[1];
      protocolRevision = parts[2];
    }

    if (headers[COIOT_OPTION_STATUS_VALIDITY]) {
      const validity = headers[COIOT_OPTION_STATUS_VALIDITY];
      if ((validity & 0x1) === 0) {
        validFor = Math.floor(validity / 10);
      } else {
        validFor = validity * 4;
      }
    }

    if (headers[COIOT_OPTION_STATUS_SERIAL]) {
      serial = headers[COIOT_OPTION_STATUS_SERIAL];
    }

    try {
      payload = JSON.parse(msg.payload.toString());
    } catch (e) {
      payload = msg.payload.toString();
    }

    this.log.debug('host', host);
    this.log.debug('deviceType', deviceType);
    this.log.debug('deviceId', deviceId);
    this.log.debug('protocolRevision', protocolRevision);
    this.log.debug('validFor', validFor);
    this.log.debug('serial', serial);
    this.log.debug('payload', payload);

    return { msg, host, deviceType, deviceId, protocolRevision, validFor, serial, payload };
  }

  listenForStatusUpdates(networkInterface?: string) {
    this.coapServer = coap.createServer({
      multicastAddress: COAP_MULTICAST_ADDRESS,
    });

    /*
    // 192.168.1.189:5683
    // insert our own middleware right before requests are handled (the last step)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.coapServer._middlewares.splice(Math.max(this.coapServer._middlewares.length - 1, 0), 0, (req: any, next: any) => {
      this.log.warn(`Server middleware got a messagge code ${req.packet.code} rsinfo ${debugStringify(req.rsinfo)}...`);
      // Unicast messages from Shelly devices will have the 2.05 code, which the
      // server will silently drop (since its a response code and not a request
      // code). To avoid this, we change it to 0.30 here.
      if (req.packet.code === '2.05') {
        req.packet.code = '0.30';
      }
      next();
    });
    */

    this.coapServer.on('request', (msg: IncomingMessage, res: OutgoingMessage) => {
      this.log.debug(`Coap server got a messagge code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}...`);
      if (msg.code === '0.30' && msg.url === '/cit/s') {
        const coapMessage = this.parseShellyMessage(msg);
        this.callback && this.callback(coapMessage);
      } else {
        console.log(msg);
      }
    });

    this.coapServer.listen((err) => {
      if (err) {
        this.log.warn('Coap server error while listening:', err);
      } else {
        this.log.info('Coap server is listening ...');
      }
    });
  }

  startDgramServer() {
    this.log.info('Starting CoIoT multicast receiver...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const PORT = 5683;
    const INTERFACE = getInterfaceAddress();

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.error(`Socket error:\n${err.stack}`);
      socket.close();
    });

    socket.on('message', (msg, rinfo) => {
      console.log(`Message received from ${rinfo.address}:${rinfo.port}`);
      console.log(`Message: ${msg}`);
    });

    socket.on('listening', () => {
      const address = socket.address();
      console.log(`Socket listening on ${address.address}:${address.port}`);
      socket.addMembership(MULTICAST_ADDRESS, INTERFACE);
    });

    socket.bind(PORT, INTERFACE, () => {
      socket.setBroadcast(true);
      socket.setMulticastTTL(128);
      console.log(`Joined multicast group: ${MULTICAST_ADDRESS}`);
    });
  }

  startDgramSender() {
    this.log.info('Starting CoIoT multicast sender...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const PORT = 5683;
    const INTERFACE = getInterfaceAddress();

    const message = Buffer.from('Test multicast message');

    const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    client.bind(() => {
      client.setBroadcast(true);
      client.setMulticastTTL(128);
      client.addMembership(MULTICAST_ADDRESS, INTERFACE);
      setInterval(() => {
        client.send(message, 0, message.length, PORT, MULTICAST_ADDRESS, (err) => {
          if (err) {
            console.error(`Failed to send message: ${err.stack}`);
          } else {
            console.log(`Message sent to ${MULTICAST_ADDRESS}:${PORT}`);
          }
        });
      }, 2000); // Send message every 2 seconds
    });
  }

  start(callback?: (msg: CoapMessage) => void, debug = false) {
    this.log.setLogDebug(debug);
    this.log.info('Starting CoIoT server for shelly devices...');
    this._isScanning = true;
    this.callback = callback;
    // this.getDeviceDescription('192.168.1.219');
    // this.getDeviceStatus('192.168.1.219');
    // this.getMulticastDeviceStatus();
    this.listenForStatusUpdates();
    // if (process.argv.includes('receiver')) this.startDgramServer();
    // if (process.argv.includes('sender')) this.startDgramSender();

    this.log.info('Started CoIoT server for shelly devices.');
  }

  stop() {
    this.log.info('Stopping CoIoT server for shelly devices...');
    if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
    this._isScanning = false;
    this.scannerTimeout = undefined;
    if (this.coapServer) this.coapServer.close();
    this.log.info('Stopped CoIoT server for shelly devices.');
  }
}

export function getInterfaceAddress() {
  let INTERFACE = 'Not found';
  const networkInterfaces = os.networkInterfaces();
  // console.log('Available Network Interfaces:', networkInterfaces);
  for (const interfaceDetails of Object.values(networkInterfaces)) {
    if (!interfaceDetails) {
      break;
    }
    for (const detail of interfaceDetails) {
      if (detail.family === 'IPv4' && !detail.internal && INTERFACE === 'Not found') {
        INTERFACE = detail.address;
      }
    }
    // Break if both addresses are found to improve efficiency
    if (INTERFACE !== 'Not found') {
      break;
    }
  }
  console.log('Selected Network Interfaces:', INTERFACE);
  return INTERFACE;
}

if (
  process.argv.includes('coapServer') ||
  process.argv.includes('coapSender') ||
  process.argv.includes('coapReceiver') ||
  process.argv.includes('coapDescription') ||
  process.argv.includes('coapStatus')
) {
  const coapServer = new CoapServer();

  if (process.argv.includes('coapReceiver')) coapServer.startDgramServer();

  if (process.argv.includes('coapSender')) coapServer.startDgramSender();

  if (process.argv.includes('coapServer') || process.argv.includes('coapDescription') || process.argv.includes('coapStatus')) coapServer.start(undefined, true);

  if (process.argv.includes('coapDescription')) coapServer.getDeviceDescription('192.168.1.219');

  if (process.argv.includes('coapStatus')) coapServer.getDeviceStatus('192.168.1.219');

  process.on('SIGINT', async function () {
    coapServer.stop();
    process.exit();
  });
}
