/* eslint-disable no-console */
import { AnsiLogger, BLUE, GREEN, MAGENTA, TimestampFormat, db, debugStringify } from 'node-ansi-logger';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';
import { shellydimmer2Settings, shellydimmer2Shelly, shellydimmer2Status } from './shellydimmer2.js';
import { shellyplus2pmSettings, shellyplus2pmShelly, shellyplus2pmStatus } from './shellyplus2pm.js';
import { shellyplus1pmSettings, shellyplus1pmShelly, shellyplus1pmStatus } from './shellyplus1pm.js';
import { shellypmminig3Settings, shellypmminig3Shelly, shellypmminig3Status } from './shellypmminig3.js';

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
}

interface CoverComponent {
  Open(): void;
  Close(): void;
  Stop(): void;
}

type ShellyComponentType = ShellyComponent & Partial<SwitchComponent> & Partial<CoverComponent>;

export class ShellyComponent {
  readonly id: string;
  readonly name: string;
  readonly device: ShellyDevice;
  private readonly _properties = new Map<string, ShellyProperty>();
  private readonly stateName = ['Light', 'Relay', 'Switch'];

  constructor(id: string, name: string, device: ShellyDevice, data?: ShellyData) {
    this.id = id;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      // Add a state property for Light, Relay, and Switch components
      if (this.stateName.includes(name)) this.addProperty(new ShellyProperty('state', false, this));
      this.addProperty(new ShellyProperty(prop, data[prop] as ShellyDataType, this));
    }

    // Extend the class prototype to include the Switch Relay Light methods dynamically
    if (this.stateName.includes(name)) {
      (this as ShellyComponentType).On = function () {
        this.setValue('state', true);
      };

      (this as ShellyComponentType).Off = function () {
        this.setValue('state', false);
      };

      (this as ShellyComponentType).Toggle = function () {
        const currentState = this.getValue('state');
        this.setValue('state', !currentState);
      };
    }

    // Extend the class prototype to include the Cover methods dynamically
    if (name === 'Cover') {
      (this as ShellyComponentType).Open = function () {
        this.setValue('state', 'open');
      };

      (this as ShellyComponentType).Close = function () {
        this.setValue('state', 'close');
      };

      (this as ShellyComponentType).Stop = function () {
        this.setValue('state', 'stop');
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
        data = await ShellyDevice.fetch(this.device.host, 'status');
        data = data?.cloud as ShellyData;
      } else if (this.id === 'mqtt') {
        data = await ShellyDevice.fetch(this.device.host, 'status');
        data = data?.mqtt as ShellyData;
      } else if (this.id === 'wifi_sta') {
        data = await ShellyDevice.fetch(this.device.host, 'status');
        data = data?.wifi_sta as ShellyData;
      } else if (this.id === 'wifi_sta1') {
        data = await ShellyDevice.fetch(this.device.host, 'status');
        data = data?.wifi_sta1 ? (data?.wifi_sta1 as ShellyData) : {};
      } else if (this.id === 'wifi_ap') {
        data = await ShellyDevice.fetch(this.device.host, 'status');
        data = data?.wifi_ap ? (data?.wifi_ap as ShellyData) : {};
      } else {
        data = await ShellyDevice.fetch(this.device.host, service);
      }
    } else {
      data = await ShellyDevice.fetch(this.device.host, service);
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
  // handleEvent(event: RpcEvent);
}

export class ShellyDevice extends EventEmitter {
  readonly log: AnsiLogger;
  readonly host: string;
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

  private readonly _components = new Map<string, ShellyComponent>();

  private constructor(log: AnsiLogger, host: string) {
    super();
    this.log = log;
    this.host = host;
  }

  destroy() {
    if (this.lastseenInterval) clearInterval(this.lastseenInterval);
    this.lastseenInterval = undefined;
    this.lastseen = 0;
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

  static async create(log: AnsiLogger, host: string): Promise<ShellyDevice | undefined> {
    const shelly = await ShellyDevice.fetch(host, 'shelly');
    if (!shelly) {
      log.error(`Error creating device from host ${host}. No shelly data found.`);
      return undefined;
    }
    // console.log('Shelly:', shelly);
    const device = new ShellyDevice(log, host.replace('mock.', ''));
    device.mac = shelly.mac as string;
    device.lastseen = Date.now();

    // Gen 1 Shelly device
    if (!shelly.gen) {
      const status = await ShellyDevice.fetch(host, 'status');
      const settings = await ShellyDevice.fetch(host, 'settings');
      if (!status || !settings) {
        log.error(`Error creating device gen 1 from host ${host}. No data found.`);
        return undefined;
      }
      device.model = shelly.type as string;
      device.id = (settings.device as ShellyData).hostname as string;
      device.firmware = (shelly.fw as string).split('/')[1];
      device.auth = shelly.auth as boolean;
      device.name = settings.name as string;
      device.gen = 1;
      for (const key in settings) {
        if (key === 'wifi_ap') device.addComponent(new ShellyComponent(key, 'WiFi', device, settings[key] as ShellyData));
        if (key === 'wifi_sta') device.addComponent(new ShellyComponent(key, 'WiFi', device, settings[key] as ShellyData));
        if (key === 'wifi_sta1') device.addComponent(new ShellyComponent(key, 'WiFi', device, settings[key] as ShellyData));
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT', device, settings[key] as ShellyData));
        if (key === 'coiot') device.addComponent(new ShellyComponent(key, 'CoIoT', device, settings[key] as ShellyData));
        if (key === 'sntp') device.addComponent(new ShellyComponent(key, 'Sntp', device, settings[key] as ShellyData));
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud', device, settings[key] as ShellyData));
        if (key === 'lights') {
          let index = 0;
          for (const light of settings[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(`light:${index++}`, 'Light', device, light as ShellyData));
          }
        }
        if (key === 'relays') {
          let index = 0;
          for (const relay of settings[key] as ShellyData[]) {
            device.addComponent(new ShellyComponent(`relay:${index++}`, 'Relay', device, relay as ShellyData));
          }
        }
      }
      for (const key in status) {
        if (key === 'lights') {
          let index = 0;
          for (const light of status[key] as ShellyData[]) {
            device.addComponentProperties(`light:${index++}`, light as ShellyData);
          }
        }
        if (key === 'relays') {
          let index = 0;
          for (const relay of status[key] as ShellyData[]) {
            device.addComponentProperties(`relay:${index++}`, relay as ShellyData);
          }
        }
      }
    }

    // Gen 2 Shelly device
    if (shelly.gen === 2 || shelly.gen === 3) {
      const status = await ShellyDevice.fetch(host, 'rpc/Shelly.GetStatus');
      const settings = await ShellyDevice.fetch(host, 'rpc/Shelly.GetConfig');
      if (!status || !settings) {
        log.error(`Error creating device gen 2 from host ${host}. No data found.`);
        return undefined;
      }
      device.model = shelly.model as string;
      device.id = shelly.id as string;
      device.firmware = (shelly.fw_id as string).split('/')[1];
      device.auth = shelly.auth_en as boolean;
      device.gen = shelly.gen;
      for (const key in settings) {
        if (key === 'wifi') {
          const wifi = settings[key] as ShellyData;
          if (wifi.ap) device.addComponent(new ShellyComponent('wifi_ap', 'WiFi', device, wifi.ap as ShellyData)); // Ok
          if (wifi.sta) device.addComponent(new ShellyComponent('wifi_sta', 'WiFi', device, wifi.sta as ShellyData)); // Ok
          if (wifi.sta1) device.addComponent(new ShellyComponent('wifi_sta1', 'WiFi', device, wifi.sta1 as ShellyData)); // Ok
        }
        if (key === 'sys') {
          const sys = settings[key] as ShellyData;
          if (sys.sntp) {
            device.addComponent(new ShellyComponent('sntp', 'Sntp', device, sys.sntp as ShellyData)); // Ok
            const dev = sys.device as ShellyData;
            device.name = dev.name as string;
          }
        }
        if (key === 'mqtt') device.addComponent(new ShellyComponent(key, 'MQTT', device, settings[key] as ShellyData)); // Ok
        if (key === 'ws') device.addComponent(new ShellyComponent(key, 'WS', device, settings[key] as ShellyData)); // Ok
        if (key === 'cloud') device.addComponent(new ShellyComponent(key, 'Cloud', device, settings[key] as ShellyData)); // Ok
        if (key === 'ble') device.addComponent(new ShellyComponent(key, 'Ble', device, settings[key] as ShellyData)); // Ok
        if (key.startsWith('switch:')) device.addComponent(new ShellyComponent(key, 'Switch', device, settings[key] as ShellyData));
        if (key.startsWith('pm1:')) device.addComponent(new ShellyComponent(key, 'PowerMeter', device, settings[key] as ShellyData));
      }
      for (const key in status) {
        if (key.startsWith('switch:')) device.addComponentProperties(key, status[key] as ShellyData);
        if (key.startsWith('pm1:')) device.addComponentProperties(key, status[key] as ShellyData);
      }
    }

    await device.fetchUpdate();

    if (device.gen === 1) {
      const CoIoT = device.getComponent('coiot');
      if (CoIoT) {
        if (!CoIoT.getValue('enabled')) log.error(`CoIoT is not enabled for device ${device.id}. Enable it in the settings to receive updates from the device.`);
        if (!CoIoT.getValue('peer') || CoIoT.getValue('peer') !== 'mcast') log.warn(`CoIoT peer for device ${device.id} is not mcast: ${CoIoT.getValue('peer')}`);
      } else {
        log.error(`CoIoT service not found for device ${device.id}`);
      }
    }

    device.lastseenInterval = setInterval(
      () => {
        if (Date.now() - device.lastseen > 10 * 60 * 1000) log.warn(`Device ${device.id} has not been seen for 10 minutes. Check the device connection.`);
      },
      10 * 60 * 1000,
    );

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
            else this.log.error(`Error setting status for device ${this.id}. No component found for ${key.slice(0, 5)}:${index - 1}`);
          }
        }
      }
    } else if (this.gen === 2 || this.gen === 3) {
      for (const key in data) {
        if (key.startsWith('switch:')) {
          const light = data[key] as ShellyData;
          const component = this.getComponent(key);
          if (component) component.setValue('state', light.output as boolean);
          else this.log.error(`Error setting status for device ${this.id}. No component found for ${key}`);
        }
      }
    }
  }

  async fetchUpdate(): Promise<void> {
    const service = this.gen === 1 ? 'status' : 'rpc/Shelly.GetStatus';
    const status = await ShellyDevice.fetch(this.host, service);
    if (!status) {
      this.log.error(`Error fetching device ${this.id} status. No data found.`);
      return;
    }
    this.update(status);
    this.lastseen = Date.now();
  }

  static async fetch(host: string, service = 'shelly'): Promise<ShellyData | null> {
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
      if (service === 'status') return shellypmminig3Status;
      if (service === 'settings') return shellypmminig3Settings;
    }
    const url = `http://${host}/${service}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Response not ok fetching shelly ${url}`, response);
        return null;
      }
      const data = await response.json();
      // console.log(data);
      return data as ShellyData;
    } catch (error) {
      console.error(`Error fetching shelly ${url}:`, error);
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

  // Gen 2 and 3 rpc
  // http://192.168.1.218/rpc/Switch.GetStatus?id=0
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=true
  // http://192.168.1.218/rpc/Switch.Set?id=0&on=false
  // http://192.168.1.218/rpc/Switch.Toggle?id=0
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

if (process.argv.includes('shelly')) {
  const log = new AnsiLogger({ logName: 'shellyDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

  const shelly = await ShellyDevice.create(log, '192.168.1.217');
  if (shelly) shelly.logDevice();
  console.log(shelly);

  /*
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
  */
  process.on('SIGINT', function () {
    process.exit();
  });

  // await ShellyDevice.sendCommand('192.168.1.219', 'light', 0, 'turn=on');
}
