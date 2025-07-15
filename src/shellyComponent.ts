/**
 * @description This file contains the class SwitchComponent.
 * @file src\shellyComponent.ts
 * @author Luca Liguori
 * @created 2024-05-01
 * @version 2.1.0
 * @license Apache-2.0
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
 * limitations under the License.
 */

import EventEmitter from 'node:events';

import { BLUE, CYAN, GREEN, GREY, YELLOW, db, debugStringify, er } from 'matterbridge/logger';
import { deepEqual, isValidArray, isValidNumber, isValidObject } from 'matterbridge/utils';

import { ShellyData, ShellyDataType, ShellyEvent } from './shellyTypes.js';
import { ShellyProperty } from './shellyProperty.js';
import { ShellyDevice } from './shellyDevice.js';

interface LightComponent {
  On(): void;
  Off(): void;
  Toggle(): void;
  Level(level: number): void;
  ColorRGB(red: number, green: number, blue: number): void;
  ColorTemp(temperature: number): void;
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

/**
 *  Checks if the given component is a light component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyLightComponent} Returns true if the component is a light component, false otherwise.
 */
export function isLightComponent(component: ShellyComponent | undefined): component is ShellyLightComponent {
  if (component === undefined) return false;
  return ['Light', 'Rgb', 'Rgbw', 'Cct'].includes(component.name);
}

/**
 * Checks if the given component is a switch component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellySwitchComponent} Returns true if the component is a switch component, false otherwise.
 */
export function isSwitchComponent(component: ShellyComponent | undefined): component is ShellySwitchComponent {
  if (component === undefined) return false;
  return ['Relay', 'Switch'].includes(component.name);
}

/**
 * Checks if the given component is a cover component.
 *
 * @param {ShellyComponent | undefined} component - The component to check.
 * @returns {component is ShellyCoverComponent} Returns true if the component is a cover component, false otherwise.
 */
export function isCoverComponent(component: ShellyComponent | undefined): component is ShellyCoverComponent {
  if (component === undefined) return false;
  return ['Cover', 'Roller'].includes(component.name);
}

interface ShellyComponentEvent {
  update: [component: string, key: string, data: ShellyDataType];
  event: [component: string, event: string, data: ShellyEvent];
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
   *
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
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'on' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, on: true });
      };

      this.Off = function () {
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'off' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, on: false });
      };

      this.Toggle = function () {
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { turn: 'toggle' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Toggle`, { id: this.index });
      };
    }

    // Extend the ShellyComponent class prototype to include the Light methods dynamically
    if (isLightComponent(this)) {
      this.Level = function (level: number) {
        if (!this.hasProperty('brightness')) return;
        const adjustedLevel = Math.min(Math.max(Math.round(level), 0), 100);
        if (device.gen === 1 && this.hasProperty('brightness'))
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
          // SHCB-1
          if (device.gen === 1 && this.hasProperty('mode'))
            ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue, mode: 'color' });
          // SHBDUO-1
          if (device.gen === 1 && !this.hasProperty('mode'))
            ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue });
          if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, red, green, blue });
        }
        if (this.hasProperty('rgb') && isValidArray(this.getValue('rgb'), 3, 3)) {
          red = Math.min(Math.max(Math.round(red), 0), 255);
          green = Math.min(Math.max(Math.round(green), 0), 255);
          blue = Math.min(Math.max(Math.round(blue), 0), 255);
          if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { red, green, blue });
          if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, rgb: [red, green, blue] });
        }
      };

      this.ColorTemp = function (temperature: number) {
        if (isValidNumber(temperature, 2700, 6500)) {
          // SHCB-1
          if (device.gen === 1 && this.hasProperty('temp') && this.hasProperty('mode'))
            ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { temp: temperature, mode: 'white' });
          // SHBDUO-1
          if (device.gen === 1 && this.hasProperty('temp') && !this.hasProperty('mode'))
            ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { temp: temperature });
          // shellyprorgbwwpm
          if (device.gen !== 1 && this.hasProperty('ct')) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Set`, { id: this.index, ct: temperature });
        }
      };
    }

    // Extend the ShellyComponent class prototype to include the Cover methods dynamically
    if (isCoverComponent(this)) {
      this.Open = function () {
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'open' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Open`, { id: this.index });
      };

      this.Close = function () {
        if (device.gen === 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${id.slice(0, id.indexOf(':'))}/${this.index}`, { go: 'close' });
        if (device.gen !== 1) ShellyDevice.fetch(device.shelly, device.log, device.host, `${this.name}.Close`, { id: this.index });
      };

      this.Stop = function () {
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

  override emit<K extends keyof ShellyComponentEvent>(eventName: K, ...args: ShellyComponentEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof ShellyComponentEvent>(eventName: K, listener: (...args: ShellyComponentEvent[K]) => void): this {
    return super.on(eventName, listener);
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
          `*${CYAN}${this.id}:${key}${GREY} updated from ${isValidObject(property.value) ? debugStringify(property.value) : property.value}${GREY} to ${YELLOW}${isValidObject(value) ? debugStringify(value) : value}${GREY} in component ${GREEN}${this.id}${GREY} (${BLUE}${this.name}${GREY})`,
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

  /**
   * Retrieves all properties of the ShellyComponent.
   *
   * @returns {ShellyProperty[]} An array of ShellyProperty objects representing the properties of the component.
   */
  get properties(): ShellyProperty[] {
    return Array.from(this._properties.values());
  }

  /**
   * Retrieves an iterator for the key-value pairs of the ShellyComponent's properties.
   *
   * @yields {[string, ShellyProperty]} A key-value pair where the key is the property key and the value is the ShellyProperty.
   */
  *[Symbol.iterator](): IterableIterator<[string, ShellyProperty]> {
    for (const [key, property] of this._properties.entries()) {
      yield [key, property];
    }
  }

  /**
   * Updates the component with the provided data.
   *
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
   *
   * @returns {number} The number of the properties.
   */
  logComponent(): number {
    this.device.log.debug(`Component ${GREEN}${this.id}${db} (${BLUE}${this.name}${db}) has the following ${this._properties.size} properties:`);
    for (const [key, property] of this) {
      this.device.log.debug(`- ${key}: ${property.value && typeof property.value === 'object' ? debugStringify(property.value) : property.value}`);
    }
    return this._properties.size;
  }
}
