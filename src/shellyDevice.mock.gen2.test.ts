// src/shellyDevice.mock.gen2.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceMockGen2';
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

describe('Shelly gen 2 devices test', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined = undefined;
  let id: string;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.4-g6d2a586';
  const firmwareGen3 = '1.5.0-g0087a06';
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

  test('Create a gen 2 shellyplusrgbwpm device (rgb mode)', async () => {
    id = 'shellyplusrgbwpm-A0A3B35C7024';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNDC-0D4P10WW');
    expect(device.mac).toBe('A0A3B35C7024');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.5.1-g01dd7ff'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('rgb');
    expect(device.name).toBe('RGBW PM Plus Rgb');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    // console.error(device.getComponentNames());
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Rgb', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // console.error(device.getComponentIds());
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
      'mqtt',
      'rgb:0',
      'sys',
      'sntp',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('rgb:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('rgb')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplusi4 AC device', async () => {
    id = 'shellyplusi4-CC7B5C8AEA2C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSN-0024X');
    expect(device.mac).toBe('CC7B5C8AEA2C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('i4 AC Plus');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(15);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Humidity', 'Input', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'humidity:100',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
      'mqtt',
      'sys',
      'sntp',
      'temperature:100',
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'ws',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('input:0')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('type')).toBe(true);

    expect(device.getComponent('input:0')?.getValue('type')).toBe('switch');
    expect(device.getComponent('input:1')?.getValue('type')).toBe('switch');
    expect(device.getComponent('input:2')?.getValue('type')).toBe('switch');
    expect(device.getComponent('input:3')?.getValue('type')).toBe('switch');

    expect(device.getComponent('input:0')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:1')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:2')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:3')?.getValue('state')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplusi4 DC device', async () => {
    id = 'shellyplusi4-D48AFC41B6F4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSN-0D24X');
    expect(device.mac).toBe('D48AFC41B6F4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('i4 DC Plus');
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

    expect(device.getComponent('input:0')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('type')).toBe(true);

    expect(device.getComponent('input:0')?.getValue('type')).toBe('switch');
    expect(device.getComponent('input:1')?.getValue('type')).toBe('switch');
    expect(device.getComponent('input:2')?.getValue('type')).toBe('button');
    expect(device.getComponent('input:3')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:0')?.getValue('enable')).toBe(false);
    expect(device.getComponent('input:1')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:2')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:3')?.getValue('enable')).toBe(false);

    expect(device.getComponent('input:0')?.getValue('state')).toBe(null); // in switch mode can be true or false and is a WebSocket update
    expect(device.getComponent('input:1')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:2')?.getValue('state')).toBe(null); // in button mode is null and is a WebSocket event
    expect(device.getComponent('input:3')?.getValue('state')).toBe(null);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellywalldisplay device', async () => {
    id = 'shellywalldisplay-00082261E102';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SAWD-0A1XX10EU1');
    expect(device.mac).toBe('00082261E102');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('2.3.6-66e97e33');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Wall Display');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual([
      'Ble',
      'WiFi',
      'Switch',
      'Input',
      'Temperature',
      'Humidity',
      'Illuminance',
      'Sys',
      'Sntp',
      'Cloud',
      'MQTT',
      'WS',
      'Thermostat',
      'Devicepower',
    ]);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'wifi_sta',
      'switch:0',
      'input:0',
      'temperature:0',
      'humidity:0',
      'illuminance:0',
      'sys',
      'sntp',
      'cloud',
      'mqtt',
      'ws',
      'thermostat:0',
      'devicepower:0',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('temperature:0')?.hasProperty('tC')).toBe(true);
    expect(device.getComponent('humidity:0')?.hasProperty('rh')).toBe(true);
    expect(device.getComponent('illuminance:0')?.hasProperty('lux')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellywalldisplay device with thermostat', async () => {
    id = 'shellywalldisplay-00082261E102';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.thermostat.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.thermostat.json'));
    expect(device.model).toBe('SAWD-0A1XX10EU1');
    expect(device.mac).toBe('00082261E102');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('2.2.1-eb899af6');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Wall Display');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual([
      'Ble',
      'WiFi',
      'Switch',
      'Input',
      'Temperature',
      'Humidity',
      'Illuminance',
      'Sys',
      'Sntp',
      'Cloud',
      'MQTT',
      'WS',
      'Thermostat',
      'Devicepower',
    ]);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'wifi_sta',
      'switch:0',
      'input:0',
      'temperature:0',
      'humidity:0',
      'illuminance:0',
      'sys',
      'sntp',
      'cloud',
      'mqtt',
      'ws',
      'thermostat:0',
      'devicepower:0',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('temperature:0')?.hasProperty('tC')).toBe(true);
    expect(device.getComponent('humidity:0')?.hasProperty('rh')).toBe(true);
    expect(device.getComponent('illuminance:0')?.hasProperty('lux')).toBe(true);
    expect(device.getComponent('thermostat:0')?.hasProperty('enable')).toBe(true);
    expect(device.getComponent('thermostat:0')?.hasProperty('type')).toBe(true);
    expect(device.getComponent('thermostat:0')?.hasProperty('target_C')).toBe(true);
    expect(device.getComponent('thermostat:0')?.hasProperty('current_C')).toBe(true);
    expect(device.getComponent('thermostat:0')?.getValue('target_C')).toBe(25);
    expect(device.getComponent('thermostat:0')?.getValue('current_C')).toBe(22.9);
    expect(device.getComponent('thermostat:0')?.getValue('type')).toBe('heating');

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplus1 device', async () => {
    id = 'shellyplus1-E465B8F3028C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSW-001X16EU');
    expect(device.mac).toBe('E465B8F3028C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Plus');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    // console.error(device.getComponentNames());
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // console.error(device.getComponentIds());
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplus1pm device', async () => {
    id = 'shellyplus1pm-441793D69718';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSW-001P16EU');
    expect(device.mac).toBe('441793D69718');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PM Plus');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    // console.error(device.getComponentNames());
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // console.error(device.getComponentIds());
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplus2pm device mode switch', async () => {
    id = 'shellyplus2pm-C4D8D5517C68';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSW-102P16EU');
    expect(device.mac).toBe('C4D8D5517C68');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('switch');
    expect(device.name).toBe('2PM Plus Switch');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'mqtt', 'switch:0', 'switch:1', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplus2pm device mode cover', async () => {
    id = 'shellyplus2pm-5443B23D81F8';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSW-102P16EU');
    expect(device.mac).toBe('5443B23D81F8');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('cover');
    expect(device.name).toBe('2PM Plus Cover');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplusplugs device', async () => {
    id = 'shellyplusplugs-E86BEAEAA000';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNPL-00112EU');
    expect(device.mac).toBe('E86BEAEAA000');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('PlugS Plus');
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

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(undefined);
    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplus010v device', async () => {
    id = 'shellyplus010v-80646FE1FAC4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNDM-00100WW');
    expect(device.mac).toBe('80646FE1FAC4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('0-10V Dimmer Plus');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    // console.error(device.getComponentNames());
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // console.error(device.getComponentIds());
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('temperature')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('night_mode')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 2 shellyplussmoke device', async () => {
    id = 'shellyplussmoke-A0A3B3B8AE48';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SNSN-0031Z');
    expect(device.mac).toBe('A0A3B3B8AE48');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe(id);
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Devicepower', 'MQTT', 'Smoke', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'devicepower:0', 'mqtt', 'smoke:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('smoke:0')?.hasProperty('alarm')).toBe(true);
    expect(device.getComponent('smoke:0')?.hasProperty('mute')).toBe(true);
    expect(device.getComponent('smoke:0')?.getValue('alarm')).toBe(false);
    expect(device.getComponent('smoke:0')?.getValue('mute')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });
});
