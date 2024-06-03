import { AnsiLogger, TimestampFormat } from 'node-ansi-logger';
import { ShellyComponent, ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent';
import { ShellyDevice } from './shellyDevice';
import { ShellyProperty } from './shellyProperty';
import { ShellyData } from './shellyTypes';
import { Shelly } from './shelly';
import { jest } from '@jest/globals';

describe('ShellyComponent', () => {
  const log = new AnsiLogger({ logName: 'shellyComponentTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  const shelly = new Shelly(log);
  let device: ShellyDevice;
  let device2: ShellyDevice;

  let id: string;
  let name: string;
  let data: ShellyData;

  beforeAll(async () => {
    const mockDevice = await ShellyDevice.create(shelly, log, 'mock.192.168.1.219');
    const mockDevice2 = await ShellyDevice.create(shelly, log, 'mock.192.168.1.217');
    if (mockDevice) device = mockDevice;
    if (mockDevice2) device2 = mockDevice2;
  });

  beforeEach(async () => {
    // Initialize variables here
    id = 'testId';
    name = 'testName';
    data = { key1: 'value', key2: 123, key3: true };
  });

  afterEach(() => {
    // Reset variables here
  });

  afterAll(() => {
    shelly.destroy();
    device.destroy();
    device2.destroy();
  });

  it('should have mock gen 1 and gen 2', () => {
    expect(device).not.toBeUndefined();
    expect(device2).not.toBeUndefined();
  });

  it('should construct properly with no data', () => {
    const component = new ShellyComponent(device, id, name);
    expect(component.device).toBe(device);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
  });

  it('should construct properly with data', () => {
    const component = new ShellyComponent(device, id, name, data);
    expect(component.device).toBe(device);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
    expect(component.properties).toHaveLength(3);
    expect((component as ShellySwitchComponent).On).toBeUndefined();
    expect((component as ShellySwitchComponent).Off).toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).toBeUndefined();
    expect((component as ShellySwitchComponent).Level).toBeUndefined();
  });

  it('should construct properly with light type component', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Level).not.toBeUndefined();

    (component as ShellySwitchComponent).On();
    (component as ShellySwitchComponent).Off();
    (component as ShellySwitchComponent).Toggle();
    (component as ShellySwitchComponent).Level(50);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(4);
    mockFetch.mockRestore();
  });

  it('should construct properly with light type component brightness', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50 };
    const component = new ShellyComponent(device, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Level).not.toBeUndefined();

    (component as ShellySwitchComponent).On();
    (component as ShellySwitchComponent).Off();
    (component as ShellySwitchComponent).Toggle();
    (component as ShellySwitchComponent).Level(50);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(4);
    mockFetch.mockRestore();
  });

  it('should construct properly with relay type component', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const data = { key1: 'value', key2: 123, key3: true, output: true, brightness: 50 };
    const component = new ShellyComponent(device2, 'relay:0', 'Relay', data);
    expect(component.id).toBe('relay:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Relay');
    expect(component.properties).toHaveLength(6);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Level).not.toBeUndefined();

    (component as ShellySwitchComponent).On();
    (component as ShellySwitchComponent).Off();
    (component as ShellySwitchComponent).Toggle();
    (component as ShellySwitchComponent).Level(50);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(4);
    mockFetch.mockRestore();
  });

  it('should construct properly with switch type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, ison: true };
    const component = new ShellyComponent(device, 'switch:0', 'Switch', data);
    expect(component.id).toBe('switch:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Switch');
    expect(component.properties).toHaveLength(5);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Level).not.toBeUndefined();
  });

  it('should construct properly with cover type component', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellySwitchComponent).On).toBeUndefined();
    expect((component as ShellySwitchComponent).Off).toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).toBeUndefined();
    expect((component as ShellySwitchComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(4);

    mockFetch.mockRestore();
  });

  it('should construct properly with cover type component gen 2', () => {
    const mockFetch = jest.spyOn(ShellyDevice, 'fetch').mockResolvedValue({});
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device2, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellySwitchComponent).On).toBeUndefined();
    expect((component as ShellySwitchComponent).Off).toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).toBeUndefined();
    expect((component as ShellySwitchComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);
    expect(mockFetch).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(4);

    mockFetch.mockRestore();
  });

  it('should add property', () => {
    const component = new ShellyComponent(device, id, name);
    const property = new ShellyProperty(component, 'key', 'value');
    component.addProperty(property);
    expect(component.addProperty(property)).toBe(component);
    expect(component.getProperty('key')).toBe(property);
    expect(component.getProperty('keynot')).toBeUndefined();
    expect(component.hasProperty('key')).toBeTruthy();
    expect(component.hasProperty('keynot')).toBeFalsy();
  });

  it('should set and get value', () => {
    const component = new ShellyComponent(device, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
  });

  it('should set a new value', () => {
    const component = new ShellyComponent(device, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
    component.setValue('key', 'value1');
    expect(component.getValue('key')).toBe('value1');
  });

  it('should update', () => {
    const data = { key: 'value' };
    const component = new ShellyComponent(device, id, name, data);
    expect(component.getValue('key')).toBe('value');
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBe('newValue');
  });

  it('should not update', () => {
    const component = new ShellyComponent(device, id, name);
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBeUndefined();
  });

  it('should update state true for ison', () => {
    const component = new ShellyComponent(device, 'light:0', 'Light', { ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for ison', () => {
    const component = new ShellyComponent(device, 'light:0', 'Light', { ison: false });
    expect(component.getValue('ison')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state true for output', () => {
    const component = new ShellyComponent(device, 'light:0', 'Light', { output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for output', () => {
    const component = new ShellyComponent(device, 'light:0', 'Light', { output: false });
    expect(component.getValue('output')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should iterate over properties', () => {
    const component = new ShellyComponent(device, id, name, data);
    let count = 0;
    for (const [key, property] of component) {
      expect(property.key).toBe(key);
      count++;
    }
    expect(count).toBe(3);
  });

  it('should log properties', () => {
    const component = new ShellyComponent(device, id, name, { key1: 'value', key2: 123, key3: true, key4: { on: true } });
    component.logComponent();
    expect(component).not.toBeUndefined();
  });
});
