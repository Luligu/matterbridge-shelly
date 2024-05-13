/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { AnsiLogger, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, nf, rs, wr, zb } from 'node-ansi-logger';

import coap, { Server, IncomingMessage, OutgoingMessage } from 'coap';

const COIOT_OPTION_GLOBAL_DEVID = '3332';
const COIOT_OPTION_STATUS_VALIDITY = '3412';
const COIOT_OPTION_STATUS_SERIAL = '3420';

const COAP_MULTICAST_ADDRESS = '224.0.1.187';

export class CoapScanner {
  private discoveredPeripherals = new Map<string, { id: string; host: string; gen: number }>();
  private log;
  private coapAgent;
  private coapServer: Server | undefined;
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;

  private callback?: (id: string, host: string, gen: number) => void;

  constructor() {
    this.log = new AnsiLogger({ logName: 'mdnsShellyDiscover', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

    this.registerShellyOptions();

    this.coapAgent = new coap.Agent();
    this.coapAgent._nextToken = () => Buffer.alloc(0);
  }

  get isScanning() {
    return this._isScanning;
  }

  getDeviceDescription(host: string) {
    this.log.warn(`Getting device description from ${host}...`);
    const response = coap
      .request({
        host,
        method: 'GET',
        pathname: '/cit/d',
        agent: this.coapAgent,
      })
      .on('response', (res) => {
        this.log.warn(`Parsing device description response from ${host}...`);
        this.parseShellyMessage(res);
      })
      .on('error', (err) => {
        console.log('error', err);
      })
      .end();
    //console.log('response', response);
  }

  getDeviceStatus(host: string) {
    this.log.warn(`Getting device status from ${host}...`);
    const response = coap
      .request({
        host,
        method: 'GET',
        pathname: '/cit/s',
        agent: this.coapAgent,
      })
      .on('response', (res) => {
        this.log.warn(`Parsing device status response from ${host}...`);
        this.parseShellyMessage(res);
      })
      .on('error', (err) => {
        console.log('error', err);
      })
      .end();
    //console.log('response', response);
  }

  private registerShellyOptions() {
    coap.registerOption(
      COIOT_OPTION_GLOBAL_DEVID,
      (str) => {
        console.log('GLOBAL_DEVID str', str);
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
        console.log('STATUS_VALIDITY str', str);
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
        console.log('STATUS_SERIAL str', str);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseShellyMessage(msg: any) {
    const host = msg.rsinfo.address;
    const headers = msg.headers;

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
    console.log('host', host);
    console.log('deviceType', deviceType);
    console.log('deviceId', deviceId);
    console.log('protocolRevision', protocolRevision);
    console.log('validFor', validFor);
    console.log('serial', serial);
    console.log('payload', payload);
  }

  listenForStatusUpdates(networkInterface: string) {
    this.coapServer = coap.createServer({
      multicastAddress: COAP_MULTICAST_ADDRESS,
      multicastInterface: '192.168.1.213',
    });

    // insert our own middleware right before requests are handled (the last step)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.coapServer._middlewares.splice(Math.max(this.coapServer._middlewares.length - 1, 0), 0, (req: any, next: any) => {
      this.log.warn('Server middleware got a messagge ...', req, req.packet.options);
      // Unicast messages from Shelly devices will have the 2.05 code, which the
      // server will silently drop (since its a response code and not a request
      // code). To avoid this, we change it to 0.30 here.
      if (req.packet.code === '2.05') {
        req.packet.code = '0.30';
      }
      next();
    });

    this.coapServer.on('request', (msg: IncomingMessage, res: OutgoingMessage) => {
      this.log.warn('Server got a messagge ...', msg, msg.payload.toString());
      if (msg.code === '0.30' && msg.url === '/cit/s') {
        this.log.warn('Parsing device status update ...');
        this.parseShellyMessage(msg);
      }
    });

    this.coapServer.listen((err) => {
      if (err) {
        this.log.warn('Error while listening ...', err);
      } else {
        this.log.warn('Server is listening ...');
      }
    });
  }

  start(callback?: (id: string, host: string, gen: number) => void, timeout?: number) {
    this.log.info('Starting mDNS query service for shelly devices...');
    this._isScanning = true;
    this.callback = callback;
    if (timeout && timeout > 0) {
      this.scannerTimeout = setTimeout(() => {
        this.stop();
      }, timeout * 1000);
    }
    this.getDeviceDescription('192.168.1.219');
    this.getDeviceStatus('192.168.1.219');
    this.listenForStatusUpdates('');

    /*
    coap
      .request({
        host: COAP_MULTICAST_ADDRESS,
        // method: 'GET',
        pathname: '/cit/s',
        multicast: true,
        multicastTimeout: 60 * 1000,
        agent: this.coapAgent,
      })
      .on('response', (res) => {
        // console.log('Multicast response:', res);
        this.log.warn(`Parsing device status response from ${COAP_MULTICAST_ADDRESS}...`);
        this.parseShellyMessage(res);
      })
      .on('error', (err) => {
        console.log('error', err);
      })
      .end();
    */
    this.log.info('Started mDNS query service for shelly devices.');
  }

  stop() {
    this.log.info('Stopping mDNS query service...');
    if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
    this._isScanning = false;
    this.scannerTimeout = undefined;
    if (this.coapServer) this.coapServer.close();
    this.logPeripheral();
    this.log.info('Stopped mDNS query service.');
  }

  logPeripheral() {
    this.log.info(`Discovered ${this.discoveredPeripherals.size} shelly devices:`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [name, { id, host, gen }] of this.discoveredPeripherals) {
      this.log.info(`- id: ${hk}${name}${nf} host: ${zb}${host}${nf} gen: ${CYAN}${gen}${nf}`);
    }
  }
}

const coapScanner = new CoapScanner();
coapScanner.start();

process.on('SIGINT', async function () {
  coapScanner.stop();
  coapScanner.logPeripheral();
  process.exit();
});
