/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { jest } from '@jest/globals';

describe('Shellies', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'ShellyDeviceRealTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const address = 'c4:cb:76:b3:cd:1f';

  beforeAll(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    shelly.dataPath = 'temp';
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true);
    shelly.startCoap(0);
    shelly.startMdns(0, '192.168.1.189', 'udp4', true);
    await wait(2000);
  });

  beforeEach(async () => {
    await wait(1000);
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
    await wait(2000);
  });

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('Create with resolve a gen 1 shelly1 device and send commands', async () => {
    if (getMacAddress() !== address) return;
    const hostname = (await resolveHostname('shelly1-34945472A643')) ?? '192.168.1.240';
    device = await ShellyDevice.create(shelly, log, hostname);
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe(hostname);
    expect(device.mac).toBe('34945472A643');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHSW-1');
    expect(device.id).toBe('shelly1-34945472A643');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('1 Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('relay:0');
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
  */

  test('Create a gen 1 shelly1 device and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.240');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.240');
    expect(device.mac).toBe('34945472A643');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHSW-1');
    expect(device.id).toBe('shelly1-34945472A643');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('1 Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('relay:0');
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

  test('Create a gen 1 shelly1l device and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.241');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.241');
    expect(device.mac).toBe('E8DB84AAD781');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHSW-L');
    expect(device.id).toBe('shelly1l-E8DB84AAD781');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('1L Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('relay:0');
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

  test('Create a gen 1 shellydimmer2 device and update', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.219');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.219');
    expect(device.mac).toBe('98CDAC0D01BB');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHDM-2');
    expect(device.id).toBe('shellydimmer2-98CDAC0D01BB');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(true);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('Dimmer2 Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

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
  }, 20000);

  test('Create a gen 1 shellybulbduo device and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.154');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.154');
    expect(device.mac).toBe('34945479CFA4');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHBDUO-1');
    expect(device.id).toBe('shellybulbduo-34945479CFA4');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('Duo Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();
    expect(component?.hasProperty('temp')).toBe(true);
    expect(component?.hasProperty('mode')).toBe(false);

    // prettier-ignore
    if (isLightComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Level(40);
        await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

        component.ColorTemp(5000);
        await waiter('ColorTemp(5000)', () => { return component.getValue('temp') === 5000; }, true);

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

  test('Create a gen 1 shellycolorbulb device and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.155');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.155');
    expect(device.mac).toBe('485519EE12A7');
    expect(['color', 'white']).toContain(device.profile);
    expect(device.model).toBe('SHCB-1');
    expect(device.id).toBe('shellycolorbulb-485519EE12A7');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('Bulb Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();
    expect(component?.hasProperty('temp')).toBe(true);
    expect(component?.hasProperty('mode')).toBe(true);

    // prettier-ignore
    if (isLightComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Level(40);
        await waiter('Level(40)', () => { return component.getValue('brightness') === 40; }, true);

        // consoleLogSpy.mockRestore();
        component.ColorTemp(5000);
        await waiter('ColorTemp(5000) 1', () => { return component.getValue('temp') === 5000; }, true, 10000, 1000, true);
        await waiter('ColorTemp(5000) 2', () => { return device?.getComponent('sys')?.getValue('profile') === 'white'; }, true, 10000, 1000, true);
        // consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => { ; });

        component.ColorRGB(255, 0, 0);
        await waiter('ColorRGB(255, 0, 0) 1', () => { return component.getValue('red') === 255 && component.getValue('green') === 0 && component.getValue('blue') === 0; }, true);
        await waiter('ColorRGB(255, 0, 0) 2', () => { return device?.getComponent('sys')?.getValue('profile') === 'color'; }, true, 10000, 1000, true);

        component.ColorTemp(3000);
        await waiter('ColorTemp(3000) 1', () => { return component.getValue('temp') === 3000; }, true, 10000, 1000, true);
        await waiter('ColorTemp(3000) 2', () => { return device?.getComponent('sys')?.getValue('profile') === 'white'; }, true, 10000, 1000, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.ColorRGB(0, 255, 0);
        await waiter('ColorRGB(0, 255, 0) 1', () => { return component.getValue('red') === 0 && component.getValue('green') === 255 && component.getValue('blue') === 0; }, true);
        await waiter('ColorRGB(0, 255, 0) 2', () => { return device?.getComponent('sys')?.getValue('profile') === 'color'; }, true, 10000, 1000, true);

        component.Off();
        await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 1 shellyrgbw2 device color mode and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.226');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.226');
    expect(device.mac).toBe('EC64C9D3FFEF');
    expect(device.profile).toBe('color');
    expect(device.model).toBe('SHRGBW2');
    expect(device.id).toBe('shellyrgbw2-EC64C9D3FFEF');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('RGBW2 Gen1 Color');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Sys', 'PowerMeter', 'Input']);

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(true);
    expect(component?.getValue('mode')).toBe('color');

    // prettier-ignore
    if (isLightComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Level(40);
        await waiter('Level(40)', () => { return component.getValue('gain') === 40; }, true);

        component.ColorRGB(255, 0, 0);
        await waiter('ColorRGB(255, 0, 0)', () => { return component.getValue('red') === 255 && component.getValue('green') === 0 && component.getValue('blue') === 0; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Level(60);
        await waiter('Level(60)', () => { return component.getValue('gain') === 60; }, true);

        component.ColorRGB(0, 255, 0);
        await waiter('ColorRGB(0, 255, 0)', () => { return component.getValue('red') === 0 && component.getValue('green') === 255 && component.getValue('blue') === 0; }, true);

        component.Off();
        await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 1 shellyrgbw2 device white mode and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.152');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.152');
    expect(device.mac).toBe('EC64C9D199AD');
    expect(device.profile).toBe('white');
    expect(device.model).toBe('SHRGBW2');
    expect(device.id).toBe('shellyrgbw2-EC64C9D199AD');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('RGBW2 Gen1 White');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

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

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();
    expect(component?.hasProperty('temp')).toBe(false);
    expect(component?.hasProperty('mode')).toBe(true);
    expect(component?.getValue('mode')).toBe('white');

    // prettier-ignore
    if (isLightComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Level(30);
        await waiter('Level(30)', () => { return component.getValue('brightness') === 30; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Level(60);
        await waiter('Level(60)', () => { return component.getValue('brightness') === 60; }, true);

        component.Off();
        await waiter('Off 2', () => { return component.getValue('state') === false; }, true);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 1 shellyem3 device and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.249');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.249');
    expect(device.mac).toBe('485519D732F4');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('SHEM-3');
    expect(device.id).toBe('shellyem3-485519D732F4');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('3EM Gen1');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('relay:0');
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

  test('Create a gen 1 shellyswitch25 device mode relay and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.236');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.236');
    expect(device.mac).toBe('3494547BF36C');
    expect(device.profile).toBe('switch');
    expect(device.model).toBe('SHSW-25');
    expect(device.id).toBe('shellyswitch25-3494547BF36C');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('2.5 Gen1 Relay');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
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
      'meter:0',
      'meter:1',
      'input:0',
      'input:1',
      'sys',
    ]);

    const component0 = device.getComponent('relay:0');
    expect(component0).not.toBeUndefined();

    // prettier-ignore
    if (isSwitchComponent(component0)) {
        component0.On();
        await waiter('On', () => { return component0.getValue('state') === true; }, true);

        component0.Off();
        await waiter('Off', () => { return component0.getValue('state') === false; }, true);

        component0.Toggle();
        await waiter('Toggle', () => { return component0.getValue('state') === true; }, true);

        component0.Off();
        await waiter('Off', () => { return component0.getValue('state') === false; }, true);
      }

    const component1 = device.getComponent('relay:1');
    expect(component1).not.toBeUndefined();

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
  }, 20000);

  test('Create a gen 1 shellyswitch25 device mode roller and send commands', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.222');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);

    expect(device.host).toBe('192.168.1.222');
    expect(device.mac).toBe('3494546BBF7E');
    expect(device.profile).toBe('cover');
    expect(device.model).toBe('SHSW-25');
    expect(device.id).toBe('shellyswitch25-3494546BBF7E');
    expect(device.firmware).toBe(firmwareGen1);
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(1);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('2.5 Gen1 Cover');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Roller', 'PowerMeter', 'Input', 'Sys']);
    expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'roller:0', 'meter:0', 'input:0', 'input:1', 'sys']);

    const component0 = device.getComponent('roller:0');
    expect(component0).not.toBeUndefined();

    // prettier-ignore
    if (isCoverComponent(component0)) {
        component0.Open();
        await waiter('Open', () => { return component0.getValue('state') === 'stop'; }, true, 30000);
        await waiter('Open', () => { return component0.getValue('current_pos') === 100; }, true, 30000);

        component0.Close();
        await waiter('Close', () => { return component0.getValue('state') === 'stop'; }, true, 30000);
        await waiter('Close', () => { return component0.getValue('current_pos') === 0; }, true, 30000);

        component0.GoToPosition(50);
        await waiter('GoToPosition(50)', () => { return component0.getValue('state') === 'stop'; }, true, 30000);
        await waiter('GoToPosition(50)', () => { return component0.getValue('current_pos') === 50; }, true, 30000);

        component0.Open();
        await waiter('Open', () => { return component0.getValue('state') === 'stop'; }, true, 30000);
        await waiter('Open', () => { return component0.getValue('current_pos') === 100; }, true, 30000);
      }

    shelly.removeDevice(device);
    device.destroy();
  }, 120000);
});
