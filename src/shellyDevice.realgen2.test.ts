// src/shellyDevice.realgen2.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceRealGen2';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { jest } from '@jest/globals';

import { ShellyDevice } from './shellyDevice.js';
import { Shelly } from './shelly.js';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyComponent } from './shellyComponent.js';
import { setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, true);

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

  test('Create a gen 2 shellyplusrgbwpm device color mode and send commands', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.244');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.244');
    expect(device.mac).toBe('A0A3B35C7024');
    expect(device.profile).toBe('rgb');
    expect(device.model).toBe('SNDC-0D4P10WW');
    expect(device.id).toBe('shellyplusrgbwpm-A0A3B35C7024');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('RGBW PM Plus Rgb');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Rgb', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "input:0", "input:1", "input:2", "input:3", "mqtt", "rgb:0", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    const component = device.getComponent('rgb:0');
    expect(component).not.toBeUndefined();
    expect(isLightComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
      let rgb: number[];

      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(40);
      await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

      component.ColorRGB(255, 0, 0);
      await waiter('ColorRGB(255, 0, 0)', () => { rgb = component.getValue('rgb') as any; return rgb[0] === 255 && rgb[1] === 0 && rgb[2] === 0; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(60);
      await waiter('Level(60)', () => { return component.getValue('brightness') === 60; }, true);

      component.ColorRGB(0, 255, 0);
      await waiter('ColorRGB(0, 255, 0)', () => { rgb = component.getValue('rgb') as any; return rgb[0] === 0 && rgb[1] === 255 && rgb[2] === 0; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplusrgbwpm device white mode and send commands', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.171');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.171');
    expect(device.mac).toBe('ECC9FF4CEAF0');
    expect(device.profile).toBe('light');
    expect(device.model).toBe('SNDC-0D4P10WW');
    expect(device.id).toBe('shellyplusrgbwpm-ECC9FF4CEAF0');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('RGBW PM Plus White');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "input:0", "input:1", "input:2", "input:3", "light:0", "light:1", "light:2", "light:3", "mqtt", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    let component: ShellyComponent = device.getComponent('light:0') as ShellyComponent;
    expect(component).not.toBeUndefined();
    expect(isLightComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
      if (!component) return;
      let rgb: number[];

      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(40);
      await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(60);
      await waiter('Level(60)', () => { return component.getValue('brightness') === 60; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    component = device.getComponent('light:1') as ShellyComponent;
    expect(component).not.toBeUndefined();
    expect(isLightComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
      let rgb: number[];

      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(40);
      await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(70);
      await waiter('Level(70)', () => { return component.getValue('brightness') === 70; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    component = device.getComponent('light:2') as ShellyComponent;
    expect(component).not.toBeUndefined();
    expect(isLightComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
      let rgb: number[];

      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(40);
      await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(80);
      await waiter('Level(80)', () => { return component.getValue('brightness') === 80; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    component = device.getComponent('light:3') as ShellyComponent;
    expect(component).not.toBeUndefined();
    expect(isLightComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
      let rgb: number[];

      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(40);
      await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(20);
      await waiter('Level(20)', () => { return component.getValue('brightness') === 20; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('create a gen 2 shellyplus1pm 217 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.217');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    (device as any).wsClient?.start();

    expect(device.gen).toBe(2);
    expect(device.host).toBe('192.168.1.217');
    expect(device.model).toBe('SNSW-001P16EU');
    expect(device.mac).toBe('441793D69718');
    expect(device.id).toBe('shellyplus1pm-441793D69718');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('1PM Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

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
  }, 20000);

  test('create a gen 2 shellyplus2pm 218 cover device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.218');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    (device as any).wsClient?.start();

    expect(device.gen).toBe(2);
    expect(device.host).toBe('192.168.1.218');
    expect(device.model).toBe('SNSW-102P16EU');
    expect(device.mac).toBe('5443B23D81F8');
    expect(device.profile).toBe('cover');
    expect(device.id).toBe('shellyplus2pm-5443B23D81F8');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('2PM Plus Cover');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    const cover = device.getComponent('cover:0');
    expect(cover).not.toBeUndefined();

    // prettier-ignore
    if (isCoverComponent(cover)) {
      cover.Open();
      await waiter('Open()', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
      await waiter('Open() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'open'; }, true, 30000);
      await waiter('Open() III', () => { return cover.getValue('current_pos') === 100; }, true, 30000);

      cover.Close();
      await wait(2000);
      cover.Stop();
      await waiter('Stop()', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);

      cover.Close();
      await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
      await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
      await waiter('Close() III', () => { return cover.getValue('current_pos') === 0; }, true, 30000);

      cover.GoToPosition(10);
      await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
      await waiter('GoToPosition(10) II', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
      await waiter('GoToPosition(10) III', () => { return cover.getValue('current_pos') === 10; }, true, 30000);

      cover.Close();
      await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
      await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
      await waiter('Close() III', () => { return cover.getValue('current_pos') === 0; }, true, 30000);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 120000);

  test('Create a gen 2 shellyplus2pm device switch mode and send commands', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.163');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.163');
    expect(device.mac).toBe('C4D8D5517C68');
    expect(device.profile).toBe('switch');
    expect(device.model).toBe('SNSW-102P16EU');
    expect(device.id).toBe('shellyplus2pm-C4D8D5517C68');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('2PM Plus Switch');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "input:0", "input:1", "mqtt", "switch:0", "switch:1", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    let component = device.getComponent('switch:0') as ShellyComponent;
    expect(component).not.toBeUndefined();
    if (!component) return;
    expect(isSwitchComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    component = device.getComponent('switch:1') as ShellyComponent;
    expect(component).not.toBeUndefined();
    if (!component) return;
    expect(isSwitchComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplus1 device and send commands', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.237');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.237');
    expect(device.mac).toBe('E465B8F3028C');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SNSW-001X16EU');
    expect(device.id).toBe('shellyplus1-E465B8F3028C');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('1 Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "input:0", "mqtt", "switch:0", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    const component = device.getComponent('switch:0') as ShellyComponent;
    expect(component).not.toBeUndefined();
    if (!component) return;
    expect(isSwitchComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Off();
      await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplusplugs device and send commands', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.153');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.153');
    expect(device.mac).toBe('E86BEAEAA000');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SNPL-00112EU');
    expect(device.id).toBe('shellyplusplugs-E86BEAEAA000');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('PlugS Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "mqtt", "switch:0", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    const component = device.getComponent('switch:0') as ShellyComponent;
    expect(component).not.toBeUndefined();
    if (!component) return;
    expect(isSwitchComponent(component)).toBe(true);
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isSwitchComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      // component.Off();
      // await waiter('Off', () => { return component.getValue('state') === false; }, true);

      // component.Toggle();
      // await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      // component.Off();
      // await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplusi4 AC device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.224');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.224');
    expect(device.mac).toBe('CC7B5C8AEA2C');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SNSN-0024X');
    expect(device.id).toBe('shellyplusi4-CC7B5C8AEA2C');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('i4 AC Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('input:0')).not.toBeUndefined();
    expect(device.getComponent('input:0')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:0')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:0')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:1')).not.toBeUndefined();
    expect(device.getComponent('input:1')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:1')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:1')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:2')).not.toBeUndefined();
    expect(device.getComponent('input:2')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:2')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:2')?.getValue('type')).toBe('switch');

    expect(device.getComponent('input:3')).not.toBeUndefined();
    expect(device.getComponent('input:3')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:3')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:3')?.getValue('type')).toBe('switch');

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplusi4 DC device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.161');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.161');
    expect(device.mac).toBe('D48AFC41B6F4');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SNSN-0D24X');
    expect(device.id).toBe('shellyplusi4-D48AFC41B6F4');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('i4 DC Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.components.length).toBe(13);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    expect(device.getComponent('input:0')).not.toBeUndefined();
    expect(device.getComponent('input:0')?.getValue('enable')).toBe(false);
    expect(device.getComponent('input:0')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:0')?.getValue('type')).toBe('switch');

    expect(device.getComponent('input:1')).not.toBeUndefined();
    expect(device.getComponent('input:1')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:1')?.getValue('state')).toBe(false);
    expect(device.getComponent('input:1')?.getValue('type')).toBe('switch');

    expect(device.getComponent('input:2')).not.toBeUndefined();
    expect(device.getComponent('input:2')?.getValue('enable')).toBe(true);
    expect(device.getComponent('input:2')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:2')?.getValue('type')).toBe('button');

    expect(device.getComponent('input:3')).not.toBeUndefined();
    expect(device.getComponent('input:3')?.getValue('enable')).toBe(false);
    expect(device.getComponent('input:3')?.getValue('state')).toBe(null);
    expect(device.getComponent('input:3')?.getValue('type')).toBe('button');

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 2 shellyplus010v device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.160');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.160');
    expect(device.mac).toBe('80646FE1FAC4');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SNDM-00100WW');
    expect(device.id).toBe('shellyplus010v-80646FE1FAC4');
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(2);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('0-10V Dimmer Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(0);
    expect(device.bthomeDevices.size).toBe(0);
    expect(device.bthomeSensors.size).toBe(0);

    expect(device.components.length).toBe(12);
    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
    expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

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
});
