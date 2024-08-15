/**
 * This file contains the class SwitchComponent.
 *
 * @file src\shellyComponent.ts
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

import { BLUE, CYAN, GREEN, GREY, YELLOW, db, debugStringify, er } from 'matterbridge/logger';

import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { ShellyProperty } from './shellyProperty.js';
import { ShellyDevice } from './shellyDevice.js';
import { deepEqual } from 'matterbridge/utils';
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

export function isLightComponent(component: ShellyComponent | undefined): component is ShellyLightComponent {
  if (component === undefined) return false;
  return ['Light', 'Rgb', 'Rgbw'].includes(component.name);
}

export function isSwitchComponent(component: ShellyComponent | undefined): component is ShellySwitchComponent {
  if (component === undefined) return false;
  return ['Relay', 'Switch'].includes(component.name);
}

export function isCoverComponent(component: ShellyComponent | undefined): component is ShellyCoverComponent {
  if (component === undefined) return false;
  return ['Cover', 'Roller'].includes(component.name);
}

/**
 * Rappresents the ShellyComponent class.
 */
export class ShellyComponent extends EventEmitter {
  readonly device: ShellyDevice;
  readonly id: string;
  readonly index: number;
  readonly name: string;
  private readonly _properties = new Map<string, ShellyProperty>();

  /**
   * Creates a new instance of the ShellyComponent class.
   * @param {ShellyDevice} device - The Shelly device associated with the component.
   * @param {string} id - The ID of the component.
   * @param {string} name - The name of the component.
   * @param {ShellyData} [data] - The data associated with the component.
   */
  constructor(device: ShellyDevice, id: string, name: string, data?: ShellyData) {
    super();
    this.id = id;
    this.index = id.includes(':') ? parseInt(id.split(':')[1]) : -1;
    this.name = name;
    this.device = device;
    for (const prop in data) {
      this.addProperty(new ShellyProperty(this, prop, data[prop] as ShellyDataType));

      // Add a state property for Light, Relay, and Switch components
      if ((isSwitchComponent(this) || isLightComponent(this)) && (prop === 'ison' || prop === 'output')) this.addProperty(new ShellyProperty(this, 'state', data[prop]));

      // Add a brightness property for Light components
      if (isLightComponent(this) && prop === 'gain') this.addProperty(new ShellyProperty(this, 'brightness', data[prop]));
    }

    // Extend the ShellyComponent class prototype to include the Switch Relay Light methods dynamically
    if (isSwitchComponent(this) || isLightComponent(this)) {
      this.On = function () {
        // this.setValue('state', true);
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'on' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, on: true });
      };

      this.Off = function () {
        // this.setValue('state', false);
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'off' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, on: false });
      };

      this.Toggle = function () {
        // const currentState = this.getValue('state');
        // this.setValue('state', !currentState);
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'toggle' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Toggle`, { id: this.index });
      };
    }

    // Extend the ShellyComponent class prototype to include the Light methods dynamically
    if (isLightComponent(this)) {
      this.Level = function (level: number) {
        if (!this.hasProperty('brightness')) return;
        const adjustedLevel = Math.min(Math.max(Math.round(level), 0), 100);
        // this.setValue('brightness', adjustedLevel);
        if (device.gen === 1 && !this.hasProperty('gain'))
          ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { brightness: adjustedLevel });
        if (device.gen === 1 && this.hasProperty('gain'))
          ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { gain: adjustedLevel });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, brightness: adjustedLevel });
      };

      this.ColorRGB = function (red: number, green: number, blue: number) {
        if (this.hasProperty('red') && this.hasProperty('green') && this.hasProperty('blue')) {
          red = Math.min(Math.max(Math.round(red), 0), 255);
          green = Math.min(Math.max(Math.round(green), 0), 255);
          blue = Math.min(Math.max(Math.round(blue), 0), 255);
          // this.setValue('red', red);
          // this.setValue('green', green);
          // this.setValue('blue', blue);
          if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue });
          if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, red, green, blue });
        }
        if (this.hasProperty('rgb') && this.getValue('rgb') !== null && this.getValue('rgb') !== undefined && Array.isArray(this.getValue('rgb'))) {
          red = Math.min(Math.max(Math.round(red), 0), 255);
          green = Math.min(Math.max(Math.round(green), 0), 255);
          blue = Math.min(Math.max(Math.round(blue), 0), 255);
          // this.setValue('rgb', [red, green, blue]);
          if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, rgb: [red, green, blue] as any });
        }
      };
    }

    // Extend the ShellyComponent class prototype to include the Cover methods dynamically
    if (isCoverComponent(this)) {
      this.Open = function () {
        // this.setValue('state', 'open');
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Open`, { id: this.index });
      };

      this.Close = function () {
        // this.setValue('state', 'close');
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Close`, { id: this.index });
      };

      this.Stop = function () {
        // this.setValue('state', 'stop');
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'stop' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Stop`, { id: this.index });
      };

      this.GoToPosition = function (pos: number) {
        pos = Math.min(Math.max(Math.round(pos), 0), 100);
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'to_pos', roller_pos: pos });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.GoToPosition`, { id: this.index, pos: pos });
      };
    }
  }

  /**
   * Checks if the component has a property with the specified key.
   *
   * @param {string} key - The key of the property to check.
   * @returns {boolean} true if the component has the property, false otherwise.
   */
  hasProperty(key: string): boolean {
    return this._properties.has(key);
  }

  /**
   * Retrieves the value of a property based on the specified key.
   *
   * @param {string} key - The key of the property to retrieve.
   * @returns {ShellyProperty | undefined} The value of the property, or undefined if the property does not exist.
   */
  getProperty(key: string): ShellyProperty | undefined {
    return this._properties.get(key);
  }

  /**
   * Adds a property to the ShellyComponent.
   *
   * @param {ShellyProperty} property - The property to add.
   * @returns {ShellyComponent} The updated ShellyComponent instance.
   */
  addProperty(property: ShellyProperty): ShellyComponent {
    this._properties.set(property.key, property);
    return this;
  }

  /**
   * Sets the value of a property in the ShellyComponent.
   * If the property already exists, it updates the value.
   * If the property doesn't exist, it adds a new property with the specified value.
   * Emits an 'update' event after updating the value.
   *
   * @param {string} key - The key of the property.
   * @param {ShellyDataType} value - The value to set for the property.
   * @returns {ShellyComponent} The updated ShellyComponent instance.
   */
  setValue(key: string, value: ShellyDataType): ShellyComponent {
    const property = this.getProperty(key);
    if (property) {
      if (!deepEqual(property.value, value)) {
        this.device.log.debug(
          `*${CYAN}${this.id}:${key}${GREY} updated from ${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} to ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        this.device.emit('update', this.id, key, value);
        this.emit('update', this.id, key, value);
        property.value = value;
      } else {
        /*
        this.device.log.debug(
          `${CYAN}${this.id}:${key}${GREY} not changed from ${YELLOW}${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value) : property.value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
        );
        */
      }
    } else {
      this.addProperty(new ShellyProperty(this, key, value));
      this.device.log.debug(
        `*${CYAN}${this.id}:${key}${GREY} added with value ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${GREY} to component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
      );
    }
    return this;
  }

  /**
   * Retrieves the value of a property based on the provided key.
   * If the property is found, its value is returned. Otherwise, an error message is logged and `undefined` is returned.
   *
   * @param {string} key - The key of the property to retrieve.
   * @returns {ShellyDataType} The value of the property if found, otherwise `undefined`.
   */
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

  /**
   * Updates the component with the provided data.
   * @param {ShellyData} componentData - The data to update the component with.
   */
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

  /**
   * Logs the component details and properties.
   * @returns The number of the properties.
   */
  logComponent() {
    this.device.log.debug(`Component ${GREEN}${this.id}${db} (${BLUE}${this.name}${db}) has the following ${this._properties.size} properties:`);
    for (const [key, property] of this) {
      this.device.log.debug(`- ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
    }
    return this._properties.size;
  }
}
