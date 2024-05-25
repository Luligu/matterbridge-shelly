/* eslint-disable @typescript-eslint/no-unused-vars */

import { AnsiLogger, BLUE, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, idn, nf, rs, wr, zb } from 'node-ansi-logger';
import { getIpv4InterfaceAddress } from './utils.js';
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
  private _isListening = false;

  private callback?: (msg: CoapMessage) => void;

  constructor() {
    this.log = new AnsiLogger({ logName: 'coapServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

    this.registerShellyOptions();

    this.coapAgent = new coap.Agent();
    // this.coapAgent._nextToken = () => Buffer.alloc(0);
  }

  get isListening() {
    return this._isListening;
  }

  getDeviceDescription(host: string): Promise<IncomingMessage> {
    this.log.debug(`Requesting device description from ${host}...`);
    return new Promise((resolve, reject) => {
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
          // msg.pipe(process.stdout); // Ensure the message stream is consumed.
          resolve(msg);
        })
        .on('error', (err) => {
          this.log.error('Coap error getting device description ("/cit/d"):', err);
          reject(err);
        })
        .end();
    });
  }

  getDeviceStatus(host: string): Promise<IncomingMessage> {
    this.log.debug(`Requesting device status from ${host}...`);
    return new Promise((resolve, reject) => {
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
          resolve(msg);
        })
        .on('error', (err) => {
          this.log.error('Coap error getting device status ("/cit/s"):', err);
          reject(err);
        })
        .end();
    });
  }

  getMulticastDeviceStatus(timeout = 60): Promise<IncomingMessage | null> {
    this.log.debug('Requesting multicast device status...');
    return new Promise((resolve, reject) => {
      const request = coap
        .request({
          host: COAP_MULTICAST_ADDRESS,
          method: 'GET',
          pathname: '/cit/s',
          agent: this.coapAgent,
          multicast: true,
          multicastTimeout: timeout * 1000,
        })
        .on('response', (msg: IncomingMessage) => {
          clearTimeout(timer);
          this.log.debug(`Multicast device status code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('error', (err) => {
          clearTimeout(timer);
          this.log.error('Coap error requesting multicast device status ("/cit/s"):', err);
          reject(err);
        })
        .end();

      const timer = setTimeout(
        () => {
          this.log.debug('Multicast request timeout reached');
          // console.log(request);
          request.sender.removeAllListeners();
          request.sender.reset();
          // reject(new Error('Multicast request timeout reached'));
          resolve(null);
        },
        (timeout + 5) * 1000,
      );
    });
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

    this.log.debug(`host: ${idn}${host}${rs}${db}`);
    this.log.debug(`deviceType: ${BLUE}${deviceType}${db}`);
    this.log.debug(`deviceId: ${BLUE}${deviceId}${db}`);
    this.log.debug(`protocolRevision: ${protocolRevision}${db}`);
    this.log.debug(`validFor: ${validFor}`);
    this.log.debug(`serial: ${serial}`);
    this.log.debug(`payload: `, payload);

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
        this.log.warn(`Coap server got a wrong messagge code ${BLUE}${msg.code}${wr} url ${BLUE}${msg.url}${wr} rsinfo ${db}${debugStringify(msg.rsinfo)}...`);
        // console.log(msg);
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

  start(callback?: (msg: CoapMessage) => void, debug = false) {
    this.log.setLogDebug(debug);
    this.log.info('Starting CoIoT server for shelly devices...');
    this._isListening = true;
    this.callback = callback;
    // this.getDeviceDescription('192.168.1.219');
    // this.getDeviceStatus('192.168.1.219');
    // this.getMulticastDeviceStatus();
    this.listenForStatusUpdates();

    this.log.info('Started CoIoT server for shelly devices.');
  }

  stop() {
    this.log.info('Stopping CoIoT server for shelly devices...');
    this._isListening = false;
    this.coapAgent.close();
    if (this.coapServer) this.coapServer.close();
    this.log.info('Stopped CoIoT server for shelly devices.');
  }
}

if (process.argv.includes('coapServer') || process.argv.includes('coapDescription') || process.argv.includes('coapStatus') || process.argv.includes('coapMcast')) {
  const coapServer = new CoapServer();

  if (process.argv.includes('coapServer')) coapServer.start(undefined, true);

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.219');

  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.219');

  if (process.argv.includes('coapMcast')) {
    await coapServer.getMulticastDeviceStatus(30);
    coapServer.stop();
  }

  process.on('SIGINT', async function () {
    coapServer.stop();
    // process.exit();
  });
}
