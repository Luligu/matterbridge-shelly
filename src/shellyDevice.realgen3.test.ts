// src/shellyDevice.realgen3.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceRealGen3';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { setupTest } from 'matterbridge/jestutils';
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';

import { Shelly } from './shelly.js';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyData } from './shellyTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Shellies', () => {
  const log = new AnsiLogger({ logName: 'ShellyDeviceRealTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.7.1-gd336f31';
  const address = ['*c4:cb:76:b3:cd:1f', '*00:15:5d:58:f3:aa'];

  beforeAll(async () => {
    shelly.dataPath = HOMEDIR;
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (device) {
      shelly.removeDevice(device);
      device.destroy();
      device = undefined;
    }
    await wait(1000);
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(1000);

    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  if (!address.includes(getMacAddress() || '')) return;

  test('create a sleepy gen 3 shellyhtg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.100');
    // expect(device).not.toBeUndefined(); // Skip this test if is sleeping
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.100');
    expect(device.model).toBe('S3SN-0U12A');
    expect(device.mac).toBe('3030F9EC8468');
    expect(device.id).toBe('shellyhtg3-3030F9EC8468');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.5-gbf870ca'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('H&T Gen3');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(12);
    // prettier-ignore
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Devicepower', 'Humidity', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'devicepower:0', 'humidity:0', 'mqtt', 'sys', 'sntp', 'temperature:0', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('devicepower:0')).not.toBeUndefined();
    expect(device.getComponent('devicepower:0')?.getValue('battery')).toBeDefined();
    const battery = device.getComponent('devicepower:0')?.getValue('battery') as ShellyData;
    expect(battery).toBeDefined();
    expect(battery.V).toBeGreaterThanOrEqual(1);
    expect(battery.percent).toBeGreaterThanOrEqual(1);
    expect(device.getComponent('temperature:0')).not.toBeUndefined();
    expect(device.getComponent('temperature:0')?.getValue('tC')).toBeGreaterThanOrEqual(1);
    expect(device.getComponent('temperature:0')?.getValue('tF')).toBeGreaterThanOrEqual(1);
    expect(device.getComponent('humidity:0')).not.toBeUndefined();
    expect(device.getComponent('humidity:0')?.getValue('rh')).toBeGreaterThanOrEqual(1);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shelly1g3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.157');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.157');
    expect(device.model).toBe('S3SW-001X16EU');
    expect(device.mac).toBe('34B7DACAC830');
    expect(device.id).toBe('shelly1g3-34B7DACAC830');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('1 Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shelly1minig3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.221');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.221');
    expect(device.model).toBe('S3SW-001X8EU');
    expect(device.mac).toBe('543204547478');
    expect(device.id).toBe('shelly1minig3-543204547478');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(true);
    expect(device.name).toBe('1mini Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);

    expect(device.bthomeDevices.size).toBe(4);
    expect(device.bthomeDevices.has('0c:ef:f6:f1:d7:7b')).toBe(true);
    expect(device.bthomeDevices.get('0c:ef:f6:f1:d7:7b')?.model).toBe('Shelly BLU DoorWindow');
    expect(device.bthomeDevices.has('38:39:8f:8b:d2:29')).toBe(true);
    expect(device.bthomeDevices.get('38:39:8f:8b:d2:29')?.model).toBe('Shelly BLU Button1');
    expect(device.bthomeDevices.has('7c:c6:b6:65:2d:87')).toBe(true);
    expect(device.bthomeDevices.get('7c:c6:b6:65:2d:87')?.model).toBe('Shelly BLU HT');
    expect(device.bthomeDevices.has('0c:ae:5f:5a:0b:fa')).toBe(true);
    expect(device.bthomeDevices.get('0c:ae:5f:5a:0b:fa')?.model).toBe('Shelly BLU Motion');

    expect(device.bthomeSensors.size).toBe(14);

    // BLU DoorWindow
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Contact');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(45);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Rotation');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(63);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(0);

    // BLU Button
    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('38:39:8f:8b:d2:29');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:205')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:205')?.addr).toBe('38:39:8f:8b:d2:29');
    expect(device.bthomeSensors.get('bthomesensor:205')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorIdx).toBe(0);

    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:206')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:206')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:206')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:207')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:207')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:207')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:208')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:208')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:208')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:209')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:209')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:209')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorIdx).toBe(0);

    // BLU Motion
    expect(device.bthomeSensors.has('bthomesensor:210')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:210')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:210')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:211')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:211')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:211')?.name).toBe('Motion');
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorId).toBe(33);
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:212')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:212')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:212')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:213')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:213')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:213')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorIdx).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shelly1pmg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.158');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.158');
    expect(device.model).toBe('S3SW-001P16EU');
    expect(device.mac).toBe('34B7DAC68344');
    expect(device.id).toBe('shelly1pmg3-34B7DAC68344');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('1PM Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(3);
    expect(device.bthomeDevices.has('7c:c6:b6:65:2d:87')).toBe(true);
    expect(device.bthomeDevices.get('7c:c6:b6:65:2d:87')?.model).toBe('Shelly BLU HT');
    expect(device.bthomeDevices.has('0c:ef:f6:f1:d7:7b')).toBe(true);
    expect(device.bthomeDevices.get('0c:ef:f6:f1:d7:7b')?.model).toBe('Shelly BLU DoorWindow');
    expect(device.bthomeDevices.has('38:39:8f:8b:d2:29')).toBe(true);
    expect(device.bthomeDevices.get('38:39:8f:8b:d2:29')?.model).toBe('Shelly BLU Button1');

    expect(device.bthomeSensors.size).toBe(10);
    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(0);

    // BLU DoorWindow
    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:205')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:205')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:205')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:206')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:206')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:206')?.name).toBe('Contact');
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorId).toBe(45);
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:207')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:207')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:207')?.name).toBe('Rotation');
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorId).toBe(63);
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorIdx).toBe(0);

    // BLU Button
    expect(device.bthomeSensors.has('bthomesensor:208')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:208')?.addr).toBe('38:39:8f:8b:d2:29');
    expect(device.bthomeSensors.get('bthomesensor:208')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:209')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:209')?.addr).toBe('38:39:8f:8b:d2:29');
    expect(device.bthomeSensors.get('bthomesensor:209')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:210')).toBe(false);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shelly1pmminig3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.225');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.225');
    expect(device.model).toBe('S3SW-001P8EU');
    expect(device.mac).toBe('543204519264');
    expect(device.id).toBe('shelly1pmminig3-543204519264');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('1PMmini Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shelly2pmg3 mode cover device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.166');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.166');
    expect(device.model).toBe('S3SW-002P16EU');
    expect(device.mac).toBe('34CDB0770C4C');
    expect(device.id).toBe('shelly2pmg3-34CDB0770C4C');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.99-2pmg3prod0-ge3db05c'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('2PM Gen3 Cover');
    expect(device.profile).toBe('cover');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);

    expect(device.bthomeDevices.size).toBe(4);
    expect(device.bthomeDevices.has('7c:c6:b6:58:b9:a0')).toBe(true);
    expect(device.bthomeDevices.get('7c:c6:b6:58:b9:a0')?.model).toBe('Shelly BLU RC Button 4');
    expect(device.bthomeDevices.has('0c:ef:f6:01:8d:b8')).toBe(true);
    expect(device.bthomeDevices.get('0c:ef:f6:01:8d:b8')?.model).toBe('Shelly BLU Wall Switch 4');
    expect(device.bthomeDevices.has('0c:ef:f6:f1:d7:7b')).toBe(true);
    expect(device.bthomeDevices.get('0c:ef:f6:f1:d7:7b')?.model).toBe('Shelly BLU DoorWindow');
    expect(device.bthomeDevices.has('0c:ae:5f:5a:0b:fa')).toBe(true);
    expect(device.bthomeDevices.get('0c:ae:5f:5a:0b:fa')?.model).toBe('Shelly BLU Motion');

    expect(device.bthomeSensors.size).toBe(18);

    // BLU RC Button 4
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(1);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(2);

    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(3);

    // BLU RC Wall Switch 4
    expect(device.bthomeSensors.has('bthomesensor:205')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:205')?.addr).toBe('0c:ef:f6:01:8d:b8');
    expect(device.bthomeSensors.get('bthomesensor:205')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:206')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:206')?.addr).toBe('0c:ef:f6:01:8d:b8');
    expect(device.bthomeSensors.get('bthomesensor:206')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:207')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:207')?.addr).toBe('0c:ef:f6:01:8d:b8');
    expect(device.bthomeSensors.get('bthomesensor:207')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorIdx).toBe(1);

    expect(device.bthomeSensors.has('bthomesensor:208')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:208')?.addr).toBe('0c:ef:f6:01:8d:b8');
    expect(device.bthomeSensors.get('bthomesensor:208')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorIdx).toBe(2);

    expect(device.bthomeSensors.has('bthomesensor:209')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:209')?.addr).toBe('0c:ef:f6:01:8d:b8');
    expect(device.bthomeSensors.get('bthomesensor:209')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorIdx).toBe(3);

    // BLU DoorWindow
    expect(device.bthomeSensors.has('bthomesensor:210')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:210')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:210')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:211')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:211')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:211')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:212')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:212')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:212')?.name).toBe('Contact');
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorId).toBe(45);
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:213')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:213')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:213')?.name).toBe('Rotation');
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorId).toBe(63);
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorIdx).toBe(0);

    // BLU Motion
    expect(device.bthomeSensors.has('bthomesensor:214')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:214')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:214')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:215')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:215')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:215')?.name).toBe('Motion');
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorId).toBe(33);
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:216')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:216')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:216')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:217')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:217')?.addr).toBe('0c:ae:5f:5a:0b:fa');
    expect(device.bthomeSensors.get('bthomesensor:217')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorIdx).toBe(0);

    const cover = device.getComponent('cover:0');
    expect(cover).not.toBeUndefined();
    if (!cover) return;
    expect(cover?.getValue('voltage')).toBeGreaterThan(200);
    expect(cover?.hasProperty('apower')).toBe(true);
    expect(cover?.hasProperty('current')).toBe(true);
    expect(cover?.hasProperty('aenergy')).toBe(true);
    expect(cover?.hasProperty('freq')).toBe(true);

    expect(cover?.getValue('current_pos')).toBe(0);

    // prettier-ignore
    if (isCoverComponent(cover)) {
      cover.Open();
      await waiter('Open()', () => { return (cover.getValue('state') === 'opening') }, true, 30000);
      await waiter('Open() II', () => { return (cover.getValue('state') === 'stopped') }, true, 30000);
      // await waiter('Open() III', () => { return (cover.getValue('current_pos') === 100) }, true, 30000);

      cover.Close();
      await waiter('Close() AI', () => { return (cover.getValue('state') === 'closing') }, true, 30000);
      
      cover.Stop();
      // console.error(`Stop() I state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      await waiter('Stop() I', () => { return (cover.getValue('state') === 'stopped') }, true, 30000);
      // console.error(`Stop() II state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      // await waiter('Stop() II', () => { return (cover.getValue('current_pos') !== 100) }, true, 30000);

      cover.Close();
      // console.error(`Close() AI state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      await waiter('Close() AI', () => { return (cover.getValue('state') === 'closing') }, true, 30000);
      // console.error(`Close() AII state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      await waiter('Close() AII', () => { return (cover.getValue('state') === 'stopped') }, true, 30000);
      // console.error(`Close() AIII state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      await waiter('Close() AIII', () => { return (cover.getValue('current_pos') === 0) }, true, 30000);

      cover.GoToPosition(10);
      // console.error(`GoToPosition(10) state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      // await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
      // console.error(`GoToPosition(10) I state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      // await waiter('GoToPosition(10) II', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
      // console.error(`GoToPosition(10) II state ${cover.getValue('state')} pos ${cover.getValue('current_pos')}`);
      await waiter('GoToPosition(10) III', () => { return (cover.getValue('current_pos') === 10) }, true, 30000);

      cover.Close();
      // await waiter('Close() BI', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
      // await waiter('Close() BII', () => { return cover.getValue('current_pos') === 0 || (cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'); }, true, 30000);
      await waiter('Close() BIII', () => { return (cover.getValue('current_pos') === 0) }, true, 30000);
    }

    expect(cover?.getValue('current_pos')).toBe(0);

    shelly.removeDevice(device);
    device.destroy();
  }, 120000);

  test('create a gen 3 shelly2pmg3 mode switch device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.172');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.172');
    expect(device.model).toBe('S3SW-002P16EU');
    expect(device.mac).toBe('8CBFEA9DE29C');
    expect(device.id).toBe('shelly2pmg3-8CBFEA9DE29C');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.99-2pmg3prod0-ge3db05c'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('2PM Gen3 Switch');
    expect(device.profile).toBe('switch');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'mqtt', 'switch:0', 'switch:1', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();
    expect(component?.getValue('voltage')).toBeGreaterThan(200);
    expect(component?.hasProperty('apower')).toBe(true);
    expect(component?.hasProperty('current')).toBe(true);
    expect(component?.hasProperty('aenergy')).toBe(true);
    expect(component?.hasProperty('freq')).toBe(true);

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);
    }

    const component1 = device.getComponent('switch:1');
    expect(component1).not.toBeUndefined();
    expect(component1?.getValue('voltage')).toBeGreaterThan(200);
    expect(component1?.hasProperty('apower')).toBe(true);
    expect(component1?.hasProperty('current')).toBe(true);
    expect(component1?.hasProperty('aenergy')).toBe(true);
    expect(component1?.hasProperty('freq')).toBe(true);

    // prettier-ignore
    if (isSwitchComponent(component1)) {
      component1.On();
      await waiter('On', () => { return component1.getValue('state') === true; }, true);

      component1.Off();
      await waiter('Off', () => { return component1.getValue('state') === false; }, true);

      component1.Toggle();
      await waiter('Toggle', () => { return component1.getValue('state') === true; }, true);

      component1.Off();
      await waiter('Off', () => { return component1.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shellyblugwg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.164');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.164');
    expect(device.model).toBe('S3GW-1DBT001');
    expect(device.mac).toBe('34CDB077BCD4');
    expect(device.id).toBe('shellyblugwg3-34CDB077BCD4');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.99-blugwg3prod4-g110402b'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('BLU Gateway Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Blugw', 'Cloud', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'blugw', 'cloud', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(2);
    expect(device.bthomeTrvs.has('28:68:47:fc:9a:6b')).toBe(true);
    expect(device.bthomeTrvs.get('28:68:47:fc:9a:6b')?.id).toBe(200);
    expect(device.bthomeTrvs.get('28:68:47:fc:9a:6b')?.bthomedevice).toBe('bthomedevice:200');
    expect(device.bthomeTrvs.has('28:db:a7:b5:d1:ca')).toBe(true);
    expect(device.bthomeTrvs.get('28:db:a7:b5:d1:ca')?.id).toBe(201);
    expect(device.bthomeTrvs.get('28:db:a7:b5:d1:ca')?.bthomedevice).toBe('bthomedevice:203');

    expect(device.bthomeDevices.size).toBe(5);
    expect(device.bthomeDevices.has('28:68:47:fc:9a:6b')).toBe(true);
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.model).toBe('Shelly BLU Trv');
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.id).toBe(200);
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.blutrv_id).toBe(200);
    expect(device.bthomeDevices.has('28:db:a7:b5:d1:ca')).toBe(true);
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.model).toBe('Shelly BLU Trv');
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.id).toBe(203);
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.blutrv_id).toBe(201);

    // TRV 200
    expect(device.bthomeSensors.size).toBe(20);
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(1);

    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:205')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:205')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:205')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:206')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:206')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:206')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:207')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:207')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:207')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorIdx).toBe(0);

    // BLU DoorWindow
    expect(device.bthomeSensors.has('bthomesensor:208')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:208')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:208')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:209')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:209')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:209')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:210')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:210')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:210')?.name).toBe('Contact');
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorId).toBe(45);
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:211')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:211')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:211')?.name).toBe('Rotation');
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorId).toBe(63);
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorIdx).toBe(0);

    // TRV 201
    expect(device.bthomeSensors.has('bthomesensor:212')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:212')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:212')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:213')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:213')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:213')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:214')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:214')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:214')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:215')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:215')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:215')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorIdx).toBe(1);

    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:216')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:216')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:216')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:217')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:217')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:217')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:218')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:218')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:218')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:218')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:218')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:219')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:219')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:219')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:219')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:219')?.sensorIdx).toBe(0);

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 3 shellyddimmerg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.242');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.242');
    expect(device.mac).toBe('84FCE636832C');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('S3DM-0A1WW');
    expect(device.id).toBe('shellyddimmerg3-84FCE636832C');
    expect(device.firmware).toBe('g55db545'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('DALI Dimmer Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isLightComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(100);
      await waiter('Level(100)', () => { return component.getValue('brightness') === 100; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Level(50);
      await waiter('Level(50)', () => { return component.getValue('brightness') === 50; }, true); 

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(1);
      await waiter('Level(1)', () => { return component.getValue('brightness') === 1; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 3 shellyemg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.243');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.243');
    expect(device.mac).toBe('84FCE636582C');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('S3EM-002CXCEU');
    expect(device.id).toBe('shellyemg3-84FCE636582C');
    expect(device.firmware).toBe('g1216eb0'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('EM Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'em1:1', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);

    expect(device.bthomeDevices.size).toBe(0);

    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 3 shellyi4g3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.159');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.159');
    expect(device.mac).toBe('5432045661B4');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('S3SN-0024X');
    expect(device.id).toBe('shellyi4g3-5432045661B4');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('i4 Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponent('input:0')).not.toBeUndefined();
    expect(device.getComponent('input:0')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:0')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:0')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:1')).not.toBeUndefined();
    expect(device.getComponent('input:1')?.getValue('enable')).toBe(false);
    expect(device.getComponent('input:1')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:1')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:2')).not.toBeUndefined();
    expect(device.getComponent('input:2')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:2')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:2')?.getValue('type')).toBe('switch');

    expect(device.getComponent('input:3')).not.toBeUndefined();
    expect(device.getComponent('input:3')?.getValue('enable')).toBe(false);
    expect(device.getComponent('input:3')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:3')?.getValue('type')).toBe('switch');

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 3 shellyplugsg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.165');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.165');
    expect(device.model).toBe('S3PL-00112EU');
    expect(device.mac).toBe('5432045CE094');
    expect(device.id).toBe('shellyplugsg3-5432045CE094');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.2.3-plugsg3prod0-gec79607'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('Plug S Gen3 Matter');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        // component.Off();
        // await waiter('Off', () => { return component.getValue('state') === false; }, true);

        // component.Toggle();
        // await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        // component.Off();
        // await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  });

  test('create a gen 3 shellypmminig3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.220');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.220');
    expect(device.model).toBe('S3PM-001PCEU16');
    expect(device.mac).toBe('84FCE63957F4');
    expect(device.id).toBe('shellypmminig3-84FCE63957F4');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('PMmini Gen3');
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'PowerMeter', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'pm1:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);
});
