import { AnsiLogger, BLUE, CYAN, GREEN, GREY, MAGENTA, RED, RESET, TimestampFormat, db, debugStringify, hk, nf, wr, zb } from 'node-ansi-logger';
import { EventEmitter } from 'events';
import fetch, { RequestInit } from 'node-fetch';
import { getIpv4InterfaceAddress } from './utils.js';
import crypto from 'crypto';
import { parseDigestAuthenticateHeader, createDigestShellyAuth, createBasicShellyAuth, parseBasicAuthenticateHeader, getGen2BodyOptions, getGen1BodyOptions } from './auth.js';

import { shellydimmer2Settings, shellydimmer2Shelly, shellydimmer2Status } from './shellydimmer2.js';
import { shellyplus2pmSettings, shellyplus2pmShelly, shellyplus2pmStatus } from './shellyplus2pm.js';
import { shellyplus1pmSettings, shellyplus1pmShelly, shellyplus1pmStatus } from './shellyplus1pm.js';
import { shellypmminig3Settings, shellypmminig3Shelly, shellypmminig3Status } from './shellypmminig3.js';
import { shelly1minig3Settings, shelly1minig3Status, shelly1minig3Shelly } from './shelly1minig3.js';
import { WsClient } from './wsClient.js';
import { Shelly } from './shelly.js';

export declare type ParamsTypes = boolean | number | string;

export type ShellyData = Record<string, ShellyDataType>;

export type ShellyDataType = string | number | boolean | null | undefined | object;

export class ShellyProperty {
  readonly key: string;
  private _value: ShellyDataType;
  readonly component: ShellyComponent;

  constructor(key: string, value: ShellyDataType, component: ShellyComponent) {
    this.key = key;
    this._value = value;
    this.component = component;
  }

  get value(): ShellyDataType {
    return this._value;
  }

  set value(value: ShellyDataType) {
    this._value = value;
  }
}

interface SwitchComponent {
  On(): void;
  Off(): void;
  Toggle(): void;
  Level(level: number): void;
}

interface CoverComponent {
  Open(): void;
  Close(): void;
  Stop(): void;
  GoToPosition(pos: number): void;
}

export type ShellySwitchComponent = ShellyComponent & SwitchComponent;

export type ShellyCoverComponent = ShellyComponent & CoverComponent;

type ShellyComponentType = ShellyComponent & Partial<SwitchComponent> & Partial<CoverComponent>;

export class ShellyComponent {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly device: ShellyDevice;
  private readonly _properties = new Map<string, ShellyProperty>();
  private readonly stateName = ['Light', 'Relay', 'Switch'];

  constructor(id: string, name: string, device: ShellyDevice, data?: ShellyData) {
    this.id = id;
    this.index = id.includes(':') ? parseInt(id.split(':')[1]) : -1;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      // Add a state property for Light, Relay, and Switch components
      if (this.stateName.includes(name)) this.addProperty(new ShellyProperty('state', false, this));
      this.addProperty(new ShellyProperty(prop, data[prop] as ShellyDataType, this));
    }

    // await ShellyDevice.fetch(log, '192.168.1.222', 'relay/0', { turn: 'toggle' }); // No auth required

    // await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Toggle', { id: 0 }); // Password protected
    // await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Set', { id: 0, on: true }); // Password protected
    // await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Set', { id: 0, on: false }); // Password protected

    // Extend the class prototype to include the Switch Relay Light methods dynamically
    if (this.stateName.includes(name)) {
      // console.log('Component:', this);
      (this as ShellyComponentType).On = function () {
        this.setValue('state', true);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'on' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index, on: true });
      };

      (this as ShellyComponentType).Off = function () {
        this.setValue('state', false);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'off' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index, on: false });
      };

      (this as ShellyComponentType).Toggle = function () {
        const currentState = this.getValue('state');
        this.setValue('state', !currentState);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'toggle' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index });
      };

      (this as ShellyComponentType).Level = function (level: number) {
        if (!this.hasProperty('brightness')) return;
        this.setValue('brightness', level);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { brightness: level });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index, brightness: level });
      };
    }

    // Extend the class prototype to include the Cover methods dynamically
    if (name === 'Cover') {
      (this as ShellyComponentType).Open = function () {
        this.setValue('state', 'open');
        // device.sendCommand(device.host, 'roller', this.index, 'go=open');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Open`, { id: this.index });
      };

      (this as ShellyComponentType).Close = function () {
        this.setValue('state', 'close');
        // device.sendCommand(device.host, 'roller', this.index, 'go=close');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Close`, { id: this.index });
      };

      (this as ShellyComponentType).Stop = function () {
        this.setValue('state', 'stop');
        // device.sendCommand(device.host, 'roller', this.index, 'go=stop');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'stop' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Stop`, { id: this.index });
      };

      (this as ShellyComponentType).GoToPosition = function (pos: number) {
        // this.setValue('state', 'stop');
        // device.sendCommand(device.host, 'roller', this.index, 'go=stop');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'to_pos', roller_pos: pos });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.GoToPosition `, { id: this.index, pos: pos });
      };
    }
  }

  hasProperty(key: string): boolean {
    return this._properties.has(key);
  }

  getProperty(key: string): ShellyProperty | undefined {
    return this._properties.get(key);
  }

  addProperty(property: ShellyProperty): ShellyComponent {
    this._properties.set(property.key, property);
    return this;
  }

  setValue(key: string, value: ShellyDataType): ShellyComponent {
    const property = this.getProperty(key);
    if (property) property.value = value;
    return this;
  }

  getValue(key: string): ShellyDataType {
    const property = this.getProperty(key);
    if (property) return property.value;
    return undefined;
  }

  get properties(): ShellyProperty[] {
    return Array.from(this._properties.values());
  }

  *[Symbol.iterator](): IterableIterator<[string, ShellyProperty]> {
    for (const [key, property] of this._properties.entries()) {
      yield [key, property];
    }
  }

  update(data: ShellyData) {
    for (const key in data) {
      const property = this.getProperty(key);
      if (property) {
        property.value = data[key];
        if (property.key === 'ison') {
          const state = this.getProperty('state');
          if (state) state.value = data[key];
        }
        if (property.key === 'output') {
          const state = this.getProperty('state');
          if (state) state.value = data[key];
        }
      }
    }
  }

  async fetchUpdate() {
    if (this.name === 'Sntp') return;
    if (this.name === 'CoIoT') return;
    const id = this.id.includes(':') ? this.id.split(':')[1] : undefined;
    const service = this.device.gen === 1 ? this.id.replace(':', '/') : `rpc/${this.name}.GetStatus${id ? '?id=' + id : ''}`;
    let data: ShellyData | null = null;
    if (this.device.gen === 1) {
      if (this.id === 'cloud') {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, 'status');
        data = data?.cloud as ShellyData;
      } else if (this.id === 'mqtt') {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, 'status');
        data = data?.mqtt as ShellyData;
      } else if (this.id === 'wifi_sta') {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, 'status');
        data = data?.wifi_sta as ShellyData;
      } else if (this.id === 'wifi_sta1') {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, 'status');
        data = data?.wifi_sta1 ? (data?.wifi_sta1 as ShellyData) : {};
      } else if (this.id === 'wifi_ap') {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, 'status');
        data = data?.wifi_ap ? (data?.wifi_ap as ShellyData) : {};
      } else {
        data = await ShellyDevice.fetch(this.device.log, this.device.host, service);
      }
    } else {
      data = await ShellyDevice.fetch(this.device.log, this.device.host, service);
    }
    if (data) this.update(data);
    else this.device.log.error(`Error fetching component ${this.id} (${this.name}) for device ${this.device.id}`);
  }

  logComponent() {
    this.device.log.debug(`Component ${GREEN}${this.id}${db} (${BLUE}${this.name}${db})`);
    for (const [key, property] of this) {
      this.device.log.debug(`- ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
    }
  }
}

export class ShellyDevice extends EventEmitter {
  readonly shelly: Shelly;
  readonly log: AnsiLogger;
  readonly host: string;
  readonly username: string;
  readonly password: string | undefined;
  profile: 'relay' | 'cover' | undefined;
  id = '';
  model = '';
  mac = '';
  firmware = '';
  auth = false;
  name = '';
  online = false;
  gen = 0;
  lastseen = 0;
  private lastseenInterval?: NodeJS.Timeout;

  private wsClient: WsClient | undefined;

  private readonly _components = new Map<string, ShellyComponent>();

  private constructor(shelly: Shelly, log: AnsiLogger, host: string) {
    super();
    this.shelly = shelly;
    this.log = log;
    this.host = host;
    this.username = 'admin';
    this.password = undefined;
  }

  destroy() {
    if (this.lastseenInterval) clearInterval(this.lastseenInterval);
    this.lastseenInterval = undefined;
    this.lastseen = 0;
    this.wsClient?.stop();
    this.removeAllListeners();
  }

  hasComponent(id: string): boolean {
    return this._components.has(id);
  }

  getComponent(id: string): ShellyComponent | undefined {
    return this._components.get(id);
  }

  addComponent(component: ShellyComponent): ShellyComponent {
    this._components.set(component.id, component);
    return component;
  }

  addComponentProperties(id: string, data?: ShellyData): ShellyComponent | undefined {
    const component = this.getComponent(id);
    if (component) {
      for (const prop in data) {
        component.addProperty(new ShellyProperty(prop, data[prop] as ShellyDataType, component));
      }
      return component;
    }
    return undefined;
  }

  get components(): ShellyComponent[] {
    return Array.from(this._components.values());
  }

  *[Symbol.iterator](): IterableIterator<[string, ShellyComponent]> {
    for (const [key, component] of this._components.entries()) {
      yield [key, component];
    }
  }

  static async create(shelly: Shelly, log: AnsiLogger, host: string): Promise<ShellyDevice | undefined> {
    const shellyPayload = await ShellyDevice.fetch(log, host, 'shelly');
    if (!shellyPayload) {
      log.error(`Error creating device from host ${host}. No shelly data found.`);
      return undefined;
    }
    // console.log('Shelly:', shelly);
    const device = new ShellyDevice(shelly, log, host.replace('mock.', ''));
    device.mac = shellyPayload.mac as string;
    device.lastseen = Date.now();

    if (shellyPayload.mode) device.profile = shellyPayload.mode as 'relay' | 'cover';
    if (shellyPayload.profile) device.profile = shellyPayload.mode as 'relay' | 'cover';

    // Gen 1 Shelly device
    if (!shellyPayload.gen) {
      const statusPayload = await ShellyDevice.fetch(log, host, 'status');
      const settingsPayload = await ShellyDevice.fetch(log, host, 'settings');
      if (!statusPayload || !settingsPayload) {
        log.error(`Error creating device gen 1 from host ${host}. No data found.`);
        return undefined;
      }
      device.model = shellyPayload.type as string;
      device.id = (settingsPayload.device as ShellyData).hostname as string;
      device.firmware = (shellyPayload.fw as string).split('/')[1];
      device.auth = shellyPayload.auth as boolean;
      device.name = settingsPayload.name ? (settingsPayload.name as string) : device.id;
      device.gen = 1;
      for (const key in settingsPayload) {
        if (key === 'wifi_ap') device.addComponent(new ShellyComponent(key, 'WiFi', device, settingsPayload[key] as ShellyData));
        if (key === 'wifi_sta') device.addComponent(new ShellyComponent(key, 'WiFi', device, settingsPayload[key] as ShellyData));
        if (key === 'wifi_sta1') device.addComponent(new ShellyComponent(key, 'WiFi', device, settingsPayload[key] as ShellyData));
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT', device, settingsPayload[key] as ShellyData));
        if (key === 'coiot') device.addComponent(new ShellyComponent(key, 'CoIoT', device, settingsPayload[key] as ShellyData));
        if (key === 'sntp') device.addComponent(new ShellyComponent(key, 'Sntp', device, settingsPayload[key] as ShellyData));
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud', device, settingsPayload[key] as ShellyData));
        if (key === 'lights') {
          let index = 0;
          for (const light of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(`light:${index++}`, 'Light', device, light as ShellyData));
          }
        }
        if (key === 'relays' && device.profile !== 'cover') {
          let index = 0;
          for (const relay of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(`relay:${index++}`, 'Relay', device, relay as ShellyData));
          }
        }
        if (key === 'rollers' && device.profile !== 'relay') {
          let index = 0;
          for (const roller of settingsPayload[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(`roller:${index++}`, 'Roller', device, roller as ShellyData));
          }
        }
      }
      for (const key in statusPayload) {
        if (key === 'lights') {
          let index = 0;
          for (const light of statusPayload[key] as ShellyData[]) {
            device.addComponentProperties(`light:${index++}`, light as ShellyData);
          }
        }
        if (key === 'relays') {
          let index = 0;
          for (const relay of statusPayload[key] as ShellyData[]) {
            device.addComponentProperties(`relay:${index++}`, relay as ShellyData);
          }
        }
      }
    }

    // Gen 2 Shelly device
    if (shellyPayload.gen === 2 || shellyPayload.gen === 3) {
      const statusPayload = await ShellyDevice.fetch(log, host, 'Shelly.GetStatus');
      const settingsPayload = await ShellyDevice.fetch(log, host, 'Shelly.GetConfig');
      if (!statusPayload || !settingsPayload) {
        log.error(`Error creating device gen 2 from host ${host}. No data found.`);
        return undefined;
      }
      device.model = shellyPayload.model as string;
      device.id = shellyPayload.id as string;
      device.firmware = (shellyPayload.fw_id as string).split('/')[1];
      device.auth = shellyPayload.auth_en as boolean;
      device.gen = shellyPayload.gen;
      for (const key in settingsPayload) {
        if (key === 'wifi') {
          const wifi = settingsPayload[key] as ShellyData;
          if (wifi.ap) device.addComponent(new ShellyComponent('wifi_ap', 'WiFi', device, wifi.ap as ShellyData)); // Ok
          if (wifi.sta) device.addComponent(new ShellyComponent('wifi_sta', 'WiFi', device, wifi.sta as ShellyData)); // Ok
          if (wifi.sta1) device.addComponent(new ShellyComponent('wifi_sta1', 'WiFi', device, wifi.sta1 as ShellyData)); // Ok
        }
        if (key === 'sys') {
          device.addComponent(new ShellyComponent('sys', 'Sys', device, settingsPayload[key] as ShellyData)); // Ok
          const sys = settingsPayload[key] as ShellyData;
          if (sys.sntp) {
            device.addComponent(new ShellyComponent('sntp', 'Sntp', device, sys.sntp as ShellyData)); // Ok
          }
          const dev = sys.device as ShellyData;
          device.name = dev.name ? (dev.name as string) : device.id;
        }
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT', device, settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ws') device.addComponent(new ShellyComponent(key, 'WS', device, settingsPayload[key] as ShellyData)); // Ok
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud', device, settingsPayload[key] as ShellyData)); // Ok
        if (key === 'ble') device.addComponent(new ShellyComponent(key, 'Ble', device, settingsPayload[key] as ShellyData)); // Ok
        if (key.startsWith('switch:')) device.addComponent(new ShellyComponent(key, 'Switch', device, settingsPayload[key] as ShellyData));
        if (key.startsWith('cover:')) device.addComponent(new ShellyComponent(key, 'Cover', device, settingsPayload[key] as ShellyData));
        if (key.startsWith('light:')) device.addComponent(new ShellyComponent(key, 'Light', device, settingsPayload[key] as ShellyData));
        if (key.startsWith('pm1:')) device.addComponent(new ShellyComponent(key, 'PowerMeter', device, settingsPayload[key] as ShellyData));
      }
      for (const key in statusPayload) {
        if (key.startsWith('switch:')) device.addComponentProperties(key, statusPayload[key] as ShellyData);
        if (key.startsWith('cover:')) device.addComponentProperties(key, statusPayload[key] as ShellyData);
        if (key.startsWith('light:')) device.addComponentProperties(key, statusPayload[key] as ShellyData);
        if (key.startsWith('pm1:')) device.addComponentProperties(key, statusPayload[key] as ShellyData);
      }
    }

    await device.fetchUpdate();

    if (device.gen === 1) {
      const CoIoT = device.getComponent('coiot');
      if (CoIoT) {
        if (!CoIoT.getValue('enabled')) log.error(`CoIoT is not enabled for device ${device.id}. Enable it in the settings to receive updates from the device.`);
        if (!CoIoT.getValue('peer')) {
          log.error(`CoIoT peer for device ${device.id} is not set.`);
        } else {
          const peer = CoIoT.getValue('peer') as string;
          const ipv4 = getIpv4InterfaceAddress() + ':5683';
          if (peer !== 'mcast' && peer !== ipv4)
            log.error(`CoIoT peer for device ${device.id} is not mcast or ${ipv4}. Set it in the settings to receive updates from the device.`);
        }
      } else {
        log.error(`CoIoT service not found for device ${device.id}.`);
      }
    }

    device.lastseenInterval = setInterval(
      () => {
        if (Date.now() - device.lastseen > 10 * 60 * 1000)
          log.warn(`Device ${hk}${device.id}${wr} host ${zb}${device.host}${wr} has not been seen for 10 minutes. Check the device connection.`);
        else log.info(`Device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} has been seen in the last 10 minutes.`);
      },
      10 * 60 * 1000,
    );

    if (device.gen === 2 || device.gen === 3) {
      device.wsClient = new WsClient(host, 'tango');
      device.wsClient.start(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      device.wsClient.on('update', (message) => {
        log.info(`WebSocket update from device ${hk}${device.id}${nf} host ${MAGENTA}${device.host}${nf}` /* , message*/);
      });
    }

    return device;
  }

  update(data: ShellyData) {
    if (this.gen === 1) {
      for (const key in data) {
        if (key === 'lights' || key === 'relays') {
          let index = 0;
          for (const light of data[key] as ShellyData[]) {
            const component = this.getComponent(`${key.slice(0, 5)}:${index++}`);
            if (component) component.setValue('state', light.ison as boolean);
            else this.log.error(`Error setting state for device ${this.id} host ${this.host}. No component found for ${key.slice(0, 5)}:${index - 1}`);
          }
        }
      }
    } else if (this.gen === 2 || this.gen === 3) {
      for (const key in data) {
        if (key.startsWith('switch:')) {
          const _switch = data[key] as ShellyData;
          const component = this.getComponent(key);
          if (component) component.setValue('state', _switch.output as boolean);
          else this.log.error(`Error setting state for device ${this.id} host ${this.host}. No component found for ${key}`);
        }
        if (key.startsWith('cover:')) {
          const cover = data[key] as ShellyData;
          const component = this.getComponent(key);
          if (component) component.setValue('state', cover.state as boolean);
          else this.log.error(`Error setting state for device ${this.id} host ${this.host}. No component found for ${key}`);
        }
      }
    }

    this.lastseen = Date.now();
  }

  async fetchUpdate(): Promise<void> {
    const service = this.gen === 1 ? 'status' : 'Shelly.GetStatus';
    const status = await ShellyDevice.fetch(this.log, this.host, service);
    if (!status) {
      this.log.error(`Error fetching device ${this.id} status. No data found.`);
      return;
    }
    this.update(status);
  }

  // await ShellyDevice.fetch('192.168.1.217', 'rpc/Switch.Toggle', { id: 0 });
  static async fetch(log: AnsiLogger, host: string, service: string, params: Record<string, string | number | boolean> = {}): Promise<ShellyData | null> {
    if (host === 'mock.192.168.1.217') {
      if (service === 'shelly') return shellyplus1pmShelly;
      if (service === 'rpc/Shelly.GetStatus') return shellyplus1pmStatus;
      if (service === 'rpc/Shelly.GetConfig') return shellyplus1pmSettings;
    }
    if (host === 'mock.192.168.1.218') {
      if (service === 'shelly') return shellyplus2pmShelly;
      if (service === 'rpc/Shelly.GetStatus') return shellyplus2pmStatus;
      if (service === 'rpc/Shelly.GetConfig') return shellyplus2pmSettings;
    }
    if (host === 'mock.192.168.1.219') {
      if (service === 'shelly') return shellydimmer2Shelly;
      if (service === 'status') return shellydimmer2Status;
      if (service === 'settings') return shellydimmer2Settings;
    }
    if (host === 'mock.192.168.1.220') {
      if (service === 'shelly') return shellypmminig3Shelly;
      if (service === 'rpc/Shelly.GetStatus') return shellypmminig3Status;
      if (service === 'rpc/Shelly.GetConfig') return shellypmminig3Settings;
    }
    if (host === 'mock.192.168.1.221') {
      if (service === 'shelly') return shelly1minig3Shelly;
      if (service === 'rpc/Shelly.GetStatus') return shelly1minig3Status;
      if (service === 'rpc/Shelly.GetConfig') return shelly1minig3Settings;
    }
    const gen = /^[^A-Z]*$/.test(service) ? 1 : 2;
    const url = gen === 1 ? `http://${host}/${service}` : `http://${host}/rpc`;
    try {
      const options: RequestInit = {
        method: 'POST',
        headers: gen === 1 ? { 'Content-Type': 'application/x-www-form-urlencoded' } : { 'Content-Type': 'application/json' },
        body: gen === 1 ? getGen1BodyOptions(params) : getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params),
      };
      const headers = options.headers as Record<string, string>;
      log.debug(
        `${GREY}Fetching shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}` +
          `${params ? ` with ${CYAN}` + JSON.stringify(params) + `${GREY}` : ''} url ${BLUE}${url}${RESET}`,
      );
      log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
      let response;
      if (service === 'shelly') response = await fetch(`http://${host}/${service}`);
      else response = await fetch(url, options);
      log.debug(`${GREY}response ok: ${response.ok}${RESET}`);
      if (!response.ok) {
        // Try with authentication
        if (response.status === 401) {
          const authHeader = response.headers.get('www-authenticate');
          log.debug(`${GREY}authHeader: ${authHeader}${RESET}`);
          if (authHeader === null) throw new Error('No www-authenticate header found');
          if (authHeader.startsWith('Basic')) {
            // Gen 1 devices require basic authentication
            const authParams = parseBasicAuthenticateHeader(authHeader); // Get nonce and realm
            log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
            if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
            const auth = createBasicShellyAuth('admin', 'tango');
            headers.Authorization = `Basic ${auth}`;
          } else if (authHeader.startsWith('Digest')) {
            // Gen 2 and 3 devices require digest authentication
            const authParams = parseDigestAuthenticateHeader(authHeader); // Get nonce and realm
            log.debug(`${GREY}authparams: ${JSON.stringify(authParams)}${RESET}`);
            if (!authParams.nonce) throw new Error('No authenticate nonce parameter found in header');
            if (!authParams.realm) throw new Error('No authenticate realm parameter found in header');
            const auth = createDigestShellyAuth('admin', 'tango', parseInt(authParams.nonce), crypto.randomInt(0, 999999999), authParams.realm);
            options.body = getGen2BodyOptions('2.0', 10, 'Matterbridge', service, params, auth);
          }
          log.debug(`${GREY}options: ${JSON.stringify(options)}${RESET}`);
          response = await fetch(url, options);
          if (response.ok) {
            const data = await response.json();
            const reponse = gen === 1 ? data : (data as ShellyData).result;
            // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
            return reponse as ShellyData;
          }
        }
        log.error(
          `${RED}Response error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url}:` +
            ` ${response.status} (${response.statusText})${RESET}`,
        );
        return null;
      }
      const data = await response.json();
      const reponse = gen === 1 ? data : (data as ShellyData).result;
      // console.log(`${GREY}Response from shelly gen ${CYAN}${gen}${GREY} host ${CYAN}${host}${GREY} service ${CYAN}${service}${GREY}:${RESET}`, reponse);
      return reponse as ShellyData;
    } catch (error) {
      log.error(`${RED}Error fetching shelly gen ${gen} host ${host} service ${service}${params ? ' with ' + JSON.stringify(params) : ''} url ${url}:`, error);
      return null;
    }
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

  /*
  async sendCommand(hostname: string, component: string, index: number, command: string): Promise<unknown | undefined> {
    try {
      const url = `http://${hostname}/${component}/${index}?${command}`;
      this.log.debug(`sendCommand url ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        this.log.error(`Error fetching shelly at ${hostname} response:`, response.statusText);
        return undefined;
      }
      const data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      this.log.error(`Error fetching shelly at ${hostname} error:`, error);
      return undefined;
    }
  }
  */

  // Gen 2 and 3 rpc
  // http://192.168.1.218/rpc/Switch.GetStatus?id=0
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=true
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=false
  // http://192.168.1.218/rpc/Switch.Toggle?id=0

  /*
  async sendRpcCommand(hostname: string, service: string, command: string, index: number, extra: string | undefined = undefined): Promise<unknown | undefined> {
    try {
      const url = `http://${hostname}/rpc/${service}.${command}?id=${index}${extra ? `&${extra}` : ``}`;
      this.log.debug(`sendCommand url ${url}`);
      const response = await fetch(url);
      if (!response.ok) {
        this.log.error(`Error fetching shelly at ${hostname} response:`, response.statusText);
        return undefined;
      }
      const data = await response.json();
      console.log(data);
      return data;
    } catch (error) {
      this.log.error(`Error fetching shelly at ${hostname} error:`, error);
      return undefined;
    }
  }
  */

  /*
  async writeFile(filePath: string, data: string) {
    // Write the data to a file
    await fs
      .writeFile(`${filePath}`, data, 'utf8')
      .then(() => {
        this.log.debug(`Successfully wrote to ${filePath}`);
      })
      .catch((error) => {
        this.log.error(`Error writing to ${filePath}:`, error);
      });
  }
  */

  logDevice() {
    // Log the device
    this.log.debug(
      `Shelly device ${MAGENTA}${this.id}${db} (${this.model}) gen ${BLUE}${this.gen}${db} name ${BLUE}${this.name}${db} mac ${BLUE}${this.mac}${db} host ${BLUE}${this.host}${db}`,
    );
    for (const [key, component] of this) {
      this.log.debug(`- ${GREEN}${component.name}${db} (${BLUE}${key}${db})`);
      for (const [key, property] of component) {
        this.log.debug(`  - ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
      }
    }
  }
}

if (process.argv.includes('startShelly')) {
  const log = new AnsiLogger({ logName: 'shellyDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

  // Gen 1 devices
  await ShellyDevice.fetch(log, '192.168.1.219', 'shelly'); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.219', 'light/0', { turn: 'toggle' }); // Password protected

  await ShellyDevice.fetch(log, '192.168.1.222', 'shelly'); // No auth required
  await ShellyDevice.fetch(log, '192.168.1.222', 'relay/0', { turn: 'toggle' }); // No auth required

  // Gen 2 devices
  await ShellyDevice.fetch(log, '192.168.1.221', 'shelly'); // // Password protected but no auth required for shelly
  await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Toggle', { id: 0 }); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Set', { id: 0, on: true }); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.221', 'Switch.Set', { id: 0, on: false }); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.221', 'Shelly.GetStatus'); // Password protected

  await ShellyDevice.fetch(log, '192.168.1.217', 'shelly'); // No auth required for shelly
  await ShellyDevice.fetch(log, '192.168.1.217', 'Switch.Toggle', { id: 0 }); // No auth required
  await ShellyDevice.fetch(log, '192.168.1.217', 'Switch.Set', { id: 0, on: true }); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.217', 'Switch.Set', { id: 0, on: false }); // Password protected
  await ShellyDevice.fetch(log, '192.168.1.217', 'Shelly.GetStatus'); // No auth required

  /*
  let shelly;

  shelly = await ShellyDevice.create(log, '192.168.1.217');
  if (shelly) shelly.logDevice();
  // console.log(shelly);

  shelly = await ShellyDevice.create(log, '192.168.1.218');
  if (shelly) shelly.logDevice();
  if (shelly) {
    const component = shelly.getComponent('switch:0');
    await component?.fetchUpdate();
    component?.logComponent();
  }
  if (shelly) {
    const component = shelly.getComponent('switch:1');
    await component?.fetchUpdate();
    component?.logComponent();
  }

  shelly = await ShellyDevice.create(log, '192.168.1.219');
  if (shelly) shelly.logDevice();
  if (shelly) {
    const component = shelly.getComponent('light:0');
    await component?.fetchUpdate();
    component?.logComponent();
  }

  shelly = await ShellyDevice.create(log, '192.168.1.220');
  if (shelly) shelly.logDevice();

  shelly = await ShellyDevice.create(log, '192.168.1.221');
  if (shelly) shelly.logDevice();

  process.on('SIGINT', function () {
    process.exit();
  });
*/
  // await ShellyDevice.sendCommand('192.168.1.219', 'light', 0, 'turn=on');
}
