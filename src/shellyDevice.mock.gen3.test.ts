// src/shellyDevice.mock.gen3.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceMockGen3';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';
import { setupTest } from 'matterbridge/jestutils';

import { ShellyDevice } from './shellyDevice.js';
import { Shelly } from './shelly.js';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';
import { ShellyData } from './shellyTypes.js';
import { WsClient } from './wsClient.js';
import { MdnsScanner } from './mdnsScanner.js';

// Setup the test environment
await setupTest(NAME, false);

const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
const coapServerStopSpy = jest.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {});
const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
const wsServerStopSpy = jest.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
const wsClientStopSpy = jest.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
const mdnsScannerStartSpy = jest.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
const mdnsScannerStopSpy = jest.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});
const fetchSpy = jest.spyOn(ShellyDevice, 'fetch');

describe('Shelly gen 3 devices test', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined = undefined;
  let id: string;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.6.2-gc8a76e2';
  const firmwareGen3 = '1.6.2-gc8a76e2';
  const firmwareGen4 = '1.6.2-gc8a76e2';

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (device) device.destroy();
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(1000);

    // Restore all mocks after all tests
    jest.restoreAllMocks();
  });

  test('Create a gen 3 shellyhtg3 device', async () => {
    id = 'shellyhtg3-3030F9EC8468';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SN-0U12A');
    expect(device.mac).toBe('3030F9EC8468');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('H&T Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Devicepower', 'Humidity', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'devicepower:0',
      'humidity:0',
      'mqtt',
      'sys',
      'sntp',
      'temperature:0',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellyplugsg3 device', async () => {
    id = 'shellyplugsg3-8CBFEAA133F0';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3PL-00112EU');
    expect(device.mac).toBe('8CBFEAA133F0');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.2.3-plugsg3prod0-gec79607'); // firmwareGen1
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('PlugSG3 Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellyemg3 device', async () => {
    id = 'shellyemg3-84FCE636582C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3EM-002CXCEU');
    expect(device.mac).toBe('84FCE636582C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('EM Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'em1:1', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellyddimmerg3 device', async () => {
    id = 'shellyddimmerg3-84FCE636832C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3DM-0A1WW');
    expect(device.mac).toBe('84FCE636832C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('DALI Dimmer Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('blu')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly1g3 device I', async () => {
    id = 'shelly1g3-34B7DACAC830';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-001X16EU');
    expect(device.mac).toBe('34B7DACAC830');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Gen3 I');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'matter', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly1g3 device II', async () => {
    id = 'shelly1g3-DCDA0CDEEC20';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-001X16EU');
    expect(device.mac).toBe('DCDA0CDEEC20');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Gen3 II');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(15);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'input:100',
      'input:0',
      'matter',
      'mqtt',
      'switch:0',
      'sys',
      'sntp',
      'temperature:100',
      'temperature:101',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly1minig3 device', async () => {
    id = 'shelly1minig3-543204547478';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-001X8EU');
    expect(device.mac).toBe('543204547478');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1mini Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'matter', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(4);
    expect(device.bthomeSensors.size).toBe(14);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly1pmg3 device', async () => {
    id = 'shelly1pmg3-34B7DAC68344';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-001P16EU');
    expect(device.mac).toBe('34B7DAC68344');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PM Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'matter', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(3);
    expect(device.bthomeSensors.size).toBe(10);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly1pmminig3 device', async () => {
    id = 'shelly1pmminig3-543204519264';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-001P8EU');
    expect(device.mac).toBe('543204519264');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PMmini Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'matter', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellypmminig3 device', async () => {
    id = 'shellypmminig3-84FCE63957F4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3PM-001PCEU16');
    expect(device.mac).toBe('84FCE63957F4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('PMmini Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'PowerMeter', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'pm1:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly2pmg3 device mode switch', async () => {
    id = 'shelly2pmg3-8CBFEA9DE29C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-002P16EU');
    expect(device.mac).toBe('8CBFEA9DE29C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe('switch');
    expect(device.name).toBe('2PM Gen3 Switch');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'input:0',
      'input:1',
      'matter',
      'mqtt',
      'switch:0',
      'switch:1',
      'sys',
      'sntp',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(4);
    expect(device.bthomeSensors.size).toBe(9);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly2pmg3 device mode cover', async () => {
    id = 'shelly2pmg3-34CDB0770C4C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SW-002P16EU');
    expect(device.mac).toBe('34CDB0770C4C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe('cover');
    expect(device.name).toBe('2PM Gen3 Cover');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'Matter', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'matter', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('cover:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(4);
    expect(device.bthomeSensors.size).toBe(18);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellyi4g3 device', async () => {
    id = 'shellyi4g3-5432045661B4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3SN-0024X');
    expect(device.mac).toBe('5432045661B4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('i4 Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shelly0110dimg3 device', async () => {
    id = 'shelly0110dimg3-34B7DA902E24';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3DM-0010WW');
    expect(device.mac).toBe('34B7DA902E24');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.4.2-beta1-g84969a6');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Dimmer 0/1-10V PM Gen3');
    expect(device.hasUpdate).toBe(true);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('rgb')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('blu')).toBe(false);

    expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 3 shellyblugwg3 device', async () => {
    id = 'shellyblugwg3-34CDB077BCD4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S3GW-1DBT001');
    expect(device.mac).toBe('34CDB077BCD4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen3);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('BLU Gateway Gen3');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Blugw', 'Cloud', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'blugw', 'cloud', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.bthomeTrvs.size).toBe(2);
    expect(device.bthomeDevices.size).toBe(5);
    expect(device.bthomeSensors.size).toBe(20);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });
});
