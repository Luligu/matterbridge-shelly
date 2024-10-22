/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { jest } from '@jest/globals';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';

describe('Shellies', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'ShellyDeviceRealTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const firmwareGen2 = '1.4.4-g6d2a586';
  const address = '30:f6:ef:69:2b:c5';

  beforeAll(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // consoleLogSpy.mockRestore();
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true);
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

  test('Create a gen 2 shellyplusrgbwpm device color mode and send commands', async () => {
    if (getMacAddress() !== address) return;
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
    expect(device.name).toBe('RGBW PM Plus');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Rgb', 'Sys', 'Sntp', 'WiFi', 'WS']);
    // prettier-ignore
    expect(device.getComponentIds()).toStrictEqual(["ble", "cloud", "input:0", "input:1", "input:2", "input:3", "mqtt", "rgb:0", "sys", "sntp", 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

    const component = device.getComponent('rgb:0');
    expect(component).not.toBeUndefined();
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

  test('create a gen 2 shellyplus1pm 217 device and update', async () => {
    if (getMacAddress() !== address) return;
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
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.218');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    (device as any).wsClient?.start();

    expect(device.gen).toBe(2);
    expect(device.host).toBe('192.168.1.218');
    expect(device.model).toBe('SNSW-102P16EU');
    expect(device.mac).toBe('5443B23D81F8');
    expect(device.id).toBe('shellyplus2pm-5443B23D81F8');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('2PM Plus Cover');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const cover = device.getComponent('cover:0');
    expect(cover).not.toBeUndefined();

    // prettier-ignore
    if (isCoverComponent(cover)) {
      cover.Open();
      await waiter('Open()', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
      await waiter('Open() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'open'; }, true, 30000);
      expect(cover.getValue('source')).toMatch(/^(limit_switch|timeout)$/); // 'limit_switch' if not stopped for timeout
      expect(cover.getValue('state')).toMatch(/^(open|stopped)$/); // 'open' if not stopped for timeout
      expect(cover.getValue('last_direction')).toBe('open');
      expect(cover.getValue('current_pos')).toBe(100);

      cover.Close();
      await wait(2000);
      cover.Stop();
      await waiter('Stop()', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
      expect(cover.getValue('state')).toBe('stopped');
      expect(cover.getValue('last_direction')).toBe('open');
      expect(cover.getValue('current_pos')).toBe(100);

      cover.Close();
      await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
      await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
      expect(cover.getValue('source')).toMatch(/^(HTTP_in|timeout)$/); // 'HTTP_in' if not stopped for timeout
      expect(cover.getValue('state')).toMatch(/^(closed|stopped)$/); // 'closed' if not stopped for timeout
      expect(cover.getValue('last_direction')).toBe('close');
      expect(cover.getValue('current_pos')).toBe(0);

      cover.GoToPosition(10);
      await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
      await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
      expect(cover.getValue('source')).toBe('timeout');
      expect(cover.getValue('state')).toBe('stopped');
      expect(cover.getValue('last_direction')).toBe('open');
      expect(cover.getValue('current_pos')).toBe(10);

      cover.Close();
      await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
      await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
      expect(cover.getValue('source')).toMatch(/^(HTTP_in|timeout)$/); // 'HTTP_in' if not stopped for timeout
      expect(cover.getValue('state')).toMatch(/^(closed|stopped)$/); // 'closed' if not stopped for timeout
      expect(cover.getValue('last_direction')).toBe('close');
      expect(cover.getValue('current_pos')).toBe(0);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 120000);
});
