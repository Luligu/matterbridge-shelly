/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, LogLevel } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import path from 'node:path';
import { jest } from '@jest/globals';
import { ShellyData } from './shellyTypes.js';
import { wait } from 'matterbridge/utils';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';

describe('Shelly gen 4 devices test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined = undefined;
  let id: string;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.4-g6d2a586';
  const firmwareGen3 = '1.5.0-g0087a06';
  const firmwareGen4 = '1.6.2-gc8a76e2';

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(`Mocked console.log: ${args}`);
    });
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    if (device) device.destroy();
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(2000);
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
});
