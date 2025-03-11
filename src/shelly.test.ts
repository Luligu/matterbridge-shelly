/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AnsiLogger, db, hk, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { jest } from '@jest/globals';
import path from 'node:path';
import { WsClient } from './wsClient.js';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';

describe('Shellies test', () => {
  const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {
    return;
  });

  const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shellies = new Shelly(log, 'admin', 'tango');

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {
    //
  });

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    shellies.destroy();

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
    const device = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus2pm-5443B23D81F8.switch.json'));
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
    const device2g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
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

  test('Add device twice', async () => {
    const device3g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device3g).not.toBeUndefined();
    if (!device3g) return;
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
    expect(await shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(1);
    device3g.destroy();
  }, 7000);

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
    (shellies as any).wsServer.emit('wssupdate', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    (shellies as any).wsServer.emit('wssupdate', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssupdate from a not registered device`));
  }, 7000);

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
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    (shellies as any).wsServer.emit('wssevent', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssevent from a not registered device`));
  }, 7000);

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
  }, 7000);

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
  }, 7000);

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
