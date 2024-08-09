/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/no-done-callback */
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { jest } from '@jest/globals';
import path from 'path';

describe('Shellies test', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shellies = new Shelly(log, 'admin', 'tango');
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(`Mocked console.log: ${args}`);
    });
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    shellies.destroy();
  });

  test('Constructor', () => {
    expect(shellies).not.toBeUndefined();
  });

  test('Empty shellies', () => {
    expect(shellies.devices.length).toBe(0);
  });

  test('Check has/get device', async () => {
    const device = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.switch.json'));
    if (!device) return;
    expect(shellies.hasDevice(device.id)).toBeFalsy();
    expect(shellies.getDevice(device.id)).toBeUndefined();
    device.destroy();
  });

  test('Check add device gen 1', async () => {
    const device1g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
    if (!device1g) return;
    expect(shellies.devices.length).toBe(0);
    expect(await shellies.addDevice(device1g)).toBe(shellies);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBe(device1g);
    expect(shellies.devices.length).toBe(1);
    device1g.destroy();
  });

  test('Check add device gen 2', async () => {
    const device2g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1pm-441793d69718.json'));
    if (!device2g) return;
    expect(shellies.devices.length).toBe(1);
    expect(shellies.hasDevice(device2g.id)).toBeFalsy();
    expect(shellies.getDevice(device2g.id)).toBeUndefined();
    expect(await shellies.addDevice(device2g)).toBe(shellies);
    expect(shellies.devices.length).toBe(2);
    device2g.destroy();
  });

  test('Check add device gen 3', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    if (!device3g) return;
    expect(shellies.devices.length).toBe(2);
    expect(shellies.hasDevice(device3g.id)).toBeFalsy();
    expect(shellies.hasDeviceHost(device3g.id)).toBeFalsy();
    expect(shellies.getDevice(device3g.id)).toBeUndefined();
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(3);
    expect(shellies.hasDevice(device3g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device3g.host)).toBeTruthy();
    expect(shellies.getDevice(device3g.id)).toBeDefined();
    device3g.destroy();
  });

  test('Log 3 devices', async () => {
    expect(shellies.devices.length).toBe(3);
    shellies.logDevices();
    expect(shellies.devices.length).toBe(3);
  });

  test('Destroy 3 devices', async () => {
    expect(shellies.devices.length).toBe(3);
    for (const [id, device] of shellies) {
      if (device.model === 'SHDM-2') shellies.removeDevice(device.id);
      else shellies.removeDevice(device);
      expect(shellies.hasDevice(id)).toBeFalsy();
      device.destroy();
    }
    expect(shellies.devices.length).toBe(0);
  });

  test('Add device to test', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device3g).not.toBeUndefined();
    if (!device3g) return;
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
  }, 7000);

  test('Start mdnsdiscover', (done) => {
    shellies.startMdns(60, undefined, undefined, false);
    shellies.startMdns(60, 'localhost', 'udp4', true);
    setTimeout(() => {
      done();
      expect(shellies.devices.length).toBe(1);
    }, 5000);
    (shellies as any).mdnsScanner.emit('discovered', {
      id: 'shelly1minig3-543204547478',
      host: '192.168.234.235',
      port: 80,
      gen: 3,
    });
  }, 7000);

  test('Start coap', (done) => {
    shellies.startCoap(undefined);
    setTimeout(() => {
      done();
      expect(shellies.devices.length).toBe(1);
    }, 5000);
    shellies.logDevices();
    (shellies as any).coapServer.emit('update', path.join('src', 'mock', 'shelly1minig3-543204547478.json'), 'sys', 'temperature', 12.3);
  }, 7000);

  test('Start coap timeout', (done) => {
    shellies.startCoap(100);
    setTimeout(() => {
      done();
      expect(shellies.devices.length).toBe(1);
    }, 5000);
  }, 7000);

  test('Set data path', () => {
    shellies.dataPath = 'temp';
    expect((shellies as any)._dataPath).toBe('temp');
    expect((shellies as any).mdnsScanner._dataPath).toBe('temp');
    expect((shellies as any).coapServer._dataPath).toBe('temp');
  });

  test('Set debug mdns', () => {
    shellies.debugMdns = true;
    expect((shellies as any).mdnsScanner._debug).toBe(true);
  });

  test('Set debug coap', () => {
    shellies.debugCoap = true;
    expect((shellies as any).coapServer._debug).toBe(true);
  });

  test('Set log level', () => {
    shellies.setLogLevel(LogLevel.DEBUG, true, true, true);
    expect((shellies as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect((shellies as any).mdnsScanner._debug).toBe(true);
    expect((shellies as any).coapServer._debug).toBe(true);
    shellies.setLogLevel(LogLevel.INFO, false, false, true);
    expect((shellies as any).log.logLevel).toBe(LogLevel.INFO);
  });
});
