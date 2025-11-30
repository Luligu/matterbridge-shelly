// src/shellyComponent.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyComponent';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { jest } from '@jest/globals';
import { setupTest } from 'matterbridge/jestutils';

import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.ts';
import { ShellyDevice } from './shellyDevice.ts';
import { ShellyProperty } from './shellyProperty.ts';
import { ShellyData, ShellyDataType } from './shellyTypes.ts';
import { Shelly } from './shelly.ts';

// Setup the test environment
await setupTest(NAME, false);

describe('ShellyComponent', () => {
  let fetchSpy: jest.SpiedFunction<typeof ShellyDevice.fetch>;

  const log = new AnsiLogger({ logName: 'shellyComponentTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shelly = new Shelly(log);
  let device1: ShellyDevice;
  let device2: ShellyDevice;
  let device3: ShellyDevice;

  let id: string;
  let name: string;
  let data: ShellyData;

  const handleUpdate = jest.fn<(component: string, key: string, data: ShellyDataType) => void>().mockImplementation((component, key, data) => {});

  const handleEvent = jest.fn<(component: string, key: string, data: ShellyDataType) => void>().mockImplementation((component, key, data) => {});

  beforeAll(async () => {
    const mockDevice1 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
    const mockDevice2 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
    const mockDevice3 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplusrgbwpm-A0A3B35C7024.json'));
    if (mockDevice1) device1 = mockDevice1;
    if (mockDevice2) device2 = mockDevice2;
    if (mockDevice3) device3 = mockDevice3;

    fetchSpy = jest
      .spyOn(ShellyDevice, 'fetch')
      .mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
        // console.error(`ShellyDevice.fetch: ${host} ${service} ${stringify(params ?? {})}`);
        return Promise.resolve({});
      });
  });

  beforeEach(async () => {
    // Initialize variables here
    id = 'testId';
    name = 'testName';
    data = { key1: 'value', key2: 123, key3: true };

    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset variables here
  });

  afterAll(() => {
    shelly.destroy();
    device1.destroy();
    device2.destroy();
    device3.destroy();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should have mock gen 1 and gen 2', () => {
    expect(device1).not.toBeUndefined();
    expect(device2).not.toBeUndefined();
    expect(device3).not.toBeUndefined();
  });

  it('should construct properly with no data', () => {
    const component = new ShellyComponent(device1, id, name);
    expect(component.device).toBe(device1);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
  });

  it('should construct properly with data', () => {
    const component = new ShellyComponent(device1, id, name, data);
    expect(component.device).toBe(device1);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();
  });

  it('should construct properly with light onOff type component gen 1', () => {
    const data = { key1: 'value', key2: 123, key3: true, key4: { ison: true } };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, `light/0`, { turn: 'on' });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, `light/0`, { turn: 'off' });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, `light/0`, { turn: 'toggle' });
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    component.setValue('key4', { ison: false });
    expect(handleUpdate).toHaveBeenCalledTimes(4);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light onOff type component gen 2', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device2, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, `Light.Set`, { id: 0, on: true });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, `Light.Set`, { id: 0, on: false });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, `Light.Toggle`, { id: 0 });
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    expect(handleUpdate).toHaveBeenCalledTimes(3);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light onOff Level type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    expect(handleUpdate).toHaveBeenCalledTimes(3);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light type component and color temp', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50, rgb: [128, 128, 128], red: 128, green: 128, blue: 128, temp: 300 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(9);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(5000);

    device1.gen = 2;
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    device1.gen = 1;

    expect(fetchSpy).toHaveBeenCalledTimes(9);
  });

  it('should construct properly with light type component and color temp with mode', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50, red: 128, green: 128, blue: 128, temp: 300, mode: 'temp' };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(9);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(5000);

    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('should construct properly with light type component brightness', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should construct properly with relay type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, output: true, brightness: 50 };
    const component = new ShellyComponent(device2, 'relay:0', 'Relay', data);
    expect(component.id).toBe('relay:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Relay');
    expect(component.properties).toHaveLength(6);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeTruthy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellySwitchComponent).On();
    (component as ShellySwitchComponent).Off();
    (component as ShellySwitchComponent).Toggle();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('should construct properly with switch type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, ison: true };
    const component = new ShellyComponent(device1, 'switch:0', 'Switch', data);
    expect(component.id).toBe('switch:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Switch');
    expect(component.properties).toHaveLength(5);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeTruthy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();
  });

  it('should construct properly with cover type component', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device1, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should construct properly with cover type component gen 2', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device2, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should add property', () => {
    const component = new ShellyComponent(device1, id, name);
    const property = new ShellyProperty(component, 'key', 'value');
    component.addProperty(property);
    expect(component.addProperty(property)).toBe(component);
    expect(component.getProperty('key')).toBe(property);
    expect(component.getProperty('keynot')).toBeUndefined();
    expect(component.hasProperty('key')).toBeTruthy();
    expect(component.hasProperty('keynot')).toBeFalsy();
  });

  it('should set and get value', () => {
    const component = new ShellyComponent(device1, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
  });

  it('should set a new value', () => {
    const component = new ShellyComponent(device1, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
    component.setValue('key1', 'value3');
    component.setValue('key2', false);
    component.setValue('key3', 345);
    component.setValue('key1', 'valuedd');
    component.setValue('key2', true);
    component.setValue('key3', 456);
    component.setValue('key', 'value1');
    expect(component.getValue('key')).toBe('value1');
  });

  it('should update', () => {
    const data = { key: 'value' };
    const component = new ShellyComponent(device1, id, name, data);
    expect(component.getValue('key')).toBe('value');
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBe('newValue');
  });

  it('should not update', () => {
    const component = new ShellyComponent(device1, id, name);
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBeUndefined();
  });

  it('should be Light', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: true });
    expect(isLightComponent(component)).toBe(true);
    expect(isLightComponent(undefined)).toBe(false);
  });

  it('should be Switch', () => {
    const component = new ShellyComponent(device1, 'switch:0', 'Switch', { ison: true });
    expect(isSwitchComponent(component)).toBe(true);
    expect(isSwitchComponent(undefined)).toBe(false);
  });

  it('should be Cover', () => {
    const component = new ShellyComponent(device1, 'cover:0', 'Cover', { ison: true });
    expect(isCoverComponent(component)).toBe(true);
    expect(isCoverComponent(undefined)).toBe(false);
  });

  it('should update state true for ison', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for ison', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: false });
    expect(component.getValue('ison')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state true for output', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for output', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: false });
    expect(component.getValue('output')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should not update brightness and color', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: true, gain: 50, red: 20, green: 30, blue: 40 });
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
    expect(component.getProperty('brightness')).not.toBeUndefined();
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getProperty('red')).not.toBeUndefined();
    expect(component.getValue('red')).toBe(20);
    expect(component.getProperty('green')).not.toBeUndefined();
    expect(component.getValue('green')).toBe(30);
    expect(component.getProperty('blue')).not.toBeUndefined();
    expect(component.getValue('blue')).toBe(40);
    (component as ShellyLightComponent).Level(34);
    (component as ShellyLightComponent).ColorRGB(10, 20, 30);
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getValue('red')).toBe(20);
    expect(component.getValue('green')).toBe(30);
    expect(component.getValue('blue')).toBe(40);
    mockFetch.mockRestore();
  });

  it('should not update brightness and color for Rgb', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const component = new ShellyComponent(device3, 'light:0', 'Light', { output: true, brightness: 50, rgb: [20, 30, 40] });
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
    expect(component.getProperty('brightness')).not.toBeUndefined();
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getProperty('red')).toBeUndefined();
    expect(component.getProperty('green')).toBeUndefined();
    expect(component.getProperty('blue')).toBeUndefined();
    expect(component.getProperty('rgb')).toBeDefined();
    (component as ShellyLightComponent).Level(34);
    (component as ShellyLightComponent).ColorRGB(10, 20, 30);
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getValue('rgb')).toEqual([20, 30, 40]);
    mockFetch.mockRestore();
  });

  it('should iterate over properties', () => {
    const component = new ShellyComponent(device1, id, name, data);
    let count = 0;
    for (const [key, property] of component) {
      expect(property.key).toBe(key);
      count++;
    }
    expect(count).toBe(3);
  });

  it('should log properties', () => {
    const component = new ShellyComponent(device1, id, name, { key1: 'value', key2: 123, key3: true, key4: { on: true } });
    component.logComponent();
    expect(component).not.toBeUndefined();
  });
});
