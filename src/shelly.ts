/**
 * This file contains the class Shelly.
 *
 * @file src\shelly.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 1.0.0
 *
 * Copyright 2024, 2025 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { AnsiLogger, CYAN, MAGENTA, BRIGHT, hk, db, nf, wr, zb, er, LogLevel } from 'matterbridge/logger';

import EventEmitter from 'events';

import { ShellyDevice } from './shellyDevice.js';
import { DiscoveredDevice, MdnsScanner } from './mdnsScanner.js';
import { CoapServer } from './coapServer.js';
import { SocketType } from 'dgram';

export class Shelly extends EventEmitter {
  private readonly _devices = new Map<string, ShellyDevice>();
  private readonly log: AnsiLogger;
  private mdnsScanner: MdnsScanner | undefined;
  public coapServer: CoapServer | undefined;
  private coapServerTimeout?: NodeJS.Timeout;
  public username: string | undefined;
  public password: string | undefined;
  private debugMdns = false;
  private debugCoap = false;

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
        shellyDevice.log.debug(
          `CoIoT update from device id ${hk}${shellyDevice.id}${db} host ${zb}${host}${db} component ${CYAN}${component}${db} property ${CYAN}${property}${db} value ${CYAN}${value}${db}`,
        );
        if (!shellyDevice.hasComponent(component)) this.log.error(`Device ${hk}${shellyDevice.id}${er} host ${zb}${host}${er} does not have component ${CYAN}${component}${nf}`);
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
      if (!device.cached && !device.host.endsWith('.json')) this.coapServer?.registerDevice(device.host); // No await to register device for CoIoT updates
      this.startCoap(10000);
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

  startMdns(mdnsShutdownTimeout?: number, mdnsInterface?: string, type?: SocketType, debug = false) {
    this.mdnsScanner?.start(mdnsShutdownTimeout, mdnsInterface, type, debug);
  }

  startCoap(coapStartTimeout?: number) {
    if (coapStartTimeout) {
      this.coapServerTimeout = setTimeout(() => {
        this.coapServer?.start(this.debugCoap);
      }, coapStartTimeout);
    } else {
      this.coapServer?.start(this.debugCoap);
    }
  }

  setLogLevel(level: LogLevel, debugMdns: boolean, debugCoap: boolean) {
    this.log.logLevel = level;
    this.debugMdns = debugMdns;
    this.debugCoap = debugCoap;
    if (this.mdnsScanner) this.mdnsScanner.log.logLevel = debugMdns ? LogLevel.DEBUG : LogLevel.INFO;
    if (this.coapServer) this.coapServer.log.logLevel = debugCoap ? LogLevel.DEBUG : LogLevel.INFO;
    this.devices.forEach((device) => {
      device.setLogLevel(level);
    });
  }

  logDevices() {
    this.log.debug(`${BRIGHT}Shellies${db} (${this.devices.length}):`);
    for (const [id, device] of this) {
      this.log.debug(`- ${hk}${id}${db}: name ${CYAN}${device.name}${db} ip ${MAGENTA}${device.host}${db} model ${CYAN}${device.model}${db} auth ${CYAN}${device.auth}${db}`);
    }
  }
}

/*
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
*/
