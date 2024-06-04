import EventEmitter from 'events';
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, CYAN, MAGENTA, BRIGHT, hk, db, TimestampFormat, nf, wr, zb } from 'node-ansi-logger';
import { DiscoveredDevice, MdnsScanner } from './mdnsScanner.js';
import { CoapServer } from './coapServer.js';
import { logInterfaces } from 'matterbridge';

export class Shelly extends EventEmitter {
  private readonly _devices = new Map<string, ShellyDevice>();
  private readonly log: AnsiLogger;
  private mdnsScanner: MdnsScanner | undefined;
  private coapServer: CoapServer | undefined;
  private coapServerTimeout?: NodeJS.Timeout;
  private username?: string;
  private password?: string;

  constructor(log: AnsiLogger, username?: string, password?: string) {
    super();
    this.log = log;
    this.username = username;
    this.password = password;
    this.mdnsScanner = new MdnsScanner();
    this.coapServer = new CoapServer();

    this.mdnsScanner.on('discovered', async (device: DiscoveredDevice) => {
      this.log.info(`Discovered shelly gen ${CYAN}${device.gen}${nf} device id ${hk}${device.id}${nf} host ${zb}${device.host}${nf} port ${zb}${device.port}${nf} `);
      this.emit('discovered', device);
    });

    this.coapServer.on('update', async (host: string, component: string, property: string, value: string | number | boolean) => {
      const shellyDevice = this.getDeviceByHost(host);
      if (shellyDevice) {
        shellyDevice.log.info(
          `CoIoT update from device id ${hk}${shellyDevice.id}${nf} host ${zb}${host}${nf} component ${CYAN}${component}${nf} property ${CYAN}${property}${nf} value ${CYAN}${value}${nf}`,
        );
        shellyDevice.getComponent(component)?.setValue(property, value);
        shellyDevice.lastseen = Date.now();
      }
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

  getDeviceByHost(host: string): ShellyDevice | undefined {
    const devices = this.devices.filter((device) => device.host === host);
    if (devices.length === 0) return undefined;
    return this._devices.get(devices[0].id);
  }

  async addDevice(device: ShellyDevice): Promise<Shelly> {
    if (this.hasDevice(device.id)) {
      this.log.warn(`Shelly device ${hk}${device.id}${wr}: name ${CYAN}${device.name}${wr} ip ${MAGENTA}${device.host}${wr} model ${CYAN}${device.model}${wr} already exists`);
      return this;
    }
    this._devices.set(device.id, device);
    if (device.gen === 1) {
      await this.coapServer?.registerDevice(device.host);
      this.startCoap(10, false);
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

  startMdns(mdnsShutdownTimeout?: number, debug = false) {
    this.mdnsScanner?.start(mdnsShutdownTimeout, debug);
  }

  startCoap(coapStartTimeout?: number, debug = false) {
    if (coapStartTimeout) {
      this.coapServerTimeout = setTimeout(() => {
        this.coapServer?.start(debug);
      }, coapStartTimeout * 1000);
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
  logInterfaces();
  const debug = false;
  const log = new AnsiLogger({ logName: 'Shellies', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });
  const shelly = new Shelly(log);
  shelly.startMdns(300, false);

  shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
    const log = new AnsiLogger({ logName: discoveredDevice.id, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });
    const device = await ShellyDevice.create(shelly, log, discoveredDevice.host);
    if (!device) return;
    await shelly.addDevice(device);
  });

  shelly.on('add', async (device: ShellyDevice) => {
    log.info(
      `Added shelly device ${hk}${device.id}${nf}: name ${CYAN}${device.name}${nf} ip ${MAGENTA}${device.host}${nf} model ${CYAN}${device.model}${nf} auth ${CYAN}${device.auth}${nf}`,
    );
  });

  process.on('SIGINT', async function () {
    shelly.logDevices();
    shelly.destroy();
    // process.exit();
  });
}
