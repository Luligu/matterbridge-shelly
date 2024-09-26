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

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.2-gc2639da';
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

  describe('test real gen 3 shelly1minig3 221 with auth', () => {
    if (getMacAddress() !== address) return;

    test('create a gen 3 shelly1minig3 device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.221');
      expect(device).not.toBeUndefined();
      if (!device) return;
      shelly.addDevice(device);
      (device as any).wsClient?.start();

      expect(device.gen).toBe(3);
      expect(device.host).toBe('192.168.1.221');
      expect(device.model).toBe('S3SW-001X8EU');
      expect(device.mac).toBe('543204547478');
      expect(device.id).toBe('shelly1minig3-543204547478');
      expect(device.hasUpdate).toBe(false);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(true);

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
    }, 30000);
  });
});
