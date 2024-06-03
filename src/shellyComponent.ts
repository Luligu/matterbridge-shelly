import { BLUE, CYAN, GREEN, GREY, YELLOW, db, debugStringify, er } from 'node-ansi-logger';

import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { ShellyProperty } from './shellyProperty.js';
import { ShellyDevice } from './shellyDevice.js';
import { deepEqual } from 'matterbridge';

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
  readonly device: ShellyDevice;
  readonly id: string;
  readonly index: number;
  readonly name: string;
  private readonly _properties = new Map<string, ShellyProperty>();
  private readonly stateName = ['Light', 'Relay', 'Switch'];

  constructor(device: ShellyDevice, id: string, name: string, data?: ShellyData) {
    this.id = id;
    this.index = id.includes(':') ? parseInt(id.split(':')[1]) : -1;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      this.addProperty(new ShellyProperty(this, prop, data[prop] as ShellyDataType));
      // Add a state property for Light, Relay, and Switch components
      if (this.stateName.includes(name) && (prop === 'ison' || prop === 'output')) this.addProperty(new ShellyProperty(this, 'state', data[prop]));
    }

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
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Open`, { id: this.index });
      };

      (this as ShellyComponentType).Close = function () {
        this.setValue('state', 'close');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Close`, { id: this.index });
      };

      (this as ShellyComponentType).Stop = function () {
        this.setValue('state', 'stop');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'stop' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Stop`, { id: this.index });
      };

      (this as ShellyComponentType).GoToPosition = function (pos: number) {
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
    if (property) {
      if (!deepEqual(property.value, value)) {
        this.device.log.info(
          `***${CYAN}${this.id}:${key}${GREY} updated from ${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} to ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        this.device.emit('update', this.id, key, value);
        property.value = value;
      } else {
        this.device.log.info(
          `*${CYAN}${this.id}:${key}${GREY} not changed from ${YELLOW}${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
      }
    } else {
      this.addProperty(new ShellyProperty(this, key, value));
      this.device.log.info(
        `**${CYAN}${this.id}:${key}${GREY} added with value ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} to component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
      );
    }
    return this;
  }

  getValue(key: string): ShellyDataType {
    const property = this.getProperty(key);
    if (property) return property.value;
    else {
      this.device.log.error(`****Property ${CYAN}${key}${er} not found in component ${GREEN}${this.id}${er} (${BLUE}${this.name}${er})`);
      return undefined;
    }
  }

  get properties(): ShellyProperty[] {
    return Array.from(this._properties.values());
  }

  *[Symbol.iterator](): IterableIterator<[string, ShellyProperty]> {
    for (const [key, property] of this._properties.entries()) {
      yield [key, property];
    }
  }

  update(componentData: ShellyData) {
    for (const key in componentData) {
      const property = this.getProperty(key);
      if (property) {
        property.value = componentData[key];
        if (property.key === 'ison') {
          const state = this.getProperty('state');
          if (state) state.value = componentData[key];
        }
        if (property.key === 'output') {
          const state = this.getProperty('state');
          if (state) state.value = componentData[key];
        }
      }
    }
  }

  logComponent() {
    this.device.log.debug(`Component ${GREEN}${this.id}${db} (${BLUE}${this.name}${db})`);
    for (const [key, property] of this) {
      this.device.log.debug(`- ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
    }
  }
}
