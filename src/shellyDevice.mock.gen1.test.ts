// src/shellyDevice.mock.gen1.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceMockGen1';
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

describe('Shelly gen 1 devices test', () => {
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

  test('Create a gen 1 shellyplug-s device', async () => {
    id = 'shellyplug-s-C38EAB';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHPLG-S');
    expect(device.mac).toBe('E868E7C38EAB');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Washing machine plug');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(27.14);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shelly1 device', async () => {
    id = 'shelly1-34945472A643';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHSW-1');
    expect(device.mac).toBe('34945472A643');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shelly1 device with add-on', async () => {
    id = 'shelly1-34945472A643';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.addon.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.addon.json'));
    expect(device.model).toBe('SHSW-1');
    expect(device.mac).toBe('34945472A643');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1 Gen1 Addon');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Temperature', 'Humidity', 'Sys']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'temperature', 'humidity', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('temperature')?.getValue('0')).toBeDefined();
    expect(device.getComponent('humidity')?.getValue('0')).toBeDefined();
    expect(device.getComponent('temperature')?.getValue('value')).toBe(21.5);
    expect(device.getComponent('humidity')?.getValue('value')).toBe(53.9);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shelly1l device', async () => {
    id = 'shelly1l-E8DB84AAD781';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHSW-L');
    expect(device.mac).toBe('E8DB84AAD781');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('1L Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'input:1', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(59.5);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyflood device', async () => {
    id = 'shellyflood-EC64C9C1DA9A';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHWT-1');
    expect(device.mac).toBe('EC64C9C1DA9A');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Flood Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Flood', 'Temperature', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'flood', 'temperature', 'battery', 'sys']);

    expect(device.getComponent('flood')?.getValue('flood')).toBe(false);
    expect(device.getComponent('temperature')?.getValue('value')).toBe(22.12);
    expect(device.getComponent('battery')?.getValue('level')).toBe(94);
    expect(device.getComponent('battery')?.getValue('voltage')).toBe(2.91);
    expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellydw2 device', async () => {
    id = 'shellydw2-483FDA825476';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHDW-2');
    expect(device.mac).toBe('483FDA825476');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Door/Window2 Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Temperature', 'Lux', 'Vibration', 'Sensor', 'Contact', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual([
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'mqtt',
      'coiot',
      'sntp',
      'cloud',
      'temperature',
      'lux',
      'vibration',
      'sensor',
      'contact',
      'battery',
      'sys',
    ]);

    expect(device.getComponent('sensor')?.getValue('state')).toBe('open');
    expect(device.getComponent('lux')?.getValue('value')).toBe(172);
    expect(device.getComponent('vibration')?.getValue('vibration')).toBe(false);
    expect(device.getComponent('temperature')?.getValue('value')).toBe(22.8);
    expect(device.getComponent('battery')?.getValue('level')).toBe(99);
    expect(device.getComponent('battery')?.getValue('voltage')).toBe(5.93);
    expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    expect(device.getComponent('sensor')?.getValue('contact_open')).toBe(true);

    if (device) device.destroy();
  });

  test('Create a gen 1 shellymotionsensor device', async () => {
    id = 'shellymotionsensor-60A42386E566';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHMOS-01');
    expect(device.mac).toBe('60A42386E566');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('v2.2.4@ee290818');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Motion1 Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'Sntp', 'Cloud', 'CoIoT', 'Lux', 'Sensor', 'Vibration', 'Motion', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'mqtt', 'sntp', 'cloud', 'coiot', 'lux', 'sensor', 'vibration', 'motion', 'battery', 'sys']);

    expect(device.getComponent('sensor')?.getValue('vibration')).toBe(false);
    expect(device.getComponent('sensor')?.getValue('motion')).toBe(false);
    expect(device.getComponent('lux')?.getValue('value')).toBe(1756);
    expect(device.getComponent('battery')?.getValue('level')).toBe(44);
    expect(device.getComponent('battery')?.getValue('voltage')).toBe(3.492);
    expect(device.getComponent('battery')?.getValue('charging')).toBe(false);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellymotion2 device', async () => {
    id = 'shellymotion2-8CF68108A6F5';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHMOS-02');
    expect(device.mac).toBe('8CF68108A6F5');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('v2.2.4@ee290818');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Motion2 Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'Sntp', 'Cloud', 'CoIoT', 'Lux', 'Temperature', 'Sensor', 'Vibration', 'Motion', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual([
      'wifi_ap',
      'wifi_sta',
      'mqtt',
      'sntp',
      'cloud',
      'coiot',
      'lux',
      'temperature',
      'sensor',
      'vibration',
      'motion',
      'battery',
      'sys',
    ]);

    expect(device.getComponent('sensor')?.getValue('vibration')).toBe(false);
    expect(device.getComponent('sensor')?.getValue('motion')).toBe(false);
    expect(device.getComponent('lux')?.getValue('value')).toBe(93);
    expect(device.getComponent('battery')?.getValue('level')).toBe(99);
    expect(device.getComponent('battery')?.getValue('voltage')).toBe(4.088);
    expect(device.getComponent('battery')?.getValue('charging')).toBe(false);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyht device', async () => {
    id = 'shellyht-703523';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHHT-1');
    expect(device.mac).toBe('C8C9A3703523');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('H&T Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(true);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Temperature', 'Humidity', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'temperature', 'humidity', 'battery', 'sys']);

    expect(device.getComponent('temperature')?.getValue('value')).toBe(21.75);
    expect(device.getComponent('temperature')?.getValue('units')).toBe('C');
    expect(device.getComponent('temperature')?.getValue('tC')).toBe(21.75);
    expect(device.getComponent('temperature')?.getValue('tF')).toBe(71.15);
    expect(device.getComponent('temperature')?.getValue('is_valid')).toBe(true);
    expect(device.getComponent('humidity')?.getValue('value')).toBe(62.5);
    expect(device.getComponent('humidity')?.getValue('is_valid')).toBe(true);
    expect(device.getComponent('battery')?.getValue('level')).toBe(100);
    expect(device.getComponent('battery')?.getValue('voltage')).toBe(2.98);
    expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellysmoke device', async () => {
    id = 'shellysmoke-XXXXXXXXXXXX';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHSM-01');
    expect(device.mac).toBe('XXXXXXXXXXXX');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Smoke Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Smoke', 'Temperature', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'smoke', 'temperature', 'battery', 'sys']);

    expect(device.getComponent('smoke')?.getValue('smoke')).toBe(false);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellygas device', async () => {
    id = 'shellygas-7C87CEBCECE4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHGS-1');
    expect(device.mac).toBe('7C87CEBCECE4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Gas Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(9);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Gas', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'gas', 'sys']);

    expect(device.getComponent('gas')?.getValue('sensor_state')).toBe('normal');
    expect(device.getComponent('gas')?.getValue('alarm_state')).toBe('none');
    expect(device.getComponent('gas')?.getValue('ppm')).toBe(0);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellydimmer2 device', async () => {
    id = 'shellydimmer2-98CDAC0D01BB';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHDM-2');
    expect(device.mac).toBe('98CDAC0D01BB');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Dimmer2 Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'input:0', 'input:1', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyrgbww device color mode', async () => {
    id = 'shellyrgbww-CCA867';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHRGBWW-01');
    expect(device.mac).toBe('5CCF7FCCA867');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('v1.7.0-rc8@6f7ea363');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('shellyrgbww-CCA867');
    expect(device.hasUpdate).toBe(true);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Input', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'input:0', 'meter:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('red')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('green')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('blue')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyrgbw2 device color mode', async () => {
    id = 'shellyrgbw2-EC64C9D3FFEF';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHRGBW2');
    expect(device.mac).toBe('EC64C9D3FFEF');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe('color');
    expect(device.name).toBe('RGBW2 Gen1 Color');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(11);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Sys', 'PowerMeter', 'Input']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'sys', 'meter:0', 'input:0']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('red')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('green')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('blue')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyrgbw2 device white mode', async () => {
    id = 'shellyrgbw2-EC64C9D199AD';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHRGBW2');
    expect(device.mac).toBe('EC64C9D199AD');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe('white');
    expect(device.name).toBe('RGBW2 Gen1 White');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(17);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Sys', 'PowerMeter', 'Input']);
    expect(device.getComponentIds()).toStrictEqual([
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'mqtt',
      'coiot',
      'sntp',
      'cloud',
      'light:0',
      'light:1',
      'light:2',
      'light:3',
      'sys',
      'meter:0',
      'meter:1',
      'meter:2',
      'meter:3',
      'input:0',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
    expect(device.getComponent('light:0')?.hasProperty('blue')).toBe(false);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyem3 device', async () => {
    id = 'shellyem3-485519D732F4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHEM-3');
    expect(device.mac).toBe('485519D732F4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('3EM Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'emeter:0', 'emeter:1', 'emeter:2', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('relay:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('relay:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('relay:0')?.hasProperty('brightness')).toBe(false);

    expect(device.getComponent('emeter:0')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('emeter:0')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('emeter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('emeter:0')?.hasProperty('total')).toBe(true);

    expect(device.getComponent('emeter:1')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('emeter:1')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('emeter:1')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('emeter:1')?.hasProperty('total')).toBe(true);

    expect(device.getComponent('emeter:2')?.hasProperty('voltage')).toBe(true);
    expect(device.getComponent('emeter:2')?.hasProperty('current')).toBe(true);
    expect(device.getComponent('emeter:2')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('emeter:2')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellybulbduo device', async () => {
    id = 'shellybulbduo-34945479CFA4';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHBDUO-1');
    expect(device.mac).toBe('34945479CFA4');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Duo Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);

    expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellycolorbulb-485519EE12A7 device color mode', async () => {
    id = 'shellycolorbulb-485519EE12A7';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.color.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.color.json'));
    expect(device.model).toBe('SHCB-1');
    expect(device.mac).toBe('485519EE12A7');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Bulb Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.getValue('mode')).toBe('color');

    expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellycolorbulb-485519EE12A7 device white mode', async () => {
    id = 'shellycolorbulb-485519EE12A7';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.white.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.white.json'));
    expect(device.model).toBe('SHCB-1');
    expect(device.mac).toBe('485519EE12A7');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Bulb Gen1');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(10);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
    expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
    expect(device.getComponent('light:0')?.getValue('mode')).toBe('white');

    expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyswitch25-3494547BF36C device relay mode', async () => {
    id = 'shellyswitch25-3494547BF36C';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHSW-25');
    expect(device.mac).toBe('3494547BF36C');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe('switch');
    expect(device.name).toBe('2.5 Gen1 Relay');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(15);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'Roller', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual([
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'mqtt',
      'coiot',
      'sntp',
      'cloud',
      'relay:0',
      'relay:1',
      'roller:0',
      'meter:0',
      'meter:1',
      'input:0',
      'input:1',
      'sys',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(51.61);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

    expect(device.getComponent('relay:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('relay:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('relay:0')?.hasProperty('gain')).toBe(false);
    expect(device.getComponent('relay:0')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('relay:0')?.getValue('mode')).toBe(undefined);

    expect(device.getComponent('relay:1')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('relay:1')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('relay:1')?.hasProperty('gain')).toBe(false);
    expect(device.getComponent('relay:1')?.hasProperty('brightness')).toBe(false);
    expect(device.getComponent('relay:1')?.getValue('mode')).toBe(undefined);

    expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

    expect(device.getComponent('meter:1')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:1')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:1')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:1')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellyswitch25-3494546BBF7E device roller mode', async () => {
    id = 'shellyswitch25-3494546BBF7E';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHSW-25');
    expect(device.mac).toBe('3494546BBF7E');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe('cover');
    expect(device.name).toBe('2.5 Gen1 Cover');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(14);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'Roller', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual([
      'wifi_ap',
      'wifi_sta',
      'wifi_sta1',
      'mqtt',
      'coiot',
      'sntp',
      'cloud',
      'relay:0',
      'relay:1',
      'roller:0',
      'meter:0',
      'input:0',
      'input:1',
      'sys',
    ]);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(58.32);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

    expect(device.getComponent('roller:0')?.hasProperty('state')).toBe(true);
    expect(device.getComponent('roller:0')?.hasProperty('current_pos')).toBe(true);
    expect(device.getComponent('roller:0')?.hasProperty('source')).toBe(true);
    expect(device.getComponent('roller:0')?.hasProperty('last_direction')).toBe(true);

    expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    if (device) device.destroy();
  });

  test('Create a gen 1 shellytrv-60A423D0E032 device', async () => {
    id = 'shellytrv-60A423D0E032';
    log.logName = id;

    device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
    expect(device.model).toBe('SHTRV-01');
    expect(device.mac).toBe('60A423D0E032');
    expect(device.id).toBe(id);
    expect(device.firmware).toBe('v2.2.4@ee290818');
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.profile).toBe(undefined);
    expect(device.name).toBe('Shelly-UG-CZ-Heizkoerper');
    expect(device.hasUpdate).toBe(false);
    expect(device.lastseen).not.toBe(0);
    expect(device.online).toBe(true);
    expect(device.cached).toBe(false);
    expect(device.sleepMode).toBe(false);

    expect(device.components.length).toBe(9);
    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'Sntp', 'Cloud', 'CoIoT', 'Thermostat', 'Battery', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'mqtt', 'sntp', 'cloud', 'coiot', 'thermostat:0', 'battery', 'sys']);

    expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
    expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

    expect(device.getComponent('thermostat:0')?.hasProperty('target_t')).toBe(true);
    expect(device.getComponent('thermostat:0')?.hasProperty('tmp')).toBe(true);

    expect(await device.fetchUpdate()).not.toBeNull();

    expect(device.getComponent('thermostat:0')?.getValue('target_t')).toEqual({ enabled: true, units: 'C', value: 5, value_op: 8 });
    expect(device.getComponent('thermostat:0')?.getValue('tmp')).toEqual({ is_valid: true, units: 'C', value: 14.3 });
    device.getComponent('thermostat:0')?.setValue('target_t', { value: 22 });
    device.getComponent('thermostat:0')?.setValue('tmp', { value: 20 });
    expect(device.getComponent('thermostat:0')?.getValue('target_t')).toEqual({ value: 22 });
    expect(device.getComponent('thermostat:0')?.getValue('tmp')).toEqual({ value: 20 });

    if (device) device.destroy();
  });
});
