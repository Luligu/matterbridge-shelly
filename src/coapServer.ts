import { AnsiLogger, BLUE, CYAN, MAGENTA, RESET, TimestampFormat, db, debugStringify, idn, rs, wr } from 'node-ansi-logger';
import coap, { Server, IncomingMessage, OutgoingMessage } from 'coap';
import EventEmitter from 'events';

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

interface CoIoTBlkComponent {
  I: number;
  D: string;
}

interface CoIoTSenProperty {
  I: number;
  T: string;
  D: string;
  U: string;
  R: string | string[];
  L: number;
}

interface CoIoTGValue {
  channel: number;
  id: number;
  value: number | string;
}

interface CoIoTDescription {
  id: number;
  component: string;
  property: string;
}

export class CoapServer extends EventEmitter {
  private log;
  private coapAgent;
  private coapServer: Server | undefined;
  private _isListening = false;
  private readonly devices = new Map<string, CoIoTDescription[]>();

  private callback?: (msg: CoapMessage) => void;

  constructor() {
    super();
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const response = coap
        .request({
          host,
          method: 'GET',
          pathname: '/cit/d',
          agent: this.coapAgent,
        })
        .on('response', (msg: IncomingMessage) => {
          this.log.debug(`Coap got device description ("/cit/d") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          msg.url = '/cit/d';
          this.parseShellyMessage(msg);
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          request.sender.removeAllListeners();
          request.sender.reset();
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

  private parseShellyMessage(msg: IncomingMessage) {
    this.log.debug(`Parsing device Coap response...`);

    const host = msg.rsinfo.address;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = msg.headers as any;

    const code = msg.code;
    const url = msg.url;
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

    this.log.debug(`url:  ${BLUE}${url}${db}`);
    this.log.debug(`code: ${BLUE}${code}${db}`);
    this.log.debug(`host: ${idn}${host}${rs}${db}`);
    this.log.debug(`deviceType: ${BLUE}${deviceType}${db}`);
    this.log.debug(`deviceId: ${BLUE}${deviceId}${db}`);
    this.log.debug(`protocolRevision: ${protocolRevision}${db}`);
    this.log.debug(`validFor: ${validFor}`);
    this.log.debug(`serial: ${serial}`);
    this.log.debug(`payload:${RESET}`, payload);

    if (msg.url === '/cit/d') {
      const desc: CoIoTDescription[] = [];
      this.log.debug(`parsing ${MAGENTA}blocks${db}:`);
      const blk: CoIoTBlkComponent[] = payload.blk;
      blk.forEach((b) => {
        this.log.debug(`- block: ${CYAN}${b.I}${db} description ${CYAN}${b.D}${db}`);
        const sen: CoIoTSenProperty[] = payload.sen;
        sen
          .filter((s) => s.L === b.I)
          .forEach((s) => {
            this.log.debug(
              `  - id: ${CYAN}${s.I}${db} type ${CYAN}${s.T}${db} description ${CYAN}${s.D}${db} unit ${CYAN}${s.U}${db} range ${CYAN}${s.R}${db} block ${CYAN}${s.L}${db}`,
            );
            if (s.D === 'output') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'ison' });
            if (s.D === 'brightness') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'brightness' });
          });
      });
      this.log.debug(`parsing ${MAGENTA}decoding${db}:`);
      desc.forEach((d) => {
        this.log.debug(`- id ${CYAN}${d.id}${db} component ${CYAN}${d.component}${db} property ${CYAN}${d.property}${db}`);
      });
      this.devices.set(host, desc);
    }

    if (msg.url === '/cit/s') {
      const descriptions: CoIoTDescription[] = this.devices.get(host) || [];
      if (!descriptions || descriptions.length === 0) this.log.warn(`No description found for host ${host}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: CoIoTGValue[] = payload.G.map((v: any[]) => ({
        channel: v[0],
        id: v[1],
        value: v[2],
      }));
      this.log.debug(`parsing ${MAGENTA}values${db} (${values.length}):`);
      values.forEach((v) => {
        const desc = descriptions.find((d) => d.id === v.id);
        if (desc) {
          this.log.debug(`- channel ${CYAN}${v.channel}${db} id ${CYAN}${v.id}${db} value ${CYAN}${v.value}${db} => ${CYAN}${desc.component}${db} ${CYAN}${desc.property}${db}`);
        }
        // else this.log.warn(`No description found for id ${v.id}`);
      });
    }

    return { msg, host, deviceType, deviceId, protocolRevision, validFor, serial, payload };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.219');

  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.219');

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.222');

  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.222');

  if (process.argv.includes('coapMcast')) {
    await coapServer.getMulticastDeviceStatus(30);
    coapServer.stop();
  }

  if (process.argv.includes('coapServer')) coapServer.start(undefined, true);

  process.on('SIGINT', async function () {
    coapServer.stop();
    // process.exit();
  });
}
