/**
 * This file contains the class ShellyDevice.
 *
 * @file src\shellyDevice.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 2.1.0
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

import { AnsiLogger, LogLevel, BLUE, CYAN, GREEN, GREY, MAGENTA, RESET, db, debugStringify, er, hk, nf, wr, zb, rs, YELLOW, idn, nt } from 'matterbridge/logger';
import { getIpv4InterfaceAddress } from 'matterbridge/utils';
import { EventEmitter } from 'events';
import fetch, { RequestInit } from 'node-fetch';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import { parseDigestAuthenticateHeader, createDigestShellyAuth, createBasicShellyAuth, parseBasicAuthenticateHeader, getGen2BodyOptions, getGen1BodyOptions } from './auth.js';

import { WsClient } from './wsClient.js';
import { Shelly } from './shelly.js';
import { BTHomeComponent, BTHomeDeviceComponent, BTHomeEvent, BTHomeSensorComponent, BTHomeStatusDevice, BTHomeStatusSensor, ShellyData, ShellyDataType } from './shellyTypes.js';
import { ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';
import { isValidNumber } from './platform.js';

interface ShellyDeviceEvent {
  online: [];
  offline: [];
  update: [id: string, key: string, value: ShellyDataType];
  bthomedevice_update: [addr: string, rssi: number, last_updated_ts: number];
  bthomesensor_update: [addr: string, sensor: string, value: ShellyDataType];
  bthomesensor_event: [addr: string, sensor: string, event: string];
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
  profile: 'switch' | 'cover' | 'rgb' | 'rgbw' | 'color' | 'white' | undefined = undefined;
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
  hasUpdate = false;
  sleepMode = false;
  cached = false;

  colorUpdateTimeout?: NodeJS.Timeout;
  colorCommandTimeout?: NodeJS.Timeout;
  private lastseenInterval?: NodeJS.Timeout;
  private startWsClientTimeout?: NodeJS.Timeout;

  private wsClient: WsClient | undefined;

  private readonly _components = new Map<string, ShellyComponent>();

  private shellyPayload: ShellyData | null = null;
  private statusPayload: ShellyData | null = null;
  private settingsPayload: ShellyData | null = null;
  private componentsPayload: ShellyData | null = null;
  readonly bthomeDevices = new Map<string, { id: number; key: string; name: string; addr: string; model: string; type: string; rssi: number }>();
  readonly bthomeSensors = new Map<string, { id: number; key: string; name: string; addr: string; sensorId: number; value?: ShellyDataType }>();

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
    if (this.lastseenInterval) clearInterval(this.lastseenInterval);
    this.lastseenInterval = undefined;
    this.lastseen = 0;
    if (this.startWsClientTimeout) clearTimeout(this.startWsClientTimeout);
    this.startWsClientTimeout = undefined;
    this.wsClient?.stop();

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
  getComponent(id: string): ShellyComponent | ShellyLightComponent | ShellySwitchComponent | ShellyCoverComponent | undefined {
    const component = this._components.get(id);
    if (!component) return undefined;
    else if (component.isSwitchComponent()) return component as ShellySwitchComponent;
    else if (component.isLightComponent()) return component as ShellyLightComponent;
    else if (component.isCoverComponent()) return component as ShellyCoverComponent;
    else return component as ShellyComponent;
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
    } else this.log.error(`****Component ${id} not found in device ${GREEN}${this.id}${er} (${BLUE}${this.name}${er})`);

    return undefined;
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
   * Sets the log level for the device.
   * @param {LogLevel} logLevel - The log level to set.
   */
  setLogLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
    // if (this.wsClient) this.wsClient.log.logLevel = logLevel;
  }

  /**
   * Normalizes the given hostname to extract the type, MAC address, and ID.
   *
   * @param {string} hostname - The hostname to normalize.
   * @returns { type: string; mac: string; id: string } An object containing the normalized type, MAC address, and ID.
   */
  static normalizeId(hostname: string): { type: string; mac: string; id: string } {
    const match = hostname.match(/^(.*)-([0-9A-F]+)$/i);
    if (match) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_, type, mac] = match;
      const id = type.toLowerCase() + '-' + mac.toUpperCase();
      return { type, mac, id };
    }
    return { type: '', mac: '', id: hostname };
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
    return objIdsMap[objId] || `Sensor Id unknown ${objId}`;
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
    };
    return modelsMap[model] || `Shelly BLU unknown model ${model}`;
  }

  scanBTHomeComponent(components: BTHomeComponent[]) {
    if (components.length > 0) this.log.debug(`Scanning the device ${zb}${this.host}${db} for BTHome devices and sensors...`);
    for (const component of components as unknown as BTHomeDeviceComponent[]) {
      if (component.key.startsWith('bthomedevice:')) {
        this.log.debug(
          `- BLU device id ${CYAN}${component.status.id}${db} key ${CYAN}${component.key}${db} address ${CYAN}${component.config.addr}${db} ` +
            `name ${CYAN}${component.config.name ?? `${this.getBTHomeModelText(component.config.meta.ui.local_name)} ` + component.config.addr}${db} ` +
            `model ${CYAN}${this.getBTHomeModelText(component.config.meta.ui.local_name)}${db} ` +
            `type ${CYAN}${component.config.meta.ui.local_name}${db} rssi ${CYAN}${component.status.rssi}${db}`,
        );
        this.bthomeDevices.set(component.config.addr, {
          id: component.config.id,
          key: component.key,
          addr: component.config.addr,
          name: component.config.name ?? `${this.getBTHomeModelText(component.config.meta.ui.local_name)} ` + component.config.addr,
          model: this.getBTHomeModelText(component.config.meta.ui.local_name),
          type: component.config.meta.ui.local_name,
          rssi: component.status.rssi,
        });
      }
    }
    for (const component of components as unknown as BTHomeSensorComponent[]) {
      if (component.key.startsWith('bthomesensor:')) {
        this.log.debug(
          `- BLU sensor id ${CYAN}${component.status.id}${db} key ${CYAN}${component.key}${db} address ${CYAN}${component.config.addr}${db} ` +
            `name ${CYAN}${component.config.name ?? this.getBTHomeObjIdText(component.config.obj_id)}${db} ` +
            `value ${CYAN}${component.status.value}${db} ` +
            `sensor ${CYAN}${this.getBTHomeObjIdText(component.config.obj_id)}${db} ${CYAN}(${component.config.obj_id}${db})`,
        );
        this.bthomeSensors.set(component.key, {
          id: component.config.id,
          key: component.key,
          name: component.config.name ?? this.getBTHomeObjIdText(component.config.obj_id),
          addr: component.config.addr,
          sensorId: component.config.obj_id,
        });
      }
    }
    if (this.bthomeDevices.size > 0) this.log.debug(`BTHome devices map:${rs}\n`, this.bthomeDevices);
    if (this.bthomeSensors.size > 0) this.log.debug(`BTHome sensors map:${rs}\n`, this.bthomeSensors);
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
    const shellyPayload = await ShellyDevice.fetch(shelly, log, host, 'shelly');
    let statusPayload: ShellyData | null = null;
    let settingsPayload: ShellyData | null = null;
    let componentsPayload: ShellyData | null = null;

    if (!shellyPayload) {
      log.debug(`****Error creating device at host ${zb}${host}${db}. No shelly data found.`);
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
    if (shellyPayload.profile !== undefined) device.profile = shellyPayload.profile as 'switch' | 'cover' | 'rgb' | 'rgbw' | 'color' | 'white' | undefined;

    // Gen 1 Shelly device
    if (!shellyPayload.gen) {
      statusPayload = await ShellyDevice.fetch(shelly, log, host, 'status');
      settingsPayload = await ShellyDevice.fetch(shelly, log, host, 'settings');
      if (!statusPayload || !settingsPayload) {
        log.debug(`****Error creating device gen 1 from host ${zb}${host}${db}. No data found.`);
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
        }
        if (key === 'relays' && device.profile !== 'cover') {
          let index = 0;
          for (const relay of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(device, `relay:${index++}`, 'Relay', relay as ShellyData));
          }
        }
        if (key === 'rollers' && device.profile !== 'switch') {
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
      }
      for (const key in statusPayload) {
        if (key === 'temperature') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'overtemperature') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'tmp' && statusPayload.temperature === undefined && statusPayload.overtemperature === undefined) {
          device.addComponent(new ShellyComponent(device, 'temperature', 'Temperature'));
        }
        if (key === 'voltage') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'mode') device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
        if (key === 'bat') device.addComponent(new ShellyComponent(device, 'battery', 'Battery'));
        if (key === 'charger') device.addComponent(new ShellyComponent(device, 'battery', 'Battery'));
        if (key === 'lux') device.addComponent(new ShellyComponent(device, 'lux', 'Lux'));
        if (key === 'flood') device.addComponent(new ShellyComponent(device, 'flood', 'Flood'));
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
    }

    // Gen 2 Shelly device
    if (shellyPayload.gen === 2 || shellyPayload.gen === 3) {
      statusPayload = await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetStatus');
      settingsPayload = await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetConfig');
      if (!statusPayload || !settingsPayload) {
        log.debug(`****Error creating device gen 2 from host ${zb}${host}${db}. No data found.`);
        return undefined;
      }
      // Scan for BTHome devices and components
      componentsPayload = await ShellyDevice.fetch(shelly, log, host, 'Shelly.GetComponents');
      if (componentsPayload && componentsPayload.components) {
        const btHomeComponents = componentsPayload.components as BTHomeComponent[];
        device.scanBTHomeComponent(btHomeComponents);
      }
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
        if (key === 'mqtt') device.addComponent(new ShellyComponent(device, key, 'MQTT', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ws') device.addComponent(new ShellyComponent(device, key, 'WS', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'cloud') device.addComponent(new ShellyComponent(device, key, 'Cloud', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ble') device.addComponent(new ShellyComponent(device, key, 'Ble', settingsPayload[key] as ShellyData)); // Ok
        if (key === 'eth') device.addComponent(new ShellyComponent(device, key, 'Eth', settingsPayload[key] as ShellyData)); // Ok
        if (key.startsWith('switch:')) device.addComponent(new ShellyComponent(device, key, 'Switch', settingsPayload[key] as ShellyData));
        if (key.startsWith('cover:')) device.addComponent(new ShellyComponent(device, key, 'Cover', settingsPayload[key] as ShellyData));
        if (key.startsWith('light:')) device.addComponent(new ShellyComponent(device, key, 'Light', settingsPayload[key] as ShellyData));
        if (key.startsWith('rgb:')) device.addComponent(new ShellyComponent(device, key, 'Rgb', settingsPayload[key] as ShellyData));
        if (key.startsWith('rgbw:')) device.addComponent(new ShellyComponent(device, key, 'Rgbw', settingsPayload[key] as ShellyData));
        if (key.startsWith('input:')) device.addComponent(new ShellyComponent(device, key, 'Input', settingsPayload[key] as ShellyData));
        if (key.startsWith('pm1:')) device.addComponent(new ShellyComponent(device, key, 'PowerMeter', settingsPayload[key] as ShellyData));
        if (key.startsWith('em1:')) device.addComponent(new ShellyComponent(device, key, 'PowerMeter', settingsPayload[key] as ShellyData));
      }
    }

    if (statusPayload) device.onUpdate(statusPayload);

    // For gen 1 devices check if CoIoT is enabled and peer is set correctly: like <matterbridge-ipv4>:5683 e.g. 192.168.1.189:5683
    if (device.gen === 1) {
      const CoIoT = device.getComponent('coiot');
      if (CoIoT) {
        if ((CoIoT.getValue('enabled') as boolean) === false)
          log.notice(`CoIoT is not enabled for device ${device.name} id ${device.id}. Enable it in the settings to receive updates from the device.`);
        // When peer is mcast we get "" as value
        if ((CoIoT.getValue('peer') as string) !== '') {
          const peer = CoIoT.getValue('peer') as string;
          const ipv4 = getIpv4InterfaceAddress() + ':5683';
          if (peer !== ipv4) log.notice(`CoIoT peer for device ${device.name} id ${device.id} is not mcast or ${ipv4}. Set it in the settings to receive updates from the device.`);
        }
      } else {
        log.error(`CoIoT service not found for device ${device.name} id ${device.id}.`);
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
    } else if (device.gen === 2 || device.gen === 3) {
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
      // Check lastseen interval
      const lastSeenDate = new Date(device.lastseen);
      const lastSeenDateString = lastSeenDate.toLocaleString();
      if (!device.sleepMode && Date.now() - device.lastseen > 10 * 60 * 1000) {
        log.info(`Fetching update for device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} cached ${CYAN}${device.cached}${db}.`);
        device.fetchUpdate(); // We don't await for the update to complete
      } else {
        log.debug(
          `Device ${hk}${device.id}${db} host ${zb}${device.host}${db} online ${!device.online ? wr : CYAN}${device.online}${db} sleep mode ${device.sleepMode ? wr : CYAN}${device.sleepMode}${db} cached ${device.cached ? wr : CYAN}${device.cached}${db} has been seen the last time: ${CYAN}${lastSeenDateString}${db}.`,
        );
      }

      // Check WebSocket client for gen 2 and 3 devices
      if (device.gen === 2 || device.gen === 3) {
        if (device.wsClient?.isConnected === false) {
          log.notice(`WebSocket client for device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is not connected. Starting connection...`);
          device.wsClient?.start();
        }
      }
    }, 60 * 1000);

    // Start WebSocket client for gen 2 and 3 devices
    if (device.gen === 2 || device.gen === 3) {
      device.wsClient = new WsClient(device.id, host, shelly.password);
      device.startWsClientTimeout = setTimeout(() => {
        // Start WebSocket client after 10 seconds only if it's not a cached device. Will try it in the last seen interval.
        if (!host.endsWith('.json')) device.wsClient?.start();
      }, 10 * 1000);

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

      device.wsClient.on('update', (message) => {
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
        device.onUpdate(message);
      });

      device.wsClient.on('event', (events: BTHomeEvent[]) => {
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
    }

    device.shellyPayload = shellyPayload;
    device.statusPayload = statusPayload;
    device.settingsPayload = settingsPayload;
    device.componentsPayload = componentsPayload;
    return device;
  }

  /**
   * Event handler from device WsClient.
   *
   * @param {BTHomeEvent[]} events - The data to update the device with.
   *
   * @returns {void}
   */
  onEvent(events: BTHomeEvent[]): void {
    for (const event of events) {
      if (event.component.startsWith('bthomesensor:')) {
        const sensor = this.bthomeSensors.get(event.component);
        if (sensor) {
          this.log.debug(
            `****Device ${hk}${this.id}${db} has event ${YELLOW}${event.event}${db} from BTHomeSensor addr ${idn}${sensor.addr}${rs}${db} ` +
              `name ${CYAN}${sensor.name}${db} sensorId ${CYAN}${this.getBTHomeObjIdText(sensor.sensorId)}${db} (${CYAN}${sensor.sensorId}${db})`,
          );
          this.emit('bthomesensor_event', sensor.addr, this.getBTHomeObjIdText(sensor.sensorId), event.event);
        }
      }
    }

    this.lastseen = Date.now();
  }

  /**
   * Updates the device with the provided data.
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
          const bthomeDevice = data[key] as BTHomeStatusDevice;
          this.log.debug(
            `****Device ${hk}${this.id}${db} has device update from BTHomeDevice id ${CYAN}${device.id}${db} key ${CYAN}${device.key}${db} ` +
              `addr ${idn}${device.addr}${rs}${db} name ${device.name} model ${device.model} (${device.type}) rssi ${YELLOW}${bthomeDevice.rssi}${db}`,
          );
          if (isValidNumber(bthomeDevice.rssi)) {
            device.rssi = bthomeDevice.rssi;
            this.log.debug(`****Device ${hk}${this.id}${db} has updated rssi ${YELLOW}${device.rssi}${db} for BTHomeDevice id ${CYAN}${device.key}${db}`);
            this.emit('bthomedevice_update', device.addr, bthomeDevice.rssi, bthomeDevice.last_updated_ts);
            // this.log.debug(`BTHome devices map:${rs}\n`, this.bthomeDevices);
          }
        }
      } else if (key.startsWith('bthomesensor:')) {
        const sensor = this.bthomeSensors.get(key);
        if (sensor) {
          const bthomeSensor = data[key] as BTHomeStatusSensor;
          this.log.debug(
            `****Device ${hk}${this.id}${db} has sensor update from BTHomeSensor id ${CYAN}${sensor.id}${db} key ${CYAN}${sensor.key}${db} ` +
              `addr ${idn}${sensor.addr}${rs}${db} name ${CYAN}${sensor.name}${db} ` +
              `sensorId ${CYAN}${this.getBTHomeObjIdText(sensor.sensorId)}${db} (${CYAN}${sensor.sensorId}${db}): ${YELLOW}${bthomeSensor.value}${db}`,
          );
          if (bthomeSensor.value !== undefined && bthomeSensor.value !== null) {
            sensor.value = bthomeSensor.value;
            this.log.debug(`****Device ${hk}${this.id}${db} has updated value ${YELLOW}${bthomeSensor.value}${db} for BTHomeSensor id ${CYAN}${sensor.key}${db}`);
            this.emit('bthomesensor_update', sensor.addr, this.getBTHomeObjIdText(sensor.sensorId), bthomeSensor.value);
            // this.log.debug(`BTHome sensors map:${rs}\n`, this.bthomeSensors);
          }
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
        if (key === 'tmp') {
          if (data.temperature === undefined && data.overtemperature === undefined) this.updateComponent('temperature', data[key] as ShellyData);
          const sensor = data.tmp as ShellyData;
          if (sensor.is_valid === true && sensor.value !== undefined) this.getComponent('temperature')?.setValue('value', sensor.value);
        }
        if (key === 'temperature') {
          if (data[key] !== null && data[key] !== undefined && typeof data[key] === 'number') this.getComponent('sys')?.setValue('temperature', data[key]);
        }
        if (key === 'overtemperature') {
          if (data[key] !== null && data[key] !== undefined && typeof data[key] === 'boolean') this.getComponent('sys')?.setValue('overtemperature', data[key]);
        }
      }
      // Update state for active components with ison
      for (const key in data) {
        if (key === 'lights' || key === 'relays') {
          let index = 0;
          for (const light of data[key] as ShellyData[]) {
            const component = this.getComponent(`${key.slice(0, 5)}:${index++}`);
            if (component && light.ison !== undefined) component.setValue('state', light.ison as boolean);
            if (component && light.gain !== undefined) component.setValue('brightness', light.gain as number);
          }
        }
      }
    } else if (this.gen === 2 || this.gen === 3) {
      // Update passive components
      for (const key in data) {
        if (key === 'sys') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'eth') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'cloud') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'mqtt') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'ws') this.updateComponent(key, data[key] as ShellyData);
        if (key === 'ble') this.updateComponent(key, data[key] as ShellyData);
      }
      // Update active components
      for (const key in data) {
        if (key.startsWith('switch:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('cover:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('light:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('rgb:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('rgbw:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('input:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('pm1:')) this.updateComponent(key, data[key] as ShellyData);
        if (key.startsWith('em1:')) this.updateComponent(key, data[key] as ShellyData);
      }
      // Update state for active components with output
      for (const key in data) {
        if (key.startsWith('light:') || key.startsWith('rgb:') || key.startsWith('rgbw:') || key.startsWith('switch:')) {
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
    const service = this.gen === 1 ? 'status' : 'Shelly.GetStatus';
    const status = await ShellyDevice.fetch(this.shelly, this.log, this.host, service);
    if (!status) {
      this.log.warn(`Error fetching status for device ${hk}${this.id}${wr} host ${zb}${this.host}${wr}. No data found. The device may be offline.`);
      this.online = false;
      this.emit('offline');
      return null;
    }
    if (this.cached) {
      this.cached = false;
      // Check if device is a cached device and register it to the CoAP server
      if (this.gen === 1) await this.shelly.coapServer?.registerDevice(this.host, this.id);
    }
    if (!this.online) this.log.info(`The device ${hk}${this.id}${nf} host ${zb}${this.host}${nf} is online.`);
    this.online = true;
    this.emit('online');
    this.onUpdate(status);
    return status;
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
  static async fetch(shelly: Shelly, log: AnsiLogger, host: string, service: string, params: Record<string, string | number | boolean> = {}): Promise<ShellyData | null> {
    // MOCK: Fetch device data from file if host is a json file
    if (host.endsWith('.json')) {
      log.debug(`Fetching device payloads from file ${host}: service ${service} params ${JSON.stringify(params)}`);
      try {
        const data = await fs.readFile(host, 'utf8');
        const deviceData = JSON.parse(data);
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
    }, 10000);

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
        };
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
