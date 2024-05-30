import EventEmitter from 'events';
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, CYAN, MAGENTA, BRIGHT, hk, db, TimestampFormat, nf, wr, zb } from 'node-ansi-logger';
import { DiscoveredDevice, MdnsScanner } from './mdnsScanner.js';
import { CoapMessage, CoapServer } from './coapServer.js';

export class Shelly extends EventEmitter {
  private readonly _devices = new Map<string, ShellyDevice>();
  private readonly log: AnsiLogger;
  private mdnsScanner: MdnsScanner | undefined;
  private coapServer: CoapServer | undefined;
  private coapServerTimeout?: NodeJS.Timeout;

  constructor(log: AnsiLogger) {
    super();
    this.log = log;
    this.mdnsScanner = new MdnsScanner();
    this.coapServer = new CoapServer();

    this.mdnsScanner.on('discovered', async (device: DiscoveredDevice) => {
      this.log.info(`Discovered shelly gen ${CYAN}${device.gen}${nf} device id ${hk}${device.id}${nf} host ${zb}${device.host}${nf} port ${zb}${device.port}${nf} `);
      this.emit('discovered', device);
    });

    this.coapServer.on('update', async (msg: CoapMessage) => {
      this.log.info(`CoIoT update from device ${hk}${msg.deviceId}${nf} host ${zb}${msg.host}${nf}` /* , msg.payload*/);
      /*
      const shellyDevice = this.getDevice(device.id);
      if (shellyDevice) {
        shellyDevice.update(device);
      }
      */
    });
  }

  destroy() {
    if (this.coapServerTimeout) clearTimeout(this.coapServerTimeout);
    this.coapServerTimeout = undefined;
    this.devices.forEach((device) => {
      device.destroy();
      this.removeDevice(device);
    });
    this.removeAllListeners();
    this.mdnsScanner?.removeAllListeners();
    this.mdnsScanner?.stop();
    this.mdnsScanner = undefined;
    this.coapServer?.removeAllListeners();
    this.coapServer?.stop();
    this.coapServer = undefined;
  }

  hasDevice(id: string): boolean {
    return this._devices.has(id);
  }

  hasDeviceHost(host: string): boolean {
    const devices = this.devices.filter((device) => device.host === host);
    return devices.length > 0;
  }

  getDevice(id: string): ShellyDevice | undefined {
    return this._devices.get(id);
  }

  async addDevice(device: ShellyDevice): Promise<Shelly> {
    if (this.hasDevice(device.id)) {
      this.log.warn(`Shelly device ${hk}${device.id}${wr}: name ${CYAN}${device.name}${wr} ip ${MAGENTA}${device.host}${wr} model ${CYAN}${device.model}${wr} already exists`);
      return this;
    }
    this._devices.set(device.id, device);
    if (device.gen === 1) {
      await this.coapServer?.registerDevice(device.host);
      this.startCoap(60, false);
    }
    this.emit('add', device);
    return this;
  }

  removeDevice(device: ShellyDevice): Shelly;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  removeDevice(deviceId: string): Shelly;
  removeDevice(deviceOrId: ShellyDevice | string): Shelly {
    const id = typeof deviceOrId === 'string' ? deviceOrId : deviceOrId.id;
    this._devices.delete(id);
    return this;
  }

  get devices(): ShellyDevice[] {
    return Array.from(this._devices.values());
  }

  *[Symbol.iterator](): IterableIterator<[string, ShellyDevice]> {
    for (const [id, device] of this._devices.entries()) {
      yield [id, device];
    }
  }

  startMdns(mdnsTimeout?: number, debug = false) {
    this.mdnsScanner?.start(mdnsTimeout, debug);
  }

  startCoap(coapTimeout?: number, debug = false) {
    if (coapTimeout) {
      this.coapServerTimeout = setTimeout(() => {
        this.coapServer?.start(debug);
      }, coapTimeout * 1000);
    } else {
      this.coapServer?.start(debug);
    }
  }

  logDevices() {
    this.log.debug(`${BRIGHT}Shellies${db} (${this.devices.length}):`);
    for (const [id, device] of this) {
      this.log.debug(`- ${hk}${id}${db}: name ${CYAN}${device.name}${db} ip ${MAGENTA}${device.host}${db} model ${CYAN}${device.model}${db} auth ${CYAN}${device.auth}${db}`);
    }
  }
}

if (process.argv.includes('shelly')) {
  const debug = false;
  const log = new AnsiLogger({ logName: 'Shellies', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });
  const shelly = new Shelly(log);
  shelly.startMdns(undefined, false);

  shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
    const log = new AnsiLogger({ logName: discoveredDevice.id, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });
    const device = await ShellyDevice.create(shelly, log, discoveredDevice.host);
    if (!device) return;
    await shelly.addDevice(device);
  });

  process.on('SIGINT', async function () {
    shelly.logDevices();
    shelly.destroy();
    // process.exit();
  });
}
