// src/shellyDevice.mock.gen4.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceMockGen4';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { setupTest } from 'matterbridge/jestutils';
import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

import { CoapServer } from './coapServer.js';
import { MdnsScanner } from './mdnsScanner.js';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyData } from './shellyTypes.js';
import { WsClient } from './wsClient.js';
import { WsServer } from './wsServer.js';

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

describe('Shelly gen 4 devices test', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined = undefined;
  let id: string;

  const firmwareGen4 = '1.7.5-g9979d16';

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

  test('Create a gen 4 shelly1g4 device', async () => {
    id = 'shelly1g4-A085E3BCA4C8';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-001X16EU');
    expect(device.mac).toBe('A085E3BCA4C8');
    expect(device.id).toBe('shelly1g4-A085E3BCA4C8');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Gen4');
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

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shelly1pmg4 device', async () => {
    id = 'shelly1pmg4-A085E3BD0544';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-001P16EU');
    expect(device.mac).toBe('A085E3BD0544');
    expect(device.id).toBe('shelly1pmg4-A085E3BD0544');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PM Gen4');
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

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shelly1minig4 device', async () => {
    id = 'shelly1minig4-A085E3BB944C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-001X8EU');
    expect(device.mac).toBe('A085E3BB944C');
    expect(device.id).toBe('shelly1minig4-A085E3BB944C');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Mini Gen4');
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

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(false);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shelly1pmminig4 device', async () => {
    id = 'shelly1pmminig4-CCBA97C64580';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-001P8EU');
    expect(device.mac).toBe('CCBA97C64580');
    expect(device.id).toBe('shelly1pmminig4-CCBA97C64580');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PM Mini Gen4');
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

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shelly2pmg4 device mode switch', async () => {
    id = 'shelly2pmg4-98A316721128.switch';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-002P16EU');
    expect(device.mac).toBe('98A316721128');
    expect(device.id).toBe('shelly2pmg4-98A316721128');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe('switch');
    expect(device.name).toBe('2PM Gen4');
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
    expect(device.bthomeDevices.size).toBe(2);
    expect(device.bthomeSensors.size).toBe(5);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shelly2pmg4 device mode cover', async () => {
    id = 'shelly2pmg4-98A316721128.cover';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SW-002P16EU');
    expect(device.mac).toBe('98A316721128');
    expect(device.id).toBe('shelly2pmg4-98A316721128');
    expect(device.firmware).toBe(firmwareGen4);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe('cover');
    expect(device.name).toBe('2PM Gen4');
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
    expect(device.bthomeDevices.size).toBe(2);
    expect(device.bthomeSensors.size).toBe(5);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shellyfloodg4 device', async () => {
    id = 'shellyfloodg4-D885ACE9173C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4SN-0071A');
    expect(device.mac).toBe('D885ACE9173C');
    expect(device.id).toBe('shellyfloodg4-D885ACE9173C');
    expect(device.firmware).toBe('gefb9927');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Flood Gen4 I');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Devicepower', 'Flood', 'Matter', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS', 'Zigbee']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'devicepower:0',
      'flood:0',
      'matter',
      'mqtt',
      'sys',
      'sntp',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
      'zigbee',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);
    expect(device.getComponent('zigbee')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('flood:0')?.hasProperty('alarm')).toBe(true);
    expect(device.getComponent('devicepower:0')?.hasProperty('battery')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shellypstripg4 device', async () => {
    id = 'shellypstripg4-D885ACE52518';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4PL-00416EU');
    expect(device.mac).toBe('D885ACE52518');
    expect(device.id).toBe('shellypstripg4-D885ACE52518');
    expect(device.firmware).toBe('ga0def2d');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Power Strip Gen4');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Matter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'matter',
      'mqtt',
      'switch:0',
      'switch:1',
      'switch:2',
      'switch:3',
      'sys',
      'sntp',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

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

    expect(device.getComponent('switch:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:2')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:2')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:2')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:2')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:2')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('switch:3')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:3')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:3')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:3')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:3')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:3')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 4 shellyemminig4 device', async () => {
    id = 'shellyemminig4-D885ACEF41A8';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('S4EM-001PXCEU16');
    expect(device.mac).toBe('D885ACEF41A8');
    expect(device.id).toBe('shellyemminig4-D885ACEF41A8');
    expect(device.firmware).toBe('2.0.0-beta1-g8c7700a');
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(4);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('EM Mini Gen4');
    expect(device.hasUpdate).toBe(true);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'Matter', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'matter', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('matter')?.hasProperty('enable')).toBe(true);

    expect(device.getComponent('em1:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('total_act_energy')).toBe(true);

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });
});
