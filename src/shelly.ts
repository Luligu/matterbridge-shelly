import EventEmitter from 'events';
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, CYAN, MAGENTA, BRIGHT, hk, db, BLUE, TimestampFormat } from 'node-ansi-logger';
import { DiscoveredDevice, MdnsScanner } from './mdnsScanner.js';

export class Shelly extends EventEmitter {
  private readonly _devices = new Map<string, ShellyDevice>();
  private readonly log: AnsiLogger;
  private readonly mdnsScanner: MdnsScanner;

  constructor(log: AnsiLogger) {
    super();
    this.log = log;
    this.mdnsScanner = new MdnsScanner();

    this.mdnsScanner.on('discovered', async (device: DiscoveredDevice) => {
      this.log.debug(`Discovered shelly device: ${hk}${device.id}${db} at ${MAGENTA}${device.host}${db} port ${MAGENTA}${device.port}${db} gen ${BLUE}${device.gen}${db}`);
      this.emit('discovered', device);
    });
  }

  destroy() {
    this.mdnsScanner.removeAllListeners();
    this.mdnsScanner.stop();
    this.removeAllListeners();
  }

  hasDevice(id: string): boolean {
    return this._devices.has(id);
  }

  getDevice(id: string): ShellyDevice | undefined {
    return this._devices.get(id);
  }

  addDevice(device: ShellyDevice): Shelly {
    this._devices.set(device.id, device);
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

  discover(mdnsTimeout?: number, mdnsDebug = false) {
    this.mdnsScanner.start(undefined, mdnsTimeout, mdnsDebug);
  }

  logDevices() {
    this.log.debug(`${BRIGHT}Shellies${db} (${this.devices.length}):`);
    for (const [id, device] of this) {
      this.log.debug(`- ${hk}${id}${db}: name ${CYAN}${device.name}${db} ip ${MAGENTA}${device.host}${db} model ${CYAN}${device.model}${db} auth ${CYAN}${device.auth}${db}`);
    }
  }
}

if (process.argv.includes('shelly')) {
  const log = new AnsiLogger({ logName: 'Shellies', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  const shelly = new Shelly(log);
  shelly.discover(undefined, true);

  process.on('SIGINT', async function () {
    shelly.destroy();
    // process.exit();
  });
}
