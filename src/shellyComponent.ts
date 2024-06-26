/**
 * This file contains the class SwitchComponent.
 *
 * @file src\shellyComponent.ts
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

import { BLUE, CYAN, GREEN, GREY, YELLOW, db, debugStringify, er } from 'node-ansi-logger';

import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { ShellyProperty } from './shellyProperty.js';
import { ShellyDevice } from './shellyDevice.js';
import { deepEqual } from 'matterbridge';
import EventEmitter from 'events';

interface LightComponent {
  On(): void;
  Off(): void;
  Toggle(): void;
  Level(level: number): void;
  ColorRGB(red: number, green: number, blue: number): void;
}

interface SwitchComponent {
  On(): void;
  Off(): void;
  Toggle(): void;
  Level(level: number): void;
  ColorRGB(red: number, green: number, blue: number): void;
}

interface CoverComponent {
  Open(): void;
  Close(): void;
  Stop(): void;
  GoToPosition(pos: number): void;
}

export type ShellyLightComponent = ShellyComponent & LightComponent;

export type ShellySwitchComponent = ShellyComponent & SwitchComponent;

export type ShellyCoverComponent = ShellyComponent & CoverComponent;

type ShellyComponentType = ShellyComponent & Partial<LightComponent> & Partial<SwitchComponent> & Partial<CoverComponent>;

function isLightComponent(name: string): name is 'Light' {
  return ['Light'].includes(name);
}

function isSwitchComponent(name: string): name is 'Light' | 'Relay' | 'Switch' {
  return ['Light', 'Relay', 'Switch'].includes(name);
}

function isCoverComponent(name: string): name is 'Cover' | 'Roller' {
  return ['Cover', 'Roller'].includes(name);
}

export class ShellyComponent extends EventEmitter {
  readonly device: ShellyDevice;
  readonly id: string;
  readonly index: number;
  readonly name: string;
  private readonly _properties = new Map<string, ShellyProperty>();
  // private readonly stateName = ['Light', 'Relay', 'Switch'];

  constructor(device: ShellyDevice, id: string, name: string, data?: ShellyData) {
    super();
    this.id = id;
    this.index = id.includes(':') ? parseInt(id.split(':')[1]) : -1;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      this.addProperty(new ShellyProperty(this, prop, data[prop] as ShellyDataType));

      // Add a state property for Light, Relay, and Switch components
      if (isSwitchComponent(name) && (prop === 'ison' || prop === 'output')) this.addProperty(new ShellyProperty(this, 'state', data[prop]));

      // Add a brightness property for Light, Relay, and Switch components
      if (isLightComponent(name) && prop === 'gain') this.addProperty(new ShellyProperty(this, 'brightness', data[prop]));
    }

    // Extend the class prototype to include the Switch Relay Light methods dynamically
    if (isSwitchComponent(name)) {
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
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Toggle`, { id: this.index });
      };

      (this as ShellyComponentType).Level = function (level: number) {
        if (!this.hasProperty('brightness')) return;
        const adjustedLevel = Math.min(Math.max(Math.round(level), 0), 100);
        this.setValue('brightness', adjustedLevel);
        if (device.gen === 1 && !this.hasProperty('gain'))
          ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { brightness: adjustedLevel });
        if (device.gen === 1 && this.hasProperty('gain')) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { gain: adjustedLevel });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index, brightness: adjustedLevel });
      };

      (this as ShellyComponentType).ColorRGB = function (red: number, green: number, blue: number) {
        if (!this.hasProperty('red') || !this.hasProperty('green') || !this.hasProperty('blue')) return;
        red = Math.min(Math.max(Math.round(red), 0), 255);
        green = Math.min(Math.max(Math.round(green), 0), 255);
        blue = Math.min(Math.max(Math.round(blue), 0), 255);
        this.setValue('red', red);
        this.setValue('green', green);
        this.setValue('blue', blue);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Set`, { id: this.index, red, green, blue });
      };
    }

    // Extend the class prototype to include the Cover methods dynamically
    if (isCoverComponent(name)) {
      (this as unknown as ShellyCoverComponent).Open = function () {
        this.setValue('state', 'open');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Open`, { id: this.index });
      };

      (this as unknown as ShellyCoverComponent).Close = function () {
        this.setValue('state', 'close');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Close`, { id: this.index });
      };

      (this as unknown as ShellyCoverComponent).Stop = function () {
        this.setValue('state', 'stop');
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'stop' });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.Stop`, { id: this.index });
      };

      (this as unknown as ShellyCoverComponent).GoToPosition = function (pos: number) {
        pos = Math.min(Math.max(Math.round(pos), 0), 100);
        if (device.gen === 1) ShellyDevice.fetch(device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'to_pos', roller_pos: pos });
        if (device.gen !== 1) ShellyDevice.fetch(device.log, device.host, `${this.name}.GoToPosition`, { id: this.index, pos: pos });
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
        this.device.log.debug(
          `***${CYAN}${this.id}:${key}${GREY} updated from ${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} to ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        this.device.emit('update', this.id, key, value);
        this.emit('update', this.id, key, value);
        property.value = value;
      } else {
        this.device.log.debug(
          `*${CYAN}${this.id}:${key}${GREY} not changed from ${YELLOW}${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
      }
    } else {
      this.addProperty(new ShellyProperty(this, key, value));
      this.device.log.debug(
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
