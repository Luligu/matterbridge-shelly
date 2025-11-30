// src/shelly.test.ts

const MATTER_PORT = 0;
const NAME = 'Shelly';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { AnsiLogger, CYAN, db, hk, LogLevel, MAGENTA, TimestampFormat, wr } from 'matterbridge/logger';
import { jest } from '@jest/globals';
import { flushAsync, loggerLogSpy, setupTest } from 'matterbridge/jestutils';

import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { WsClient } from './wsClient.js';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

jest.useFakeTimers();

describe('Shellies test', () => {
  const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
  const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {});
  const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
  const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});

  const log = new AnsiLogger({ logName: 'ShellyTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shellies = new Shelly(log, 'admin', 'tango');

  beforeAll(() => {});

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    shellies.destroy();

    jest.useRealTimers();

    // Wait a bit to ensure all async operations are done
    await flushAsync();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Constructor', () => {
    expect(shellies).not.toBeUndefined();
    expect(shellies).toBeInstanceOf(Shelly);
    // expect(coapServerStartSpy).toHaveBeenCalledTimes(1);
    // expect(wsServerStartSpy).toHaveBeenCalledTimes(1);
  });

  test('Empty shellies', () => {
    expect(shellies.devices.length).toBe(0);
  });

  test('Check has/get device', async () => {
    const device = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1-E465B8F3028C.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(shellies.devices.length).toBe(0);
    expect(shellies.hasDevice(device.id)).toBeFalsy();
    expect(shellies.getDevice(device.id)).toBeUndefined();
    device.destroy();
  });

  test('Check add device gen 1', async () => {
    const device1g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
    if (!device1g) return;
    expect(device1g.wsClient).toBeUndefined();
    expect(shellies.devices.length).toBe(0);
    expect(await shellies.addDevice(device1g)).toBe(shellies);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBe(device1g);
    expect(shellies.devices.length).toBe(1);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device1g.host)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBeDefined();
    device1g.destroy();
  });

  test('Check add device gen 2', async () => {
    const device2g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
    if (!device2g) return;
    expect(device2g.wsClient).toBeDefined();
    expect(device2g.wsClient).toBeInstanceOf(WsClient);
    expect(shellies.devices.length).toBe(1);
    expect(shellies.hasDevice(device2g.id)).toBeFalsy();
    expect(shellies.getDevice(device2g.id)).toBeUndefined();
    expect(await shellies.addDevice(device2g)).toBe(shellies);
    expect(shellies.devices.length).toBe(2);
    expect(shellies.hasDevice(device2g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device2g.host)).toBeTruthy();
    expect(shellies.getDevice(device2g.id)).toBeDefined();
    device2g.destroy();
  });

  test('Check add device gen 3', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    if (!device3g) return;
    expect(device3g.wsClient).toBeDefined();
    expect(device3g.wsClient).toBeInstanceOf(WsClient);
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

  test('Check add device gen 4', async () => {
    const device4g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1g4-A085E3BCA4C8.json'));
    if (!device4g) return;
    expect(device4g.wsClient).toBeDefined();
    expect(device4g.wsClient).toBeInstanceOf(WsClient);
    expect(shellies.devices.length).toBe(3);
    expect(shellies.hasDevice(device4g.id)).toBeFalsy();
    expect(shellies.hasDeviceHost(device4g.id)).toBeFalsy();
    expect(shellies.getDevice(device4g.id)).toBeUndefined();
    expect(await shellies.addDevice(device4g)).toBe(shellies);
    expect(shellies.devices.length).toBe(4);
    expect(shellies.hasDevice(device4g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device4g.host)).toBeTruthy();
    expect(shellies.getDevice(device4g.id)).toBeDefined();
    device4g.destroy();
  });

  test('Check add device gen 1 with sleep mode', async () => {
    const device1g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyht-703523.json'));
    if (!device1g) return;
    expect(device1g.wsClient).toBeUndefined();
    expect(shellies.devices.length).toBe(4);
    expect(await shellies.addDevice(device1g)).toBe(shellies);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBe(device1g);
    expect(shellies.devices.length).toBe(5);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device1g.host)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBeDefined();
    device1g.destroy();
  });

  test('Check add device gen 3 with sleep mode', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyhtg3-3030F9EC8468.json'));
    if (!device3g) return;
    expect(device3g.wsClient).toBeUndefined();
    expect(shellies.devices.length).toBe(5);
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.hasDevice(device3g.id)).toBeTruthy();
    expect(shellies.getDevice(device3g.id)).toBe(device3g);
    expect(shellies.devices.length).toBe(6);
    expect(shellies.hasDevice(device3g.id)).toBeTruthy();
    expect(shellies.hasDeviceHost(device3g.host)).toBeTruthy();
    expect(shellies.getDevice(device3g.id)).toBeDefined();
    device3g.destroy();
  });

  test('Log 6 devices', async () => {
    expect(shellies.devices.length).toBe(6);
    for (const [id, device] of shellies) {
      if (device.gen > 1 && !device.sleepMode) device.wsClient = new WsClient(device.id, device.host, 80, shellies.password);
    }
    shellies.logDevices();
    shellies.setLogLevel(LogLevel.INFO, false, false, false);
  });

  test('Fetch updates for 4 devices', async () => {
    const deviceFetchUpdateSpy = jest.spyOn(ShellyDevice.prototype, 'fetchUpdate').mockImplementation(async () => {
      return null;
    });

    for (const [id, device] of shellies) {
      expect(device.fetchInterval).toBe(0);
      expect(device.lastFetched).toBeGreaterThan(0);
      // eslint-disable-next-line jest/no-conditional-expect
      if (device.gen === 1) expect(device.wsClient).toBeUndefined();
      // eslint-disable-next-line jest/no-conditional-expect
      else if (device.gen >= 1 && device.sleepMode === false) expect(device.wsClient).toBeDefined();
    }

    loggerLogSpy.mockClear();
    jest.advanceTimersByTime(10 * 1000);
    expect(loggerLogSpy).toHaveBeenCalledTimes(8);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`fetch interval`));

    for (const [id, device] of shellies) {
      expect(device.fetchInterval).not.toBe(0);
      expect(device.lastFetched).toBeGreaterThan(0);
      device.lastFetched = 0;
    }
    loggerLogSpy.mockClear();
    jest.advanceTimersByTime(10 * 1000);
    expect(loggerLogSpy).toHaveBeenCalledTimes(4);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Fetching data from device`));

    jest.useRealTimers();
  });

  test('Destroy 4 devices', async () => {
    expect(shellies.devices.length).toBe(6);
    for (const [id, device] of shellies) {
      if (device.model === 'SHDM-2') shellies.removeDevice(device.id);
      else shellies.removeDevice(device);
      expect(shellies.hasDevice(id)).toBeFalsy();
      device.destroy();
    }
    expect(shellies.devices.length).toBe(0);
  });

  test('Add device twice', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device3g).not.toBeUndefined();
    if (!device3g) return;
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.WARN,
      expect.stringContaining(
        `Shelly device ${hk}${device3g.id}${wr}: name ${CYAN}${device3g.name}${wr} ip ${MAGENTA}${device3g.host}${wr} model ${CYAN}${device3g.model}${wr} already exists`,
      ),
    );
    device3g.destroy();
  }, 10000);

  test('wsServer on wssupdate', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = jest.fn();
    const onOnline = jest.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    (shellies as any).wsServer.emit('wssupdate', 'shelly1minig3-543204547478', { bthome: {} });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    (shellies as any).wsServer.emit('wssupdate', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssupdate from a not registered device`));
  }, 10000);

  test('wsServer on wssevent', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = jest.fn();
    const onOnline = jest.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', { events: [{ component: 'sys', event: 'cfg_changed', ts: 1234 }] });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    (shellies as any).wsServer.emit('wssevent', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssevent from a not registered device`));
  }, 10000);

  test('mdnsScanner on discovered', async () => {
    const onDiscovered = jest.fn();
    shellies.on('discovered', onDiscovered);
    (shellies as any).mdnsScanner.emit('discovered', {
      id: 'shelly1minig3-543204547478',
      host: '192.168.234.235',
      port: 80,
      gen: 3,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(onDiscovered).toHaveBeenCalledWith({
      id: 'shelly1minig3-543204547478',
      host: '192.168.234.235',
      port: 80,
      gen: 3,
    });
  }, 10000);

  test('coapServer on update', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = jest.fn();
    const onOnline = jest.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    (shellies as any).coapServer.emit('update', path.join('src', 'mock', 'shelly1minig3-543204547478.json'), 'sys', 'temperature', 12.3);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`CoIoT update from device id ${hk}shelly1minig3-543204547478${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
  }, 10000);

  test('coapServer on coapupdate', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = jest.fn();
    const onOnline = jest.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    (shellies as any).coapServer.emit('coapupdate', device.host, { sys: { temperature: 12.3 } });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`CoIoT coapupdate from device id ${hk}shelly1minig3-543204547478${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
  }, 10000);

  test('Set get data path', () => {
    shellies.dataPath = 'local';
    expect(shellies.dataPath).toBe('local');
    expect((shellies as any)._dataPath).toBe('local');
    expect((shellies as any).mdnsScanner._dataPath).toBe('local');
    expect((shellies as any).coapServer._dataPath).toBe('local');
    shellies.dataPath = 'temp';
    expect(shellies.dataPath).toBe('temp');
    expect((shellies as any)._dataPath).toBe('temp');
    expect((shellies as any).mdnsScanner._dataPath).toBe('temp');
    expect((shellies as any).coapServer._dataPath).toBe('temp');
  });

  test('Set get interfaceName', () => {
    shellies.interfaceName = 'eth0';
    expect(shellies.interfaceName).toBe('eth0');
    expect((shellies as any)._interfaceName).toBe('eth0');
  });

  test('Set get ipv4Address', () => {
    shellies.ipv4Address = '192.168.1.100';
    expect(shellies.ipv4Address).toBe('192.168.1.100');
    expect((shellies as any)._ipv4Address).toBe('192.168.1.100');
  });

  test('Set get ipv6Address', () => {
    shellies.ipv6Address = 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9';
    expect(shellies.ipv6Address).toBe('fd78:cbf8:4939:746:a58f:3de1:74fc:5db9');
    expect((shellies as any)._ipv6Address).toBe('fd78:cbf8:4939:746:a58f:3de1:74fc:5db9');
  });

  test('Set log level', () => {
    expect((shellies as any).log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);

    shellies.setLogLevel(LogLevel.DEBUG, true, true, true);
    expect((shellies as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.DEBUG);
    expect(WsClient.logLevel).toBe(LogLevel.DEBUG);

    shellies.setLogLevel(LogLevel.INFO, false, false, false);
    expect((shellies as any).log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);

    shellies.setLogLevel(LogLevel.NOTICE, false, false, false);
    expect((shellies as any).log.logLevel).toBe(LogLevel.NOTICE);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);
  });
});
