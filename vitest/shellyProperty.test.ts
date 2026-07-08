/**
 * @file vitest/shellyProperty.test.ts
 * @description This file contains the tests for the ShellyProperty class.
 * @author Luca Liguori
 */

const NAME = 'ShellyProperty';

import { setupTest } from 'matterbridge/vitest-utils';

import { ShellyComponent } from '../src/shellyComponent.js';
import type { ShellyDevice } from '../src/shellyDevice.js';
import { ShellyProperty } from '../src/shellyProperty.js';
import type { ShellyDataType } from '../src/shellyTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('ShellyProperty', () => {
  const device: ShellyDevice = {} as ShellyDevice;
  let component: ShellyComponent;
  let key: string;
  let value: ShellyDataType;

  beforeEach(() => {
    component = new ShellyComponent(device, 'component', 'Component');
    key = 'testKey';
    value = 'testValue';
  });

  it('should construct properly', () => {
    const property = new ShellyProperty(component, key, value);
    expect(property.component).toBe(component);
    expect(property.key).toBe(key);
    expect(property.value).toBe(value);
  });

  it('should get value', () => {
    const property = new ShellyProperty(component, key, value);
    expect(property.value).toBe(value);
  });

  it('should set value', () => {
    const property = new ShellyProperty(component, key, value);
    const newValue = 'newValue';
    property.value = newValue;
    expect(property.value).toBe(newValue);
  });
});
