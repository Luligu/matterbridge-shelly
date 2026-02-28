// src/shellyProperty.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyProperty';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { setupTest } from 'matterbridge/jestutils';

import { ShellyComponent } from './shellyComponent.ts';
import { ShellyDevice } from './shellyDevice.ts';
import { ShellyProperty } from './shellyProperty.ts';
import { ShellyDataType } from './shellyTypes.ts';

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
