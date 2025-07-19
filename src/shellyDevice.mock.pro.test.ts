// src/shellyDevice.mock.pro.test.ts

import path from 'node:path';

import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';

import { ShellyDevice } from './shellyDevice.js';
import { Shelly } from './shelly.js';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';
import { ShellyData } from './shellyTypes.js';
import { WsClient } from './wsClient.js';
import { MdnsScanner } from './mdnsScanner.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logs

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

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

describe('Shelly pro devices test', () => {
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

  afterEach(() => {
    if (device) device.destroy();
  });

  test('Create a pro shellypro1pm device', async () => {
    id = 'shellypro1pm-EC62608AB9A4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPSW-201PE16EU');
    expect(device.mac).toBe('EC62608AB9A4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1PM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'eth', 'input:0', 'input:1', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThan(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro2pm device', async () => {
    id = 'shellypro2pm-EC62608C9C00';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPSW-202PE16EU');
    expect(device.mac).toBe('EC62608C9C00');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('switch');
    expect(device.name).toBe('2PM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'eth',
      'input:0',
      'input:1',
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
    expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('brightness')).toBe(false);

    expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro2cover device', async () => {
    id = 'shellypro2cover-0CB815FC11B4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPSH-002PE16EU');
    expect(device.mac).toBe('0CB815FC11B4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.4.4-g6d2a586');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('2Cover Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(16);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Eth', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'cover:0',
      'cover:1',
      'eth',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
      'mqtt',
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
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('temperature')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('cover:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('cover:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cover:1')?.hasProperty('temperature')).toBe(true);
    expect(device.getComponent('cover:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('cover:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('cover:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('cover:1')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('cover:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro4pm device', async () => {
    id = 'shellypro4pm-34987A67D7D0';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPSW-104PE16EU');
    expect(device.mac).toBe('34987A67D7D0');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('4PM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(18);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'eth',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
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

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellyproem50 device', async () => {
    id = 'shellyproem50-A0DD6CA09158';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPEM-002CEBEU50');
    expect(device.mac).toBe('A0DD6CA09158');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Breaker box PRO-EM50 I');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'Eth', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'em1:1', 'eth', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

    expect(device.getComponent('em1:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('total')).toBe(false);

    expect(device.getComponent('em1:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('total')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro3em device monophase', async () => {
    id = 'shellypro3em-A0DD6CA0C27C.monophase';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPEM-003CEBEU');
    expect(device.mac).toBe('A0DD6CA0C27C');
    expect(device.id).toBe(id.replace('.monophase', ''));
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('monophase');
    expect(device.name).toBe('3EM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'Eth', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'em1:0',
      'em1:1',
      'em1:2',
      'eth',
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

    expect(device.getComponent('em1:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em1:0')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em1:0')?.hasProperty('total_act_ret_energy')).toBe(true);

    expect(device.getComponent('em1:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em1:1')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em1:1')?.hasProperty('total_act_ret_energy')).toBe(true);

    expect(device.getComponent('em1:2')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em1:2')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em1:2')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em1:2')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em1:2')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em1:2')?.hasProperty('total_act_ret_energy')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro3em device triphase', async () => {
    id = 'shellypro3em-A0DD6CA0C27C.triphase';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPEM-003CEBEU');
    expect(device.mac).toBe('A0DD6CA0C27C');
    expect(device.id).toBe(id.replace('.triphase', ''));
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('triphase');
    expect(device.name).toBe('3EM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(15);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'Eth', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'em:0',
      'em:1',
      'em:2',
      'em:3',
      'eth',
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

    expect(device.getComponent('em:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('em:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('em:0')?.hasProperty('act_power')).toBe(false);
    expect(device.getComponent('em:0')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em:0')?.hasProperty('total_act_energy')).toBe(false);
    expect(device.getComponent('em:0')?.hasProperty('total_act_ret_energy')).toBe(false);

    expect(device.getComponent('em:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em:1')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('total_act_ret_energy')).toBe(true);

    expect(device.getComponent('em:2')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em:2')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em:2')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em:2')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em:1')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('total_act_ret_energy')).toBe(true);

    expect(device.getComponent('em:3')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('em:3')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('em:3')?.hasProperty('act_power')).toBe(true);
    expect(device.getComponent('em:3')?.hasProperty('total')).toBe(false);
    expect(device.getComponent('em:1')?.hasProperty('total_act_energy')).toBe(true);
    expect(device.getComponent('em:1')?.hasProperty('total_act_ret_energy')).toBe(true);

    device.updateComponent('em:0', {
      id: 0,
      a_current: 1,
      a_voltage: 221,
      a_act_power: 221,
      a_aprt_power: 321,
      a_freq: 51,
      b_current: 2,
      b_voltage: 222,
      b_act_power: 444,
      b_aprt_power: 322,
      b_freq: 52,
      c_current: 3,
      c_voltage: 223,
      c_act_power: 669,
      c_aprt_power: 323,
      c_freq: 53,
      n_current: null,
      total_current: 10,
      total_act_power: 2200,
      total_aprt_power: 3300,
      a_total_act_energy: 101,
      a_total_act_ret_energy: 51,
      b_total_act_energy: 102,
      b_total_act_ret_energy: 52,
      c_total_act_energy: 103,
      c_total_act_ret_energy: 53,
      total_act: 0.31,
      total_act_ret: 0,
    });

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellyprodm1pm device', async () => {
    id = 'shellyprodm1pm-34987A4957C4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPDM-001PE01EU');
    expect(device.mac).toBe('34987A4957C4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Dimmer 1PM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'eth', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('light:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellyprodm2pm device', async () => {
    id = 'shellyprodm2pm-08F9E0E4C138';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPDM-002PE01EU');
    expect(device.mac).toBe('08F9E0E4C138');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.5.1-beta1-g172c5bb');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('shellyprodm2pm-08F9E0E4C138');
    expect(device.hasUpdate).toBe(true);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(16);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'eth',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
      'light:0',
      'light:1',
      'mqtt',
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
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('light:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('light:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('light:1')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('light:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro0110pm device', async () => {
    id = 'shellypro0110pm-30C6F78262AC';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPCC-001PE10EU');
    expect(device.mac).toBe('30C6F78262AC');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('gbbb762d');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('shellypro0110pm-30C6F78262AC');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'eth', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('light:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellyprorgbwwpm device', async () => {
    id = 'shellyprorgbwwpm-AC1518784844';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPDC-0D5PE16EU');
    expect(device.mac).toBe('AC1518784844');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.5.1-g01dd7ff');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe('rgbcct');
    expect(device.name).toBe('RGBWW PM Pro');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(17);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cct', 'Cloud', 'Eth', 'Input', 'MQTT', 'Rgb', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cct:0',
      'cloud',
      'eth',
      'input:0',
      'input:1',
      'input:2',
      'input:3',
      'input:4',
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

    expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('input:4')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('rgb:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('rgb:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('rgb:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(device.getComponent('cct:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('output')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('ct')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('apower')).toBe(true);
    expect(device.getComponent('cct:0')?.hasProperty('aenergy')).toBe(true);
    expect((device.getComponent('cct:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a pro shellypro3 device', async () => {
    id = 'shellypro3-C8F09E894168';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SPSW-003XE16EU');
    expect(device.mac).toBe('C8F09E894168');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('1.4.4-g6d2a586');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('shellypro3-C8F09E894168');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(16);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual([
      'ble',
      'cloud',
      'eth',
      'input:0',
      'input:1',
      'input:2',
      'mqtt',
      'switch:0',
      'switch:1',
      'switch:2',
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
    expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);

    expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);

    expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:1')?.hasProperty('output')).toBe(true);

    expect(device.getComponent('switch:2')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('switch:2')?.hasProperty('output')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });
});
