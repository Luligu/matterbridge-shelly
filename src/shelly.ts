/**
 * This file contains the class Shelly.
 *
 * @file src\shelly.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 2.1.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

import crypto from 'node:crypto';
import EventEmitter from 'node:events';

import { ShellyDevice } from './shellyDevice.js';
import { DiscoveredDevice, MdnsScanner } from './mdnsScanner.js';
import { CoapServer } from './coapServer.js';
import { WsClient } from './wsClient.js';
import { WsServer } from './wsServer.js';
import { ShellyData, ShellyDataType, ShellyDeviceId } from './shellyTypes.js';
import { isValidArray, isValidObject } from 'matterbridge/utils';

/**
 * Creates a new instance of the Shelly class.
 * @param {AnsiLogger} log - The logger instance.
 * @param {string} [username] - The username for authentication.
 * @param {string} [password] - The password for authentication.
 */
export class Shelly extends EventEmitter {
  private readonly _devices = new Map<string, ShellyDevice>();
  private readonly log: AnsiLogger;
  private fetchInterval?: NodeJS.Timeout;
  public mdnsScanner: MdnsScanner;
  public coapServer: CoapServer;
  public wsServer: WsServer;
  public username: string | undefined;
  public password: string | undefined;
  private _dataPath = '';

  /**
   * Creates a new instance of the Shelly class.
   * @param {AnsiLogger} log - The logger instance.
   * @param {string} [username] - The username for authentication.
   * @param {string} [password] - The password for authentication.
   */
  constructor(log: AnsiLogger, username?: string, password?: string) {
    super();
    this.log = log;
    this.username = username;
    this.password = password;
    this.mdnsScanner = new MdnsScanner();
    this.coapServer = new CoapServer();
    this.wsServer = new WsServer();

    // Handle wssupdate from WsServer
    this.wsServer.on('wssupdate', async (shellyId: string, params: ShellyData) => {
      const device = this.getDevice(shellyId);
      if (!device) {
        this.log.debug(`Received wssupdate from a not registered device id ${hk}${shellyId}${db}`);
        return;
      }
      // this.log.debug(`Received wssupdate from device id ${hk}${shellyId}${db} host ${zb}${device.host}${db}:${rs}\n`, params);
      this.log.debug(`Received wssupdate from device id ${hk}${shellyId}${db} host ${zb}${device.host}${db}`);
      if (device.sleepMode) device.emit('awake');
      if (!device.online) {
        device.online = true;
        device.emit('online');
        this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} sent a WebSocket message: setting online to true`);
      }
      if (device.cached) {
        device.cached = false;
        this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} sent a WebSocket message: setting cached to false`);
      }
      if (isValidObject(params, 1)) device.onUpdate(params);
    });

    // Handle wssevent from WsServer
    this.wsServer.on('wssevent', async (shellyId: string, params: ShellyData) => {
      const device = this.getDevice(shellyId);
      if (!device) {
        this.log.debug(`Received wssevent from a not registered device id ${hk}${shellyId}${db}`);
        return;
      }
      // this.log.debug(`Received wssevent from device id ${hk}${shellyId}${db} host ${zb}${device.host}${db}:${rs}\n`, params);
      this.log.debug(`Received wssevent from device id ${hk}${shellyId}${db} host ${zb}${device.host}${db}`);
      if (device.sleepMode) device.emit('awake');
      if (!device.online) {
        device.online = true;
        device.emit('online');
        this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} sent a WebSocket message: setting online to true`);
      }
      if (device.cached) {
        device.cached = false;
        this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} sent a WebSocket message: setting cached to false`);
      }
      if (isValidObject(params, 1) && isValidArray(params.events, 1)) device.onEvent(params.events as ShellyData[]);
    });

    this.mdnsScanner.on('discovered', async (device: DiscoveredDevice) => {
      this.log.info(`Discovered shelly gen ${CYAN}${device.gen}${nf} device id ${hk}${device.id}${nf} host ${zb}${device.host}${nf} port ${zb}${device.port}${nf} `);
      this.emit('discovered', device);
    });

    this.coapServer.on('update', async (host: string, component: string, property: string, value: ShellyDataType) => {
      const device = this.getDeviceByHost(host);
      if (device) {
        device.log.debug(
          `CoIoT update from device id ${hk}${device.id}${db} host ${zb}${host}${db} component ${CYAN}${component}${db} property ${CYAN}${property}${db} value ${CYAN}${value}${db}`,
        );
        if (!device.hasComponent(component)) this.log.error(`Device ${hk}${device.id}${er} host ${zb}${host}${er} does not have component ${CYAN}${component}${nf}`);
        device.getComponent(component)?.setValue(property, value);
        device.lastseen = Date.now();
        if (device.sleepMode) device.emit('awake');
        if (!device.online) {
          device.online = true;
          device.emit('online');
          this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${host}${db} received a CoIoT message: setting online to true`);
        }
        if (device.cached) {
          device.cached = false;
          this.log.debug(`Device ${hk}${device.id}${db} host ${zb}${host}${db} received a CoIoT message: setting cached to false`);
        }
      }
    });

    // Fetch updates from devices every 55-65 minutes (randomized) and save payloads to disk
    this.fetchInterval = setInterval(() => {
      this.devices.forEach((device) => {
        // Randomize fetch interval from 55 to 65 minutes for each device on the first run
        if (device.fetchInterval === 0) {
          const minMinutes = 55;
          const maxMinutes = 65;
          const randomFactor = crypto.randomBytes(4).readUInt32BE() / 0xffffffff;
          device.fetchInterval = (minMinutes + randomFactor * (maxMinutes - minMinutes)) * 60 * 1000;
          const fetchIntervalMinutes = Math.floor(device.fetchInterval / 1000 / 60);
          const fetchIntervalSeconds = Math.round((device.fetchInterval / 1000) % 60);
          this.log.debug(
            `Device ${hk}${device.id}${db} host ${zb}${device.host}${db} fetch interval ${CYAN}${fetchIntervalMinutes}${db} minutes and ${CYAN}${fetchIntervalSeconds}${db} seconds`,
          );
        }
        // Set device offline if sleepMode is enabled and lastseen is older than 12 hours
        if (device.sleepMode) {
          if (Date.now() - device.lastseen > 12 * 60 * 60 * 1000) {
            if (device.online) {
              device.log.warn(`Device ${hk}${device.id}${wr} host ${zb}${device.host}${wr} has not been seen since 12 hours. The device may be offline.`);
              device.online = false;
              device.emit('offline');
            }
          }
          return;
        }
        // Fetch data if fetchInterval has passed
        if (Date.now() - device.lastFetched > device.fetchInterval) {
          const fetchIntervalMinutes = Math.floor(device.fetchInterval / 1000 / 60);
          const fetchIntervalSeconds = Math.round((device.fetchInterval / 1000) % 60);
          this.log.debug(
            `Fetching data from device ${hk}${device.id}${db} host ${zb}${device.host}${db} (fetch interval ${CYAN}${fetchIntervalMinutes}${db} minutes and ${CYAN}${fetchIntervalSeconds}${db} seconds)`,
          );
          device.fetchUpdate().then((data) => {
            device.lastFetched = Date.now(); // Update lastFetched timestamp even if no data is fetched to avoid multiple fetches
            if (data) device.saveDevicePayloads(this._dataPath);
          });
        }
      });
    }, 10 * 1000);
  }

  /**
   * Destroys the instance of the class.
   *
   * This method stops the CoAP server, removes all devices, and cleans up event listeners.
   * It also stops the mDNS scanner and clears the reference to it.
   *
   * @remarks
   * This method should be called when the instance is no longer needed to free up resources.
   */
  destroy() {
    clearInterval(this.fetchInterval);
    this.fetchInterval = undefined;
    this.devices.forEach((device) => {
      device.destroy();
      this.removeDevice(device);
    });
    this.removeAllListeners();
    this.wsServer.removeAllListeners();
    this.wsServer.stop();
    this.mdnsScanner.removeAllListeners();
    this.mdnsScanner.stop();
    this.coapServer.removeAllListeners();
    this.coapServer.stop();
    this._devices.clear();
  }

  /**
   * Sets the data path for the Shelly instance.
   *
   * @param {string} path - The new data path to set.
   */
  set dataPath(path: string) {
    this.log.debug(`Set shelly data path to ${CYAN}${path}${db}`);
    this._dataPath = path;
    this.mdnsScanner.dataPath = path;
    this.coapServer.dataPath = path;
  }

  /**
   * Gets the data path for the Shelly instance.
   *
   * @returns {string} The data path for the Shelly instance.
   */
  get dataPath() {
    return this._dataPath;
  }

  /**
   * Checks if a device with the specified ID exists.
   *
   * @param {string} id - The ID of the device to check.
   * @returns {boolean} - Returns true if the device exists, otherwise returns false.
   */
  hasDevice(id: string): boolean {
    return this._devices.has(id);
  }

  /**
   * Checks if a device with the specified host exists.
   *
   * @param {string} host - The host of the device to check.
   * @returns {boolean} - Returns true if a device with the specified host exists, otherwise returns false.
   */
  hasDeviceHost(host: string): boolean {
    const devices = this.devices.filter((device) => device.host === host);
    return devices.length > 0;
  }

  /**
   * Retrieves a ShellyDevice object by its ID.
   *
   * @param {string} id - The ID of the device to retrieve.
   * @returns {ShellyDevice | undefined} The ShellyDevice object with the specified ID, or undefined if not found.
   */
  getDevice(id: string): ShellyDevice | undefined {
    return this._devices.get(id);
  }

  /**
   * Retrieves a ShellyDevice object based on the provided host.
   *
   * @param {string} host - The host of the device.
   * @returns {ShellyDevice | undefined} The ShellyDevice object matching the provided host, or undefined if not found.
   */
  getDeviceByHost(host: string): ShellyDevice | undefined {
    const devices = this.devices.filter((device) => device.host === host);
    if (devices.length === 0) return undefined;
    return this._devices.get(devices[0].id);
  }

  /**
   * Adds a device to the Shelly instance.
   *
   * @param {ShellyDevice} device - The ShellyDevice object to be added.
   * @returns {Promise<Shelly>} A Promise that resolves to the updated Shelly instance.
   */
  async addDevice(device: ShellyDevice): Promise<Shelly> {
    if (this.hasDevice(device.id)) {
      this.log.warn(`Shelly device ${hk}${device.id}${wr}: name ${CYAN}${device.name}${wr} ip ${MAGENTA}${device.host}${wr} model ${CYAN}${device.model}${wr} already exists`);
      return this;
    }
    this._devices.set(device.id, device);
    if (device.gen === 1) {
      this.coapServer.start();
      this.coapServer.registerDevice(device.host, device.id, device.sleepMode); // No await to register device for CoIoT updates
    } else if (device.gen >= 2) {
      if (device.sleepMode) {
        this.wsServer.start();
      } else {
        if (device.wsClient && device.wsClient.isConnected === false) {
          device.log.info(`WebSocket client for device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} is not connected. Starting connection...`);
          device.wsClient.start();
        }
      }
    }
    this.emit('add', device);
    return this;
  }

  /**
   * Removes a device from the Shelly instance.
   *
   * @param {ShellyDevice | ShellyDeviceId} device - The device or the device id to be removed.
   * @returns {Shelly} The updated Shelly instance.
   */
  removeDevice(device: ShellyDevice | ShellyDeviceId): Shelly {
    const id = typeof device === 'string' ? device : device.id;
    this._devices.delete(id);
    return this;
  }

  /**
   * Gets the array of Shelly devices.
   *
   * @returns An array of ShellyDevice objects.
   */
  get devices(): ShellyDevice[] {
    return Array.from(this._devices.values());
  }

  /**
   * Returns an iterable iterator for the ShellyDevice objects in the Shelly class.
   *
   * @returns {IterableIterator<[string, ShellyDevice]>} An iterable iterator that yields key-value pairs of device IDs and ShellyDevice objects.
   */
  *[Symbol.iterator](): IterableIterator<[string, ShellyDevice]> {
    for (const [id, device] of this._devices.entries()) {
      yield [id, device];
    }
  }

  /**
   * Sets the log level and debug flags for the Shelly instance.
   *
   * @param {LogLevel} level - The log level to set.
   * @param {boolean} debugMdns - Whether to enable debug logging for mDNS.
   * @param {boolean} debugCoap - Whether to enable debug logging for CoAP.
   * @param {boolean} debugWs - Whether to enable debug logging for WebSocket.
   */
  setLogLevel(level: LogLevel, debugMdns: boolean, debugCoap: boolean, debugWs: boolean) {
    // Called 2 times in platform.ts: 1) at startup, 2) after onChangeLoggerLevel
    this.log.logLevel = level;
    this.mdnsScanner.log.logLevel = debugMdns ? LogLevel.DEBUG : LogLevel.INFO;
    this.coapServer.log.logLevel = debugCoap ? LogLevel.DEBUG : LogLevel.INFO;
    this.wsServer.log.logLevel = debugWs ? LogLevel.DEBUG : LogLevel.INFO;
    WsClient.logLevel = debugWs ? LogLevel.DEBUG : LogLevel.INFO; // Static property for new instances
    this.devices.forEach((device) => {
      device.setLogLevel(level);
      if (device.wsClient) {
        if (debugWs)
          device.wsClient.log.logLevel = LogLevel.DEBUG; // Set log level for existing WebSocket clients
        else device.wsClient.log.logLevel = LogLevel.INFO;
      }
    });
  }

  /**
   * Logs information about the Shellies devices.
   */
  logDevices() {
    this.log.debug(`${BRIGHT}Shellies${db} (${this.devices.length}):`);
    for (const [id, device] of this) {
      this.log.debug(`- ${hk}${id}${db}: name ${CYAN}${device.name}${db} ip ${MAGENTA}${device.host}${db} model ${CYAN}${device.model}${db} auth ${CYAN}${device.auth}${db}`);
    }
  }
}
