/**
 * This file contains the class ShellyDevice.
 *
 * @file src\shellyDevice.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 3.1.4
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

// Matterbridge imports
import { AnsiLogger, LogLevel, BLUE, CYAN, GREEN, GREY, MAGENTA, RESET, db, debugStringify, er, hk, nf, wr, zb, rs, YELLOW, idn, nt, rk, dn } from 'matterbridge/logger';
import { isValidNumber, isValidObject, isValidString } from 'matterbridge/utils';

// Node.js imports
import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Shellies imports
import { parseDigestAuthenticateHeader, createDigestShellyAuth, createBasicShellyAuth, parseBasicAuthenticateHeader, getGen2BodyOptions, getGen1BodyOptions } from './auth.js';
import { WsClient } from './wsClient.js';
import { Shelly } from './shelly.js';
import {
  BTHomeBluTrvComponent,
  BTHomeComponent,
  BTHomeComponentPayload,
  BTHomeDeviceComponent,
  BTHomeDeviceComponentStatus,
  BTHomeSensorComponent,
  BTHomeSensorComponentStatus,
  ShellyData,
  ShellyDataType,
  ShellyEvent,
} from './shellyTypes.js';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyComponent } from './shellyComponent.js';

interface ShellyDeviceEvent {
  online: [];
  offline: [];
  awake: [];
  update: [id: string, key: string, value: ShellyDataType];
  bthome_event: [event: ShellyEvent];
  bthomedevice_event: [addr: string, event: ShellyEvent];
  bthomesensor_event: [addr: string, sensorName: string, sensorIndex: number, event: ShellyEvent];
  bthomedevice_update: [addr: string, rssi: number, packet_id: number, last_updated_ts: number];
  bthomesensor_update: [addr: string, sensorName: string, sensorIndex: number, value: ShellyDataType];
}

/**
 * Constructs a new instance of the ShellyDevice class.
 *
 * @param {Shelly} shelly - The Shelly object.
 * @param {AnsiLogger} log - The AnsiLogger object.
 * @param {string} host - The host string.
 */
export class ShellyDevice extends EventEmitter {
  readonly shelly: Shelly;
  readonly log: AnsiLogger;
  readonly username: string | undefined;
  readonly password: string | undefined;
  profile: 'switch' | 'cover' | 'rgb' | 'rgbw' | 'color' | 'white' | 'light' | undefined = undefined;
  host: string;
  id = '';
  model = '';
  mac = '';
  firmware = '';
  auth = false;
  name = '';
  online = false;
  gen = 0;
  lastseen = 0;
  lastFetched = Date.now() - 50 * 60 * 1000; // 50 minutes ago (lowest random value is 55 minutes, highest is 65 minutes). So we fetch the first time after 5 minutes to 15 minutes.
  fetchInterval = 0;
  hasUpdate = false;
  sleepMode = false;
  cached = false;

  colorUpdateTimeout?: NodeJS.Timeout;
  colorCommandTimeout?: NodeJS.Timeout;
  thermostatSystemModeTimeout?: NodeJS.Timeout;
  thermostatSetpointTimeout?: NodeJS.Timeout;
  private lastseenInterval?: NodeJS.Timeout;
  private startWsClientTimeout?: NodeJS.Timeout;
  wsClient?: WsClient;

  private readonly _components = new Map<string, ShellyComponent>();

  private shellyPayload: ShellyData | null = null;
  private statusPayload: ShellyData | null = null;
  private settingsPayload: ShellyData | null = null;
  private componentsPayload: ShellyData | null = null;
  readonly bthomeTrvs = new Map<string, { id: number; key: string; addr: string; bthomedevice: string }>();
  readonly bthomeDevices = new Map<
    string,
    { id: number; key: string; name: string; addr: string; model: string; type: string; blutrv_id: number; packet_id: number; rssi: number; last_updated_ts: number }
  >();
  readonly bthomeSensors = new Map<
    string,
    { id: number; key: string; name: string; addr: string; sensorId: number; sensorIdx: number; value?: ShellyDataType; last_updated_ts: number }
  >();

  private constructor(shelly: Shelly, log: AnsiLogger, host: string) {
    super();
    this.shelly = shelly;
    this.log = log;
    this.host = host;
    this.username = shelly.username;
    this.password = shelly.password;
  }

  override emit<K extends keyof ShellyDeviceEvent>(eventName: K, ...args: ShellyDeviceEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof ShellyDeviceEvent>(eventName: K, listener: (...args: ShellyDeviceEvent[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * Destroys the instance of the ShellyDevice.
   * Clears all intervals and timeouts, stops the WebSocket client, and removes all listeners.
   */
  destroy() {
    if (this.colorUpdateTimeout) clearInterval(this.colorUpdateTimeout);
    this.colorUpdateTimeout = undefined;
    if (this.colorCommandTimeout) clearInterval(this.colorCommandTimeout);
    this.colorCommandTimeout = undefined;
    if (this.thermostatSystemModeTimeout) clearInterval(this.thermostatSystemModeTimeout);
    this.thermostatSystemModeTimeout = undefined;
    if (this.thermostatSetpointTimeout) clearInterval(this.thermostatSetpointTimeout);
    this.thermostatSetpointTimeout = undefined;
    if (this.lastseenInterval) clearInterval(this.lastseenInterval);
    this.lastseenInterval = undefined;
    this.lastseen = 0;
    if (this.startWsClientTimeout) clearTimeout(this.startWsClientTimeout);
    this.startWsClientTimeout = undefined;
    this.wsClient?.stop();
    this.wsClient?.removeAllListeners();
    this.wsClient = undefined;

    this._components.clear();

    this.shellyPayload = null;
    this.statusPayload = null;
    this.settingsPayload = null;
    this.componentsPayload = null;

    this.bthomeTrvs.clear();
    this.bthomeDevices.clear();
    this.bthomeSensors.clear();

    this.removeAllListeners();
  }

  /**
   * Sets the host value for the device.
   *
   * @param {string} value - The new host value to set.
   */
  setHost(value: string) {
    this.host = value;
    this.wsClient?.setHost(value);
  }

  /**
   * Sets the log level for the device.
   * @param {LogLevel} logLevel - The log level to set.
   */
  setLogLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  /**
   * Checks if the device has a component with the specified ID.
   *
   * @param {string} id - The ID of the component to check.
   * @returns {boolean} A boolean indicating whether the device has the component.
   */
  hasComponent(id: string): boolean {
    return this._components.has(id);
  }

  /**
   * Retrieves a ShellyComponent by its ID.
   *
   * @param {string} id - The ID of the component to retrieve.
   * @returns {ShellyComponent | ShellyLightComponent | ShellySwitchComponent | ShellyCoverComponent | undefined} The ShellyComponent with the specified ID, or undefined if not found.
   */
  getComponent<T extends ShellyComponent>(id: string): T | undefined {
    const component = this._components.get(id);
    if (!component) return undefined;
    if (isLightComponent(component)) return component as unknown as T;
    if (isSwitchComponent(component)) return component as unknown as T;
    if (isCoverComponent(component)) return component as unknown as T;
    return component as T;
  }

  /**
   * Retrieves an array of component IDs.
   *
   * @returns {string[]} An array of strings representing the component IDs.
   */
  getComponentIds(): string[] {
    return Array.from(this._components.keys());
  }

  /**
   * Retrieves an array of unique component names.
   *
   * @returns {string[]} An array of strings representing the names of the components.
   */
  getComponentNames(): string[] {
    const names = Array.from(this._components.values()).map((component) => component.name);
    return Array.from(new Set(names));
  }

  /**
   * Adds a ShellyComponent to the device.
   *
   * @param {ShellyComponent} component - The component to be added.
   * @returns {ShellyComponent} The added component.
   */
  addComponent(component: ShellyComponent): ShellyComponent {
    this._components.set(component.id, component);
    return component;
  }

  /**
   * Updates a component with the specified ID and data.
   *
   * @param {strin} id - The ID of the component to update.
   * @param {ShellyData} data - The data to update the component with.
   * @returns {ShellyComponent | undefined} The updated component if found, otherwise undefined.
   */
  updateComponent(id: string, data?: ShellyData): ShellyComponent | undefined {
    const component = this.getComponent(id);
    if (component) {
      for (const prop in data) {
        component.setValue(prop, data[prop]);
      }
      return component;
    } else {
      this.log.error(`Component ${id} not found in device ${GREEN}${this.id}${er} (${BLUE}${this.name}${er})`);
      return undefined;
    }
  }

  /**
   * Gets the components of the Shelly device.
   *
   * @returns {ShellyComponent[]} An array of ShellyComponent objects representing the components of the device.
   */
  get components(): ShellyComponent[] {
    return Array.from(this._components.values());
  }

  /**
   * Returns an iterator for the key-value pairs of the ShellyDevice's components.
   * @returns {IterableIterator<[string, ShellyComponent]>} An iterator for the key-value pairs of the ShellyDevice's components.
   */
  *[Symbol.iterator](): IterableIterator<[string, ShellyComponent]> {
    for (const [key, component] of this._components.entries()) {
      yield [key, component];
    }
  }

  /**
   * Normalizes the given hostname to extract the type, MAC address, and ID.
   *
   * @param {string} hostname - The hostname to normalize.
   * @returns { type: string; mac: string; id: string } An object containing the normalized type, MAC address, and ID.
   */
  static normalizeId(hostname: string): { type: string; mac: string; id: string } {
    const parts = hostname.split('-');
    if (parts.length < 2) return { type: '', mac: '', id: hostname };
    const mac = parts.pop(); // Extract the MAC address (last part)
    if (!mac) return { type: '', mac: '', id: hostname };
    const name = parts.join('-'); // Join the remaining parts to form the device name
    return { type: name.toLowerCase(), mac: mac.toUpperCase(), id: name.toLowerCase() + '-' + mac.toUpperCase() };
  }

  /**
   * Retrieves the name of a BTHome sensor based on its object ID.
   *
   * @param {number} objId - The object ID of the BTHome sensor.
   * @returns The name of the Bluetooth home object.
   */
  getBTHomeObjIdText(objId: number): string {
    const objIdsMap: Record<number, string> = {
      0x01: 'Battery',
      0x05: 'Illuminance',
      0x21: 'Motion',
      0x2d: 'Contact', // 1 - open, 0 - closed
      0x2e: 'Humidity',
      0x3a: 'Button',
      0x3f: 'Rotation',
      0x45: 'Temperature',
    };
    return objIdsMap[objId] || `Unknown sensor id ${objId}`;
  }

  /**
   * Converts a timestamp to a local time string.
   *
   * @param {number} last_updated_ts - The timestamp to convert, in seconds.
   * @returns {string} The local time string representation of the timestamp.
   */
  getLocalTimeFromLastUpdated(last_updated_ts: number): string {
    if (!isValidNumber(last_updated_ts, 1000000000)) return 'Unknown';
    const lastUpdatedTime = new Date(last_updated_ts * 1000);
    return lastUpdatedTime.toLocaleString();
  }

  /**
   * Retrieves the name of a BTHome device based on its model.
   *
   * @param {number} model - The object ID of the BTHome sensor.
   * @returns The name of the Bluetooth home object.
   */
  getBTHomeModelText(model: string): string {
    const modelsMap: Record<string, string> = {
      'SBBT-002C': 'Shelly BLU Button1',
      'SBDW-002C': 'Shelly BLU DoorWindow',
      'SBHT-003C': 'Shelly BLU HT',
      'SBMO-003Z': 'Shelly BLU Motion',
      'SBBT-004CEU': 'Shelly BLU Wall Switch 4',
      'SBBT-004CUS': 'Shelly BLU RC Button 4',
      'TRV': 'Shelly BLU Trv',
    };
    /*
    From: https://shelly-api-docs.shelly.cloud/docs-ble/common
    The shortened device name in advertising packet will be modified starting from FW v1.0.18 and will contain 4 digits of the mac address at the end:
    SBBT-USxxxx, SBBT-EUxxxx
    */
    if (model.startsWith('SBBT-2C')) return modelsMap['SBBT-002C'];
    if (model.startsWith('SBDW-2C')) return modelsMap['SBDW-002C'];
    if (model.startsWith('SBHT-3C')) return modelsMap['SBHT-003C'];
    if (model.startsWith('SBMO-3Z')) return modelsMap['SBMO-003Z'];
    if (model.startsWith('SBBT-EU')) return modelsMap['SBBT-004CEU'];
    if (model.startsWith('SBBT-US')) return modelsMap['SBBT-004CUS'];
    return modelsMap[model] || `Unknown Shelly BLU model ${model}`;
  }

  updateBTHomeComponents(): void {
    if (this.componentsPayload && this.componentsPayload.components) {
      this.bthomeTrvs.clear();
      this.bthomeDevices.clear();
      this.bthomeSensors.clear();
      this.scanBTHomeComponents(this.componentsPayload.components as unknown as BTHomeComponent[]);
    }
  }
  /**
   * Scans the device for BTHome components.
   * It will also set the bthomeTrvs, bthomeDevices, and bthomeSensors maps.
   *
   * @param {BTHomeComponent[]} components - The array of Bluetooth Home components to scan.
   */
  scanBTHomeComponents(components: BTHomeComponent[]) {
    this.bthomeTrvs.clear();
    this.bthomeDevices.clear();
    this.bthomeSensors.clear();
    if (components.length > 0) this.log.info(`Scanning the device ${hk}${this.id}${nf} host ${zb}${this.host}${nf} for BTHome devices and sensors...`);
    try {
      for (const component of components as unknown as BTHomeBluTrvComponent[]) {
        if (component.key.startsWith('blutrv:')) {
          if (!isValidString(component.key, 6) || !isValidObject(component.status, 5) || !isValidObject(component.config, 5)) {
            this.log.error(
              `BTHome BLUTrv id ${CYAN}${component.config.id}${er} key ${CYAN}${component.key}${er} address ${CYAN}${component.config.addr}${er} has no valid data!`,
              component,
            );
            return;
          }
          this.log.debug(`- BLUTrv device id ${CYAN}${component.config.id}${db} key ${CYAN}${component.key}${db} address ${CYAN}${component.config.addr}${db} `);
          // console.log(component.key, component.status, component.config, component.attrs);
          this.bthomeTrvs.set(component.config.addr, {
            id: component.config.id,
            key: component.key,
            addr: component.config.addr,
            bthomedevice: component.config.trv,
          });
        }
      }
      for (const component of components as unknown as BTHomeDeviceComponent[]) {
        if (component.key.startsWith('bthomedevice:')) {
          // Shelly BLU gateway doesn't have config.meta.ui.local_name!
          if (component.attrs?.model_id === 1) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBBT-002C', icon: null } };
          } else if (component.attrs?.model_id === 2) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBDW-002C', icon: null } };
          } else if (component.attrs?.model_id === 3) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBHT-003C', icon: null } };
          } else if (component.attrs?.model_id === 5) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBMO-003Z', icon: null } };
          } else if (component.attrs?.model_id === 6) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBBT-004CEU', icon: null } };
          } else if (component.attrs?.model_id === 7) {
            component.config.meta = { ui: { view: 'regular', local_name: 'SBBT-004CUS', icon: null } };
          } else if (component.attrs?.model_id === 8) {
            component.config.meta = { ui: { view: 'regular', local_name: 'TRV', icon: null } };
          }
          if (
            !isValidString(component.key, 12) ||
            !isValidObject(component.status, 5) ||
            !isValidObject(component.config, 5) ||
            !isValidObject(component.config.meta, 1) ||
            !isValidObject(component.config.meta.ui, 2) ||
            !isValidString(component.config.meta.ui.local_name)
          ) {
            this.log.error(
              `BTHome device id ${CYAN}${component.config.id}${er} key ${CYAN}${component.key}${er} address ${CYAN}${component.config.addr}${er} ` +
                `name ${CYAN}${component.config.name}${er} has no valid data!`,
              component,
            );
            return;
          }
          const blutrv_id = this.bthomeTrvs.get(component.config.addr)?.id ?? 0;
          this.log.debug(
            `- BLU device id ${CYAN}${component.config.id}${db} key ${CYAN}${component.key}${db} address ${CYAN}${component.config.addr}${db} ` +
              `blutrv_id ${CYAN}${blutrv_id}${db} ` +
              `name ${CYAN}${component.config.name}${db} battery ${CYAN}${component.status.battery}${db} packet_id ${CYAN}${component.status.packet_id}${db} ` +
              `rssi ${CYAN}${component.status.rssi}${db} last update ${CYAN}${this.getLocalTimeFromLastUpdated(component.status.last_updated_ts)}${db} ` +
              `model ${CYAN}${component.config.meta.ui.local_name}${db} => ${CYAN}${this.getBTHomeModelText(component.config.meta.ui.local_name)}${db} `,
          );
          // console.log(component.key, component.status, component.config, component.attrs);
          this.bthomeDevices.set(component.config.addr, {
            id: component.config.id,
            key: component.key,
            addr: component.config.addr,
            blutrv_id: blutrv_id,
            name: component.config.name ?? `${this.getBTHomeModelText(component.config.meta.ui.local_name)} ` + component.config.addr,
            model: this.getBTHomeModelText(component.config.meta.ui.local_name),
            type: component.config.meta.ui.local_name,
            rssi: component.status.rssi,
            packet_id: component.status.packet_id,
            last_updated_ts: component.status.last_updated_ts,
          });
        }
      }
      for (const component of components as unknown as BTHomeSensorComponent[]) {
        if (component.key.startsWith('bthomesensor:')) {
          if (
            !isValidString(component.key, 12) ||
            !isValidObject(component.status, 1) ||
            !isValidObject(component.config, 6) ||
            !isValidNumber(component.config.obj_id) ||
            !isValidNumber(component.config.id) ||
            !isValidString(component.config.addr) ||
            !isValidNumber(component.config.idx)
          ) {
            this.log.error(
              `BTHome sensor id ${CYAN}${component.config.id}${er} key ${CYAN}${component.key}${er} address ${CYAN}${component.config.addr}${er} ` +
                `name ${CYAN}${component.config.name}${er} obj_id ${CYAN}${component.config.obj_id}${er} has no valid data!`,
              component,
            );
            return;
          }
          this.log.debug(
            `- BLU sensor id ${CYAN}${component.status.id}${db} key ${CYAN}${component.key}${db} address ${CYAN}${component.config.addr}${db} ` +
              `name ${CYAN}${component.config.name}${db} ` +
              `obj_id ${CYAN}0x${component.config.obj_id.toString(16).padStart(2, '0')}${db} => ${CYAN}${this.getBTHomeObjIdText(component.config.obj_id)}${db} idx ${CYAN}${component.config.idx}${db} ` +
              `value ${CYAN}${component.status.value}${db} last update ${CYAN}${this.getLocalTimeFromLastUpdated(component.status.last_updated_ts)}${db} `,
          );
          // console.log(component.key, component.status, component.config);
          this.bthomeSensors.set(component.key, {
            id: component.config.id,
            key: component.key,
            name: component.config.name ?? this.getBTHomeObjIdText(component.config.obj_id),
            addr: component.config.addr,
            sensorId: component.config.obj_id,
            sensorIdx: component.config.idx,
            value: component.status.value,
            last_updated_ts: component.status.last_updated_ts,
          });
        }
      }
    } catch (error) {
      this.log.error(`Error scanning the device ${hk}${this.id}${db} host ${zb}${this.host}${db} for BTHome devices and sensors: ${error}`);
    }
    // if (this.bthomeTrvs.size > 0) this.log.debug(`BTHome devices map:${rs}\n`, this.bthomeTrvs);
    // if (this.bthomeDevices.size > 0) this.log.debug(`BTHome devices map:${rs}\n`, this.bthomeDevices);
    // if (this.bthomeSensors.size > 0) this.log.debug(`BTHome sensors map:${rs}\n`, this.bthomeSensors);
  }

  /**
   * Creates a ShellyDevice instance.
   *
   * @param {Shelly} shelly The Shelly instance.
   * @param {AnsiLogger} log The AnsiLogger instance.
   * @param {string} host The host of the device.
   * @returns {Promise<ShellyDevice | undefined>} A Promise that resolves to a ShellyDevice instance or undefined if an error occurs.
   */
  static async create(shelly: Shelly, log: AnsiLogger, host: string): Promise<ShellyDevice | undefined> {
    let shellyPayload: ShellyData | null = null;
    let statusPayload: ShellyData | null = null;
    let settingsPayload: ShellyData | null = null;
    let componentsPayload: ShellyData | null = null;

    shellyPayload = await ShellyDevice.fetch(shelly, log, host, 'shelly');
    if (!shellyPayload) {
      log.debug(`Error creating device at host ${zb}${host}${db}. No shelly data found.`);
      return undefined;
    }
    const device = new ShellyDevice(shelly, log, host);
    device.mac = shellyPayload.mac as string;
    device.online = true;
    device.lastseen = Date.now();
    device.sleepMode = (shellyPayload.sleep_mode as boolean) ?? false;

    // Gen 1 Shelly device can be mode relay or roller - color or white!
    // Gen 2/3 Shelly device can be profile switch or cover - rgb or rgbw or white!
    if (shellyPayload.mode === 'relay') device.profile = 'switch';
    if (shellyPayload.mode === 'roller') device.profile = 'cover';
    if (shellyPayload.mode === 'color') device.profile = 'color';
    if (shellyPayload.mode === 'white') device.profile = 'white';
    if (shellyPayload.profile !== undefined) device.profile = shellyPayload.profile as 'switch' | 'cover' | 'rgb' | 'rgbw' | 'color' | 'white' | 'light' | undefined;

    // Gen 1 Shelly device
    if (!shellyPayload.gen) {
      statusPayload = await ShellyDevice.fetch(shelly, log, host, 'status');
      settingsPayload = await ShellyDevice.fetch(shelly, log, host, 'settings');
      if (!statusPayload || !settingsPayload) {
        log.debug(`Error creating device gen 1 from host ${zb}${host}${db}. No data found.`);
        return undefined;
      }
      device.model = shellyPayload.type as string;
      device.id = ShellyDevice.normalizeId((settingsPayload.device as ShellyData).hostname as string).id;
      device.firmware = (shellyPayload.fw as string).split('/')[1];
      device.auth = shellyPayload.auth as boolean;
      device.name = settingsPayload.name ? (settingsPayload.name as string) : device.id;
      device.gen = 1;
      device.hasUpdate = statusPayload.has_update as boolean;
      for (const key in settingsPayload) {
        if (key === 'wifi_ap') device.addComponent(new ShellyComponent(device, key, 'WiFi', settingsPayload[key] as ShellyData));
        if (key === 'wifi_sta') device.addComponent(new ShellyComponent(device, key, 'WiFi', settingsPayload[key] as ShellyData));
        if (key === 'wifi_sta1') device.addComponent(new ShellyComponent(device, key, 'WiFi', settingsPayload[key] as ShellyData));
        if (key === 'mqtt') device.addComponent(new ShellyComponent(device, key, 'MQTT', settingsPayload[key] as ShellyData));
        if (key === 'coiot') device.addComponent(new ShellyComponent(device, key, 'CoIoT', settingsPayload[key] as ShellyData));
        if (key === 'sntp') device.addComponent(new ShellyComponent(device, key, 'Sntp', settingsPayload[key] as ShellyData));
        if (key === 'cloud') device.addComponent(new ShellyComponent(device, key, 'Cloud', settingsPayload[key] as ShellyData));
        if (key === 'lights') {
          let index = 0;
          for (const light of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `light:${index++}`, 'Light', light as ShellyData));
          }
          // Fix for Shelly SHRGBWW-01 that has no inputs in settings and status
          if (device.model === 'SHRGBWW-01') device.addComponent(new ShellyComponent(device, 'input:0', 'Input'));
        }
        if (key === 'relays' /* && device.profile !== 'cover'*/) {
          let index = 0;
          for (const relay of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `relay:${index++}`, 'Relay', relay as ShellyData));
          }
        }
        if (key === 'rollers' /* && device.profile !== 'switch'*/) {
          let index = 0;
          for (const roller of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `roller:${index++}`, 'Roller', roller as ShellyData));
          }
        }
        if (key === 'inputs') {
          let index = 0;
          for (const input of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `input:${index++}`, 'Input', input as ShellyData));
          }
        }
        if (key === 'thermostats') {
          let index = 0;
          for (const thermostat of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `thermostat:${index++}`, 'Thermostat', thermostat as ShellyData));
          }
        }
      }
      for (const key in statusPayload) {
        if (key === 'ext_temperature' && isValidObject(statusPayload[key], 1)) device.addComponent(new ShellyComponent(device, 'temperature', 'Temperature'));
        if (key === 'ext_humidity' && isValidObject(statusPayload[key], 1)) device.addComponent(new ShellyComponent(device, 'humidity', 'Humidity'));
        if (key === 'temperature') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'overtemperature') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'tmp' && statusPayload.temperature === undefined && statusPayload.overtemperature === undefined) {
          device.addComponent(new ShellyComponent(device, 'temperature', 'Temperature'));
        }
        if (key === 'hum') device.addComponent(new ShellyComponent(device, 'humidity', 'Humidity'));
        if (key === 'voltage') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'mode') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'bat') device.addComponent(new ShellyComponent(device, 'battery', 'Battery'));
        if (key === 'charger') device.addComponent(new ShellyComponent(device, 'battery', 'Battery'));
        if (key === 'lux') device.addComponent(new ShellyComponent(device, 'lux', 'Lux'));
        if (key === 'flood') device.addComponent(new ShellyComponent(device, 'flood', 'Flood'));
        if (key === 'smoke') device.addComponent(new ShellyComponent(device, 'smoke', 'Smoke'));
        if (key === 'gas_sensor') device.addComponent(new ShellyComponent(device, 'gas', 'Gas'));
        if (key === 'sensor') {
          device.addComponent(new ShellyComponent(device, 'sensor', 'Sensor'));
          const sensor = statusPayload[key] as ShellyData;
          if (sensor.vibration !== undefined) device.addComponent(new ShellyComponent(device, 'vibration', 'Vibration'));
          if (sensor.state !== undefined) device.addComponent(new ShellyComponent(device, 'contact', 'Contact'));
          if (sensor.motion !== undefined) device.addComponent(new ShellyComponent(device, 'motion', 'Motion'));
        }
        if (key === 'accel') {
          const accel = statusPayload[key] as ShellyData;
          if (accel.vibration !== undefined) device.addComponent(new ShellyComponent(device, 'vibration', 'Vibration'));
        }

        if (key === 'inputs') {
          let index = 0;
          for (const input of statusPayload[key] as ShellyData[]) {
            if (!device.hasComponent(`input:${index}`)) device.addComponent(new ShellyComponent(device, `input:${index++}`, 'Input', input as ShellyData));
          }
        }
        if (key === 'meters') {
          let index = 0;
          for (const meter of statusPayload[key] as ShellyData[]) {
            if (device.profile === 'cover' && index > 0) break;
            device.addComponent(new ShellyComponent(device, `meter:${index++}`, 'PowerMeter', meter as ShellyData));
          }
        }
        if (key === 'emeters') {
          let index = 0;
          for (const emeter of statusPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `emeter:${index++}`, 'PowerMeter', emeter as ShellyData));
          }
        }
      }
      device.addComponent(new ShellyComponent(device, 'sys', 'Sys')); // Always present since we process now cfgChanged
    }

    // Gen 2+ Shelly device
    if (shellyPayload.gen === 2 || shellyPayload.gen === 3 || shellyPayload.gen === 4) {
      statusPayload = await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetStatus');
      settingsPayload = await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetConfig');
      if (!statusPayload || !settingsPayload) {
        log.debug(`Error creating device gen 2+ from host ${zb}${host}${db}. No data found.`);
        return undefined;
      }
      // Set sleep mode for gen 2 and 3 devices
      if ((statusPayload.sys as ShellyData).wakeup_period) device.sleepMode = true;
      device.model = shellyPayload.model as string;
      device.id = ShellyDevice.normalizeId(shellyPayload.id as string).id;
      device.firmware = (shellyPayload.fw_id as string).split('/')[1];
      device.auth = shellyPayload.auth_en as boolean;
      device.gen = shellyPayload.gen;
      // "available_updates": { }
      // "available_updates": { "stable": { "version": "1.3.2" } }
      // "available_updates": { "beta": { "version": "1.4.0-beta3" } }
      const available_updates = (statusPayload.sys as ShellyData).available_updates as ShellyData;
      device.hasUpdate = available_updates.stable !== undefined;
      for (const key in settingsPayload) {
        // log.debug(`Parsing device ${hk}${device.id}${db} component ${CYAN}${key}${db}...`);
        if (key === 'wifi') {
          const wifi = settingsPayload[key] as ShellyData;
          if (wifi.ap) device.addComponent(new ShellyComponent(device, 'wifi_ap', 'WiFi', wifi.ap as ShellyData)); // Ok
          if (wifi.sta) device.addComponent(new ShellyComponent(device, 'wifi_sta', 'WiFi', wifi.sta as ShellyData)); // Ok
          if (wifi.sta1) device.addComponent(new ShellyComponent(device, 'wifi_sta1', 'WiFi', wifi.sta1 as ShellyData)); // Ok
        }
        if (key === 'sys') {
          device.addComponent(new ShellyComponent(device, 'sys', 'Sys', settingsPayload[key] as ShellyData)); // Ok
          const sys = settingsPayload[key] as ShellyData;
          if (sys.sntp) {
            device.addComponent(new ShellyComponent(device, 'sntp', 'Sntp', sys.sntp as ShellyData)); // Ok
          }
          const dev = sys.device as ShellyData;
          device.name = dev.name ? (dev.name as string) : device.id;
        }
        if (key === 'blugw') device.addComponent(new ShellyComponent(device, key, 'Blugw', settingsPayload[key] as ShellyData));
        if (key === 'mqtt') device.addComponent(new ShellyComponent(device, key, 'MQTT', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ws') device.addComponent(new ShellyComponent(device, key, 'WS', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'cloud') device.addComponent(new ShellyComponent(device, key, 'Cloud', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ble') device.addComponent(new ShellyComponent(device, key, 'Ble', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'eth') device.addComponent(new ShellyComponent(device, key, 'Eth', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'matter') device.addComponent(new ShellyComponent(device, key, 'Matter', settingsPayload[key] as ShellyData)); // Ok
        if (key.startsWith('switch:')) device.addComponent(new ShellyComponent(device, key, 'Switch', settingsPayload[key] as ShellyData));
        if (key.startsWith('cover:')) device.addComponent(new ShellyComponent(device, key, 'Cover', settingsPayload[key] as ShellyData));
        if (key.startsWith('light:')) device.addComponent(new ShellyComponent(device, key, 'Light', settingsPayload[key] as ShellyData));
        if (key.startsWith('rgb:')) device.addComponent(new ShellyComponent(device, key, 'Rgb', settingsPayload[key] as ShellyData));
        if (key.startsWith('rgbw:')) device.addComponent(new ShellyComponent(device, key, 'Rgbw', settingsPayload[key] as ShellyData));
        if (key.startsWith('cct:')) device.addComponent(new ShellyComponent(device, key, 'Cct', settingsPayload[key] as ShellyData));
        if (key.startsWith('input:')) device.addComponent(new ShellyComponent(device, key, 'Input', settingsPayload[key] as ShellyData));
        if (key.startsWith('pm1:')) device.addComponent(new ShellyComponent(device, key, 'PowerMeter', settingsPayload[key] as ShellyData));
        if (key.startsWith('em1:')) device.addComponent(new ShellyComponent(device, key, 'PowerMeter', settingsPayload[key] as ShellyData));
        if (key.startsWith('em:')) device.addComponent(new ShellyComponent(device, key, 'PowerMeter', settingsPayload[key] as ShellyData));
        if (key.startsWith('temperature:')) device.addComponent(new ShellyComponent(device, key, 'Temperature', settingsPayload[key] as ShellyData));
        if (key.startsWith('humidity:')) device.addComponent(new ShellyComponent(device, key, 'Humidity', settingsPayload[key] as ShellyData));
        if (key.startsWith('illuminance:')) device.addComponent(new ShellyComponent(device, key, 'Illuminance', settingsPayload[key] as ShellyData));
        if (key.startsWith('smoke:')) device.addComponent(new ShellyComponent(device, key, 'Smoke', settingsPayload[key] as ShellyData));
        if (key.startsWith('thermostat:')) device.addComponent(new ShellyComponent(device, key, 'Thermostat', settingsPayload[key] as ShellyData));
        if (key.startsWith('devicepower:')) device.addComponent(new ShellyComponent(device, key, 'Devicepower', settingsPayload[key] as ShellyData));
      }

      // Scan for BTHome devices and components
      const btHomeComponents: BTHomeComponent[] = [];
      let btHomePayload: BTHomeComponentPayload;
      let offset = 0;
      do {
        btHomePayload = (await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetComponents', { dynamic_only: true, offset })) as unknown as BTHomeComponentPayload;
        if (btHomePayload && btHomePayload.components) {
          btHomeComponents.push(...btHomePayload.components);
          offset += btHomePayload.components.length;
        }
      } while (btHomePayload && offset < btHomePayload.total);
      componentsPayload = { components: btHomeComponents, cfg_rev: btHomePayload?.cfg_rev | 0, offset: 0, total: btHomeComponents.length };
      device.scanBTHomeComponents(btHomeComponents);
    }

    if (statusPayload) device.onUpdate(statusPayload);

    // For gen 1 devices check if CoIoT is enabled and peer is set correctly. First devices do not have this property.
    if (device.gen === 1) {
      const CoIoT = device.getComponent('coiot');
      if (CoIoT) {
        if (CoIoT.hasProperty('enabled') && (CoIoT.getValue('enabled') as boolean) === false)
          log.warn(
            `The CoIoT service is not enabled for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr}. Enable it in the web ui settings to receive updates from the device.`,
          );
        // When peer is mcast we get "" as value. First devices do not have this property.
        if (CoIoT.hasProperty('peer') && (CoIoT.getValue('peer') as string) !== '') {
          const peer = CoIoT.getValue('peer') as string;
          const ipv4 = shelly.ipv4Address + ':5683';
          if (peer !== ipv4)
            log.warn(
              `The CoIoT peer for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr} is not mcast or ${ipv4}. Set it in the web ui settings to receive updates from the device.`,
            );
        }
      } else {
        log.error(`CoIoT service not found for device ${dn}${device.name}${er} id ${hk}${device.id}${er}.`);
      }
    }

    // For gen 2+ battery powered devices check if WsServer is enabled and set correctly
    if (device.gen >= 2 && device.sleepMode === true) {
      const ws = device.getComponent('ws');
      if (ws) {
        if ((ws.getValue('enable') as boolean | undefined) === false) {
          log.warn(
            `The Outbound websocket settings is not enabled for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr}. Enable it in the web ui settings to receive updates from the device.`,
          );
        }
        const ipv4 = shelly.ipv4Address;
        const server = ws.getValue('server') as string | undefined;
        if (!server || !server.startsWith('ws://')) {
          log.warn(
            `The Outbound websocket settings is not configured correctly for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr}. The address must be ws:// (i.e. ws://${ipv4}:8485). Set it in the web ui settings to receive updates from the device.`,
          );
        }
        if (!server || !server.endsWith(':8485')) {
          log.warn(
            `The Outbound websocket settings is not configured correctly for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr}. The port must be 8485 (i.e. ws://${ipv4}:8485). Set it in the web ui settings to receive updates from the device.`,
          );
        }
        if (!server || !server.includes(ipv4 ?? '')) {
          log.warn(
            `The Outbound websocket settings is not configured correctly for device ${dn}${device.name}${wr} id ${hk}${device.id}${wr}. The ip must be the matterbridge ip (i.e. ws://${ipv4}:8485). Set it in the web ui settings to receive updates from the device.`,
          );
        }
      } else {
        log.error(`WebSocket server component not found for device ${dn}${device.name}${er} id ${hk}${device.id}${er}.`);
      }
    }

    // Check if the device has been calibrated
    if (device.gen === 1) {
      if (device.profile === 'cover') {
        const roller = device.getComponent('roller:0');
        const pos = roller?.hasProperty('current_pos') ? (roller?.getValue('current_pos') as number) : undefined;
        if (roller && pos && pos > 100) {
          device.log.notice(`Roller device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} does not have position control enabled.`);
        }
      }
    } else if (device.gen >= 2) {
      if (device.profile === 'cover') {
        const cover = device.getComponent('cover:0');
        // Check if the device has position control enabled
        if (cover && cover.getValue('pos_control') === false) {
          device.log.notice(`Cover device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} does not have position control enabled.`);
        }
      }
    }

    // Check if device has an available firmware update
    if (device.hasUpdate) log.notice(`Device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} has an available firmware update.`);

    // Start lastseen interval
    device.lastseenInterval = setInterval(() => {
      const lastSeenDate = new Date(device.lastseen);
      log.debug(
        `Device ${hk}${device.id}${db} host ${zb}${device.host}${db} online ${!device.online ? wr : CYAN}${device.online}${db} ` +
          `sleep mode ${device.sleepMode ? wr : CYAN}${device.sleepMode}${db} cached ${device.cached ? wr : CYAN}${device.cached}${db} ` +
          `${device.gen >= 2 && device.sleepMode === false && device.wsClient?.isConnected === false ? 'websocket ' + er + 'false ' + db : ''}` +
          `last seen ${CYAN}${lastSeenDate.toLocaleString()}${db}.`,
      );

      // Check WebSocket client for gen 2+ devices and restart if not connected
      if (device.gen >= 2 && !device.sleepMode && device.wsClient && device.wsClient.isConnected === false) {
        log.info(`WebSocket client for device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} is not connected. Starting connection...`);
        device.wsClient.start();
      }
    }, 60 * 1000);

    // Start WebSocket client for gen 2+ devices if not in sleep mode
    if (device.gen >= 2 && !device.sleepMode) {
      device.wsClient = new WsClient(device.id, host, shelly.password);

      // Start the WebSocket client for devices that are not a cache JSON file
      if (!host.endsWith('.json')) device.wsClient.start();

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      device.wsClient.on('response', (message) => {
        log.debug(`WebSocket response from device ${hk}${device.id}${db} host ${zb}${device.host}${db}`);
        device.lastseen = Date.now();
        if (!device.online) {
          device.online = true;
          device.emit('online');
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting online to true`);
        }
        if (device.cached) {
          device.cached = false;
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting cached to false`);
        }
      });

      device.wsClient.on('update', (params) => {
        log.debug(`WebSocket update from device ${hk}${device.id}${db} host ${zb}${device.host}${db}`);
        device.lastseen = Date.now();
        if (!device.online) {
          device.online = true;
          device.emit('online');
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting online to true`);
        }
        if (device.cached) {
          device.cached = false;
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting cached to false`);
        }
        device.onUpdate(params);
      });

      device.wsClient.on('event', (events) => {
        log.debug(`WebSocket event from device ${hk}${device.id}${db} host ${zb}${device.host}${db}`);
        device.lastseen = Date.now();
        if (!device.online) {
          device.online = true;
          device.emit('online');
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting online to true`);
        }
        if (device.cached) {
          device.cached = false;
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket message: setting cached to false`);
        }
        device.onEvent(events);
      });

      device.wsClient.on('error', (message: string) => {
        log.debug(`WebSocket error from device ${hk}${device.id}${db} host ${zb}${device.host}${db}: ${message}`);
        device.lastseen = Date.now();
        if (device.online) {
          device.online = false;
          device.emit('offline');
          log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} received a WebSocket error message: setting online to false`);
        }
      });
    }

    // Emitted when a sleepy device wakes up by WsServer and CoapServer (via Shelly.on('update')). We update the cache file and register the device with Coap.
    device.on('awake', async () => {
      log.debug(`Device ${hk}${device.id}${db} host ${zb}${device.host}${db} is awake (cached: ${device.cached}).`);
      const cached = device.cached;
      if (device.sleepMode) {
        try {
          device.lastFetched = Date.now();
          const awaken = await ShellyDevice.create(shelly, log, device.host);
          if (awaken) {
            if (device.gen === 1 && cached) shelly.coapServer.registerDevice(device.host, device.id, false); // No await to register device for CoIoT updates
            await awaken.saveDevicePayloads(shelly.dataPath);
            awaken.destroy();
          }
          log.debug(`Updated cache file for sleepy device ${hk}${device.id}${db} host ${zb}${device.host}${db}`);
        } catch (error) {
          log.debug(`Error saving device cache ${hk}${device.id}${db} host ${zb}${device.host}${db}: ${error instanceof Error ? error.message : error}`);
        }
      }
    });

    device.shellyPayload = shellyPayload;
    device.statusPayload = statusPayload;
    device.settingsPayload = settingsPayload;
    device.componentsPayload = componentsPayload;
    return device;
  }

  /**
   * Events handler from both WsClient (shellyDevice) and WsServer (shelly).
   *
   * @param {BTHomeEvent[]} events - The data to update the device with.
   *
   * @returns {void}
   */
  onEvent(events: ShellyEvent[]): void {
    for (const event of events) {
      if (isValidObject(event) && isValidString(event.event) && isValidNumber(event.ts) && isValidString(event.component) && event.component === 'bthome') {
        this.log.debug(`Device ${hk}${this.id}${db} has event ${YELLOW}${event.event}${db} at ${CYAN}${this.getLocalTimeFromLastUpdated(event.ts as number)}${db}`);
        this.emit('bthome_event', event);
      } else if (isValidObject(event) && isValidString(event.event) && isValidNumber(event.ts) && isValidString(event.component) && event.component.startsWith('bthomedevice:')) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const device = Array.from(this.bthomeDevices).find(([_addr, _device]) => _device.key === event.component)?.[1];
        if (device) {
          this.log.debug(
            `Device ${hk}${this.id}${db} has event ${YELLOW}${event.event}${db} at ${CYAN}${this.getLocalTimeFromLastUpdated(event.ts as number)}${db} ` +
              `from BTHomeDevice addr ${idn}${device.addr}${rs}${db} name ${CYAN}${device.name}${db} `,
          );
          this.emit('bthomedevice_event', device.addr, event);
        } else {
          this.log.debug(`*Unknown bthomedevice ${event.component} with event: ${debugStringify(event)}${rs}`);
        }
      } else if (isValidObject(event) && isValidString(event.event) && isValidNumber(event.ts) && isValidString(event.component) && event.component.startsWith('bthomesensor:')) {
        const sensor = this.bthomeSensors.get(event.component);
        if (sensor) {
          this.log.debug(
            `Device ${hk}${this.id}${db} has event ${YELLOW}${event.event}${db} at ${CYAN}${this.getLocalTimeFromLastUpdated(event.ts as number)}${db} ` +
              `from BTHomeSensor addr ${idn}${sensor.addr}${rs}${db} name ${CYAN}${sensor.name}${db} ` +
              `sensorId ${CYAN}${this.getBTHomeObjIdText(sensor.sensorId)}${db} (${CYAN}${sensor.sensorId}${db}) index ${CYAN}${sensor.sensorIdx}${db}`,
          );
          this.emit('bthomesensor_event', sensor.addr, this.getBTHomeObjIdText(sensor.sensorId), sensor.sensorIdx, event);
        } else {
          this.log.debug(`*Unknown bthomesensor ${event.component} with event: ${debugStringify(event)}${rs}`);
        }
      } else if (isValidObject(event) && isValidString(event.event) && isValidString(event.component)) {
        this.log.debug(`Device ${hk}${this.id}${db} has event ${YELLOW}${event.event}${db} from component ${idn}${event.component}${rs}${db}${rk} ${debugStringify(event)}`);
        this.getComponent(event.component)?.emit('event', event.component, event.event, event);
      } else {
        this.log.debug(`*Unknown event:${rs}\n`, event);
      }
    }

    this.lastseen = Date.now();
  }

  /**
   * Updates handler from both WsClient (shellyDevice) and WsServer (shelly).
   *
   * @param {ShellyData} data - The data to update the device with.
   *
   * @returns {void}
   */
  onUpdate(data: ShellyData): void {
    // Scan for BTHome devices and components
    for (const key in data) {
      if (key.startsWith('bthomedevice:')) {
        let device = undefined;
        for (const _device of this.bthomeDevices.values()) {
          if (_device.key === key) {
            device = _device;
          }
        }
        if (device) {
          const bthomeDevice = data[key] as BTHomeDeviceComponentStatus;
          this.log.debug(
            `Device ${hk}${this.id}${db} has device update from BTHomeDevice id ${CYAN}${device.id}${db} key ${CYAN}${device.key}${db} ` +
              `addr ${idn}${device.addr}${rs}${db} name ${CYAN}${device.name}${db} model ${CYAN}${device.model}${db} (${CYAN}${device.type}${db}) ` +
              `rssi ${CYAN}${bthomeDevice.rssi}${db} packet_id ${CYAN}${bthomeDevice.packet_id}${db} last_updated_ts ${CYAN}${this.getLocalTimeFromLastUpdated(bthomeDevice.last_updated_ts)}${db}`,
          );
          // this.log.debug(`- device update data:${rs}\n`, bthomeDevice);
          if (isValidNumber(bthomeDevice.rssi, -100, 0) || isValidNumber(bthomeDevice.last_updated_ts, 0)) {
            if (isValidNumber(bthomeDevice.rssi, -100, 0)) device.rssi = bthomeDevice.rssi;
            if (isValidNumber(bthomeDevice.last_updated_ts, 0)) device.last_updated_ts = bthomeDevice.last_updated_ts;
            this.emit('bthomedevice_update', device.addr, bthomeDevice.rssi, bthomeDevice.packet_id, bthomeDevice.last_updated_ts);
            // this.log.debug(`BTHome devices map:${rs}\n`, this.bthomeDevices);
          }
        } else {
          this.log.debug(`*Unknown bthomedevice ${key}`);
        }
      } else if (key.startsWith('bthomesensor:')) {
        const sensor = this.bthomeSensors.get(key);
        if (sensor) {
          const bthomeSensor = data[key] as BTHomeSensorComponentStatus;
          this.log.debug(
            `Device ${hk}${this.id}${db} has sensor update from BTHomeSensor id ${CYAN}${sensor.id}${db} key ${CYAN}${sensor.key}${db} ` +
              `addr ${idn}${sensor.addr}${rs}${db} name ${CYAN}${sensor.name}${db} ` +
              `sensorId ${CYAN}${this.getBTHomeObjIdText(sensor.sensorId)}${db} (${CYAN}${sensor.sensorId}${db}) index ${CYAN}${sensor.sensorIdx}${db} ` +
              `last update ${CYAN}${this.getLocalTimeFromLastUpdated(bthomeSensor.last_updated_ts)}${db}: ${YELLOW}${bthomeSensor.value}${db}`,
          );
          // this.log.debug(`- sensor update data:${rs}\n`, bthomeSensor);
          if (bthomeSensor.value !== undefined && bthomeSensor.value !== null) {
            sensor.value = bthomeSensor.value;
            this.emit('bthomesensor_update', sensor.addr, this.getBTHomeObjIdText(sensor.sensorId), sensor.sensorIdx, bthomeSensor.value);
            // this.log.debug(`BTHome sensors map:${rs}\n`, this.bthomeSensors);
          }
        } else {
          this.log.debug(`*Unknown bthomesensor ${key}`);
        }
      }
    }

    if (this.gen === 1) {
      // Update active components
      for (const key in data) {
        if (key === 'lights') {
          let index = 0;
          for (const light of data[key] as ShellyData[]) {
            this.updateComponent(`light:${index++}`, light as ShellyData);
          }
        }
        if (key === 'relays') {
          let index = 0;
          for (const relay of data[key] as ShellyData[]) {
            this.updateComponent(`relay:${index++}`, relay as ShellyData);
          }
        }
        if (key === 'rollers') {
          let index = 0;
          for (const roller of data[key] as ShellyData[]) {
            this.updateComponent(`roller:${index++}`, roller as ShellyData);
          }
        }
        if (key === 'inputs') {
          let index = 0;
          for (const input of data[key] as ShellyData[]) {
            this.updateComponent(`input:${index++}`, input as ShellyData);
          }
        }
        if (key === 'thermostats') {
          let index = 0;
          for (const thermostat of data[key] as ShellyData[]) {
            this.updateComponent(`thermostat:${index++}`, thermostat as ShellyData);
          }
        }
        if (key === 'meters') {
          let index = 0;
          for (const meter of data[key] as ShellyData[]) {
            if (this.profile === 'cover' && index > 0) break;
            this.updateComponent(`meter:${index++}`, meter as ShellyData);
          }
        }
        if (key === 'emeters') {
          let index = 0;
          for (const emeter of data[key] as ShellyData[]) {
            this.updateComponent(`emeter:${index++}`, emeter as ShellyData);
          }
        }

        if (key === 'bat') {
          const battery = this.getComponent('battery');
          battery?.setValue('level', data.bat ? ((data.bat as ShellyData).value as number) : 0);
          battery?.setValue('voltage', data.bat ? ((data.bat as ShellyData).voltage as number) : 0);
        }
        if (key === 'charger') {
          const battery = this.getComponent('battery');
          battery?.setValue('charging', data[key]);
        }
        if (key === 'sensor') {
          this.updateComponent(key, data[key] as ShellyData);
          // Change the state of the contact_open property of the sensor component
          const sensor = data.sensor as ShellyData;
          if (sensor.is_valid === true && sensor.state !== undefined) this.getComponent('sensor')?.setValue('contact_open', sensor.state !== 'close');
          if (sensor.vibration !== undefined) this.getComponent('vibration')?.setValue('vibration', sensor.vibration);
          // console.log('sensor', sensor);
        }
        if (key === 'accel') {
          const accel = data.accel as ShellyData;
          // this.log.debug(`***Device ${this.id} has accel data ${accel.vibration}`);
          if (accel.vibration !== undefined) this.getComponent('vibration')?.setValue('vibration', accel.vibration === 1);
        }
        if (key === 'lux') {
          this.updateComponent(key, data[key] as ShellyData);
        }
        if (key === 'flood') {
          if (typeof data[key] === 'boolean') this.getComponent('flood')?.setValue('flood', data[key]);
        }
        if (key === 'gas_sensor') {
          this.updateComponent('gas', data[key] as ShellyData);
        }
        if (key === 'concentration') {
          this.updateComponent('gas', data[key] as ShellyData);
        }
        if (key === 'ext_temperature' && isValidObject(data[key], 1)) {
          this.updateComponent('temperature', data[key] as ShellyData);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sensor = (data[key] as any)['0'] as ShellyData;
          if (sensor && isValidNumber(sensor.tC, -55, 125)) this.getComponent('temperature')?.setValue('value', sensor.tC);
        }
        if (key === 'ext_humidity' && isValidObject(data[key], 1)) {
          this.updateComponent('humidity', data[key] as ShellyData);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sensor = (data[key] as any)['0'] as ShellyData;
          if (sensor && isValidNumber(sensor.hum, 0, 100)) this.getComponent('humidity')?.setValue('value', sensor.hum);
        }
        if (key === 'tmp') {
          if (data.temperature === undefined && data.overtemperature === undefined) this.updateComponent('temperature', data[key] as ShellyData);
          const sensor = data.tmp as ShellyData;
          if (sensor.is_valid === true && sensor.units === 'C' && isValidNumber(sensor.tC, -55, 125)) this.getComponent('temperature')?.setValue('value', sensor.tC);
          if (sensor.is_valid === true && sensor.units === 'F' && isValidNumber(sensor.tF, -67, 257)) this.getComponent('temperature')?.setValue('value', sensor.tF);
        }
        if (key === 'hum') {
          this.updateComponent('humidity', data[key] as ShellyData);
          const sensor = data.hum as ShellyData;
          if (sensor.is_valid === true && isValidNumber(sensor.value, 0, 100)) this.getComponent('humidity')?.setValue('value', sensor.value);
        }
        if (key === 'temperature') {
          if (data[key] !== null && data[key] !== undefined && typeof data[key] === 'number') this.getComponent('sys')?.setValue('temperature', data[key]);
        }
        if (key === 'overtemperature') {
          if (data[key] !== null && data[key] !== undefined && typeof data[key] === 'boolean') this.getComponent('sys')?.setValue('overtemperature', data[key]);
        }
      }
      // Update state for active components with ison and gain
      for (const key in data) {
        if (key === 'lights' || key === 'relays') {
          let index = 0;
          for (const light of data[key] as ShellyData[]) {
            const component = this.getComponent(`${key.slice(0, 5)}:${index++}`);
            if (!component) this.log.debug(`***Component ${key.slice(0, 5)}:${index} not found`);
            if (component && light.ison !== undefined) component.setValue('state', light.ison as boolean);
            if (component && light.gain !== undefined) component.setValue('brightness', light.gain as number); // gain is used by color channels and brightness by white channels
          }
        }
      }
    } else if (this.gen >= 2) {
      // Update passive components
      for (const key in data) {
        if (key === 'sys') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'eth') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'matter') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'cloud') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'mqtt') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'ws') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'ble') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'blugw') this.updateComponent(key, data[key] as ShellyData);
      }
      // Update active components
      for (const key in data) {
        if (key.startsWith('switch:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('cover:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('light:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('rgb:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('rgbw:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('cct:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('input:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('pm1:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('em1:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('em1data:')) this.updateComponent(key.replace('em1data:', 'em1:'), data[key] as ShellyData);
        if (key.startsWith('em:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('emdata:')) this.updateComponent(key.replace('emdata:', 'em:'), data[key] as ShellyData);
        if (key.startsWith('temperature:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('humidity:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('illuminance:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('smoke:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('thermostat:')) this.updateComponent(key, data[key] as ShellyData);

        if (key.startsWith('devicepower:') && !this.hasComponent(key)) this.addComponent(new ShellyComponent(this, key, 'Devicepower'));
        if (key.startsWith('devicepower:')) this.updateComponent(key, data[key] as ShellyData);
      }
      // Update state for active components with output
      for (const key in data) {
        if (key.startsWith('light:') || key.startsWith('rgb:') || key.startsWith('rgbw:') || key.startsWith('cct:') || key.startsWith('switch:')) {
          const componentData = data[key] as ShellyData;
          const component = this.getComponent(key);
          if (component && componentData.output !== undefined && typeof componentData.output === 'boolean') component.setValue('state', componentData.output);
        }
      }
    }

    this.lastseen = Date.now();
  }

  /**
   * Fetches the update for the Shelly device.
   *
   * @returns {Promise<ShellyData | null>} A Promise that resolves to the updated ShellyData or null if no data is found.
   */
  async fetchUpdate(): Promise<ShellyData | null> {
    this.shellyPayload = await ShellyDevice.fetch(this.shelly, this.log, this.host, 'shelly');
    if (!this.shellyPayload) {
      if (this.online) {
        this.log.warn(`Error fetching shelly from device ${hk}${this.id}${wr} host ${zb}${this.host}${wr}. No data found.`);
        this.online = false;
        this.emit('offline');
      }
      return null;
    }
    this.settingsPayload = await ShellyDevice.fetch(this.shelly, this.log, this.host, this.gen === 1 ? 'settings' : 'Shelly.GetConfig');
    if (!this.settingsPayload) {
      if (this.online) {
        this.log.warn(`Error fetching settings from device ${hk}${this.id}${wr} host ${zb}${this.host}${wr}. No data found.`);
        this.online = false;
        this.emit('offline');
      }
      return null;
    }
    this.statusPayload = await ShellyDevice.fetch(this.shelly, this.log, this.host, this.gen === 1 ? 'status' : 'Shelly.GetStatus');
    if (!this.statusPayload) {
      if (this.online) {
        this.log.warn(`Error fetching status from device ${hk}${this.id}${wr} host ${zb}${this.host}${wr}. No data found.`);
        this.online = false;
        this.emit('offline');
      }
      return null;
    }
    if (this.gen >= 2) {
      const btHomeComponents: BTHomeComponent[] = [];
      let btHomePayload: BTHomeComponentPayload;
      let offset = 0;
      do {
        btHomePayload = (await ShellyDevice.fetch(this.shelly, this.log, this.host, 'Shelly.GetComponents', { dynamic_only: true, offset })) as unknown as BTHomeComponentPayload;
        if (btHomePayload && btHomePayload.components) {
          btHomeComponents.push(...btHomePayload.components);
          offset += btHomePayload.components.length;
        }
      } while (btHomePayload && offset < btHomePayload.total);
      this.componentsPayload = { components: btHomeComponents, cfg_rev: btHomePayload?.cfg_rev | 0, offset: 0, total: btHomeComponents.length };
    }
    this.lastseen = Date.now();
    if (this.cached) {
      this.cached = false;
    }
    if (!this.online) {
      this.log.info(`The device ${hk}${this.id}${nf} host ${zb}${this.host}${nf} is online.`);
      this.online = true;
      this.emit('online');
    }
    this.onUpdate(this.statusPayload);
    return this.statusPayload;
  }

  // Gen 1
  // http://192.168.1.219/light/0
  // http://192.168.1.219/light/0?turn=on
  // http://192.168.1.219/light/0?turn=off
  // http://192.168.1.219/light/0?turn=toggle

  // Gen 2 and 3 legacy
  // http://192.168.1.217/relay/0
  // http://192.168.1.217/relay/0?turn=on
  // http://192.168.1.217/relay/0?turn=off
  // http://192.168.1.217/relay/0?turn=toggle

  // http://192.168.1.218/roller/0
  // http://192.168.1.218/roller/0?go=open
  // http://192.168.1.218/roller/0?go=close
  // http://192.168.1.218/roller/0?go=stop

  // Gen 2 and 3 rpc
  // http://192.168.1.218/rpc/Switch.GetStatus?id=0
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=true
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=false
  // http://192.168.1.218/rpc/Switch.Toggle?id=0

  // Scan the gateway device for BLU devices (http://IP/rpc/Shelly.GetComponents?dynamic_only=true)
  /*
  Method: BluTrv.Call params: { id: 200, method: Trv.SetTarget, params: { id: 0 target_C: 15 } }
  http://192.168.1.164/rpc/BluTrv.Call?id=200&method=Trv.SetTarget&params={id:0,target_C:15}
  
  http://192.168.1.164/rpc/BTHomeDevice.GetStatus
  http://192.168.1.164/rpc/BTHomeDevice.GetStatus?id=200
  {
      "id": 200,
      "rssi": -47,
      "battery": 100,
      "packet_id": 15,
      "last_updated_ts": 1728055911,
      "paired": true,
      "rpc": true,
      "rsv": 1
  }
  http://192.168.1.164/rpc/BTHomeDevice.GetKnownObjects?id=200
  {
      "id": 200,
      "objects": [
          {
              "obj_id": 84,
              "idx": 0,
              "component": null
          },
          {
              "obj_id": 1,
              "idx": 0,
              "component": "bthomesensor:200"
          },
          {
              "obj_id": 58,
              "idx": 0,
              "component": "bthomesensor:201"
          },
          {
              "obj_id": 69,
              "idx": 0,
              "component": "bthomesensor:202"
          },
          {
              "obj_id": 69,
              "idx": 1,
              "component": "bthomesensor:203"
          }
      ]
  }
  http://192.168.1.164/rpc/BTHomeSensor.GetStatus?id=202:
  {
    "id": 202,
    "value": 10.2,
    "last_updated_ts": 1728055839
  }
  */

  /**
   * Fetches device data from the specified host and service.
   * If the host ends with '.json', it fetches the device data from a file.
   * Otherwise, it makes an HTTP request to the specified host and service.
   * Supports both Gen 1 and Gen 2 devices.
   *
   * @param {Shelly} shelly - The Shelly instance.
   * @param {AnsiLogger} log - The logger instance.
   * @param {string} host - The host to fetch the data from.
   * @param {string} service - The service to fetch the data from.
   * @param {Record<string, string | number | boolean>} params - Additional parameters for the request (default: {}).
   * @returns A promise that resolves to the fetched device data or null if an error occurs.
   */
  static async fetch(shelly: Shelly, log: AnsiLogger, host: string, service: string, params: Record<string, string | number | boolean | object> = {}): Promise<ShellyData | null> {
    // Fetch device data from cache file if host is a json file
    if (host.endsWith('.json')) {
      log.debug(`Fetching device payloads from file ${host}: service ${service} params ${JSON.stringify(params)}`);
      try {
        let data = await fs.readFile(host, 'utf8');
        const deviceData = JSON.parse(data);
        data = '';
        if (service === 'shelly') return deviceData.shelly;
        if (service === 'status') return deviceData.status;
        if (service === 'settings') return deviceData.settings;
        if (service === 'Shelly.GetStatus') return deviceData.status;
        if (service === 'Shelly.GetConfig') return deviceData.settings;
        if (service === 'Shelly.GetComponents') return deviceData;
        log.error(`Error fetching device payloads from file ${host}: no service ${service} found`);
      } catch (error) {
        log.error(`Error reading device payloads from file ${host}:`, error instanceof Error ? error.message : error);
        return null;
      }
    }

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => {
      controller.abort();
      log.debug(`***Aborting fetch device ${host}: service ${service} params ${JSON.stringify(params)}`);
    }, 20000);

    const gen = /^[^A-Z]*$/.test(service) ? 1 : 2;
    const url = gen === 1 ? `http://${host}/${service}` : `http://${host}/rpc`;
    try {
      const options: RequestInit = {
        method: 'POST',
        headers: gen === 1 ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' },
        body: gen === 1 ? getGen1BodyOptions(params) : getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params),
        signal: controller.signal,
      };
      const headers = options.headers as Record<string, string>;
      log.debug(
        `${GREY}Fetching shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}` +
          `${params ? ` with ${CYAN}` + JSON.stringify(params) + `${GREY}` : ''} url ${BLUE}${url}${RESET}`,
      );
      log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
      let response;
      if (service === 'shelly') response = await fetch(`http://${host}/${service}`, { signal: controller.signal });
      else response = await fetch(url, options);
      clearTimeout(fetchTimeout);
      log.debug(`${GREY}response ok: ${response.ok}${RESET}`);
      if (!response.ok) {
        // Try with authentication
        if (response.status === 401) {
          const authHeader = response.headers.get('www-authenticate');
          log.debug(`${GREY}authHeader: ${authHeader}${RESET}`);
          if (authHeader === null) throw new Error('No www-authenticate header found');
          if (shelly.username === undefined || shelly.username === '') log.error(`Device at host ${host} requires authentication but no username has been provided in the config`);
          if (shelly.password === undefined || shelly.password === '') log.error(`Device at host ${host} requires authentication but no password has been provided in the config`);
          if (authHeader.startsWith('Basic')) {
            // Gen 1 devices require basic authentication
            const authParams = parseBasicAuthenticateHeader(authHeader); // Get nonce and realm
            log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
            if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
            const auth = createBasicShellyAuth(shelly.username ?? '', shelly.password ?? '');
            headers.Authorization = `Basic ${auth}`;
          } else if (authHeader.startsWith('Digest')) {
            // Gen 2 and 3 devices require digest authentication
            const authParams = parseDigestAuthenticateHeader(authHeader); // Get nonce and realm
            log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
            if (!authParams.nonce) throw new Error('No authenticate nonce parameter found in header');
            if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
            const auth = createDigestShellyAuth('admin', shelly.password ?? '', parseInt(authParams.nonce), crypto.randomInt(0, 999999999), authParams.realm);
            options.body = getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params, auth);
          }
          log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
          response = await fetch(url, options);
          log.debug(`${GREY}response ok: ${response.ok}${RESET}`);
          if (response.ok) {
            const data = await response.json();
            const reponse = gen === 1 ? data : (data as ShellyData).result;
            // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
            return reponse as ShellyData;
          }
        }
        log.error(
          `Response error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url}:` +
            ` ${response.status} (${response.statusText})`,
        );
        clearTimeout(fetchTimeout);
        return null;
      }
      const data = await response.json();
      const reponse = gen === 1 ? data : (data as ShellyData).result;
      // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
      return reponse as ShellyData;
    } catch (error) {
      log.debug(
        `Error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url} error: ${error instanceof Error ? error.message : error}`,
      );
      clearTimeout(fetchTimeout);
      return null;
    }
  }

  /**
   * Logs all components and properties of the Shelly device.
   */
  logDevice() {
    // Log the device
    this.log.debug(
      `Shelly device ${MAGENTA}${this.id}${db} (${this.model}) gen ${BLUE}${this.gen}${db} name ${BLUE}${this.name}${db} mac ${BLUE}${this.mac}${db} host ${BLUE}${this.host}${db} profile ${BLUE}${this.profile}${db} firmware ${BLUE}${this.firmware}${db} auth ${BLUE}${this.auth}${db} online ${BLUE}${this.online}${db} lastseen ${BLUE}${this.lastseen}${db}`,
    );
    for (const [key, component] of this) {
      this.log.debug(`- ${GREEN}${component.name}${db} (${BLUE}${key}${db})`);
      for (const [key, property] of component) {
        this.log.debug(`  - ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
      }
    }
    return this._components.size;
  }

  /**
   * Saves the device payloads (shelly, settings, status) to the specified data path.
   * @param {string} dataPath - The path where the device payloads will be saved.
   * @returns {Promise<boolean>} - A promise that resolves when the device payloads are successfully saved, or rejects with an error if there was an issue.
   */
  async saveDevicePayloads(dataPath: string): Promise<boolean> {
    this.log.debug(`Saving device payloads for ${hk}${this.id}${db} host ${zb}${this.host}${db}`);
    if (this.shellyPayload && this.statusPayload && this.settingsPayload) {
      try {
        await fs.mkdir(dataPath, { recursive: true });
        this.log.debug(`Successfully created directory ${dataPath}`);

        const deviceData = {
          shelly: this.shellyPayload,
          settings: this.settingsPayload,
          status: this.statusPayload,
          components: this.componentsPayload ? this.componentsPayload.components : [],
          cfg_rev: this.componentsPayload ? this.componentsPayload.cfg_rev : 0,
          offset: this.componentsPayload ? this.componentsPayload.offset : 0,
          total: this.componentsPayload ? this.componentsPayload.total : 0,
        };
        // Remove sensitive data for Gen 1 devices
        if (this.gen === 1) {
          deviceData.settings.timezone = null;
          deviceData.settings.lat = null;
          deviceData.settings.lng = null;
          if (deviceData.settings.wifi_ap) (deviceData.settings.wifi_ap as ShellyData).ssid = '';
          if (deviceData.settings.wifi_sta) (deviceData.settings.wifi_sta as ShellyData).ssid = '';
          if (deviceData.settings.wifi_sta1) (deviceData.settings.wifi_sta1 as ShellyData).ssid = '';
          if (deviceData.status.wifi_ap) (deviceData.status.wifi_ap as ShellyData).ssid = '';
          if (deviceData.status.wifi_sta) (deviceData.status.wifi_sta as ShellyData).ssid = '';
          if (deviceData.status.wifi_sta1) (deviceData.status.wifi_sta1 as ShellyData).ssid = '';
        }
        // Remove sensitive data for Gen 2+
        if (this.gen >= 2) {
          if (deviceData.settings.sys) (deviceData.settings.sys as ShellyData).location = null;
          if (deviceData.settings.wifi) {
            const wifi = deviceData.settings.wifi as ShellyData;
            if (wifi.ap) (wifi.ap as ShellyData).ssid = '';
            if (wifi.sta) (wifi.sta as ShellyData).ssid = '';
            if (wifi.sta1) (wifi.sta1 as ShellyData).ssid = '';
          }
          if (deviceData.status.wifi) (deviceData.status.wifi as ShellyData).ssid = '';
        }
        const data = JSON.stringify(deviceData, null, 2);
        await fs.writeFile(path.join(dataPath, `${this.id}.json`), data, 'utf8');
        this.log.debug(`Successfully wrote to ${path.join(dataPath, `${this.id}.json`)}`);
        return true;
      } catch (error) {
        this.log.error(`Error saving device payloads in the directory ${dataPath} file ${path.join(dataPath, `${this.id}.json`)}:`, error);
        return false;
      }
    }
    this.log.error(`Error saving device payloads in the directory ${dataPath} file ${path.join(dataPath, `${this.id}.json`)}: no data`);
    return false;
  }
}
