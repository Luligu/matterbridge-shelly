/**
 * @file vitest/shelly.test.ts
 * @description This file contains the tests for the Shelly class.
 * @author Luca Liguori
 */

const NAME = 'Shelly';

import path from 'node:path';

import { AnsiLogger, CYAN, db, hk, LogLevel, MAGENTA, TimestampFormat, wr } from 'matterbridge/logger';
import { flushAsync, loggerLogSpy, setupTest } from 'matterbridge/vitest-utils';

import { CoapServer } from '../src/coapServer.js';
import { Shelly } from '../src/shelly.js';
import { ShellyDevice } from '../src/shellyDevice.js';
import { UdpServer } from '../src/udpServer.js';
import { WsClient } from '../src/wsClient.js';
import { WsServer } from '../src/wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

vi.useFakeTimers();

describe('Shellies test', () => {
  const coapServerStartSpy = vi.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
  const coapServerRegisterDeviceSpy = vi.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {});
  const wsServerStartSpy = vi.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
  const wsClientStartSpy = vi.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});

  const log = new AnsiLogger({ logName: 'ShellyTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shellies = new Shelly(log, 'admin', 'tango');

  beforeAll(() => {});

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    shellies.destroy();

    vi.useRealTimers();

    // Wait a bit to ensure all async operations are done
    await flushAsync();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Constructor', () => {
    expect(shellies).not.toBeUndefined();
    expect(shellies).toBeInstanceOf(Shelly);
    expect(shellies.udpServer).toBeInstanceOf(UdpServer);
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

  test('Check add device with an unsupported gen', async () => {
    // A gen that is neither 1 nor >= 2 (e.g. 0, negative, or a future unsupported gen) is possible: ShellyDevice.create()
    // only sets device.gen inside the gen 1 or gen 2+ branches, so an unrecognized shellyPayload.gen leaves it at its
    // default of 0 instead of returning undefined.
    const device = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1-E465B8F3028C.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.wsClient).toBeDefined();
    if (!device.wsClient) return;
    const wsClientStartOnDeviceSpy = vi.spyOn(device.wsClient, 'start');
    device.gen = 0;
    const onAdd = vi.fn();
    shellies.on('add', onAdd);

    expect(await shellies.addDevice(device)).toBe(shellies);
    expect(shellies.hasDevice(device.id)).toBeTruthy();
    expect(coapServerRegisterDeviceSpy).not.toHaveBeenCalled();
    expect(wsClientStartOnDeviceSpy).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`has an unsupported gen ${CYAN}0`));

    shellies.removeAllListeners('add');
    shellies.removeDevice(device);
    device.destroy();
  });

  test('Log 6 devices', async () => {
    expect(shellies.devices.length).toBe(6);
    for (const [id, device] of shellies) {
      if (device.gen > 1 && !device.sleepMode) device.wsClient = new WsClient(device.id, device.host, 80, shellies.password);
    }
    shellies.logDevices();
    shellies.setLogLevel(LogLevel.INFO, false, false, false, false);
  });

  test('Fetch updates for 4 devices', async () => {
    const deviceFetchUpdateSpy = vi.spyOn(ShellyDevice.prototype, 'fetchUpdate').mockImplementation(async () => {
      return null;
    });

    for (const [id, device] of shellies) {
      expect(device.fetchInterval).toBe(0);
      expect(device.lastFetched).toBeGreaterThan(0);
      // oxlint-disable-next-line vitest/no-conditional-expect -- assertion legitimately depends on the device's gen/sleepMode
      if (device.gen === 1) expect(device.wsClient).toBeUndefined();
      // oxlint-disable-next-line vitest/no-conditional-expect -- assertion legitimately depends on the device's gen/sleepMode
      else if (device.gen >= 1 && !device.sleepMode) expect(device.wsClient).toBeDefined();
    }

    loggerLogSpy.mockClear();
    vi.advanceTimersByTime(10 * 1000);
    expect(loggerLogSpy).toHaveBeenCalledTimes(8);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`fetch interval`));

    for (const [id, device] of shellies) {
      expect(device.fetchInterval).not.toBe(0);
      expect(device.lastFetched).toBeGreaterThan(0);
      device.lastFetched = 0;
    }
    loggerLogSpy.mockClear();
    vi.advanceTimersByTime(10 * 1000);
    expect(loggerLogSpy).toHaveBeenCalledTimes(4);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Fetching data from device`));

    deviceFetchUpdateSpy.mockRestore();
  });

  test('Interval fetch: sleepMode recently seen, truthy fetch data and fetch errors', async () => {
    const devices = [...shellies].map(([, device]) => device);
    const sleepyDevice = devices.find((device) => device.sleepMode);
    const dataDevice = devices.find((device) => device.id.startsWith('shellyplus1pm'));
    const errorDevice = devices.find((device) => device.id.startsWith('shelly1minig3'));
    expect(sleepyDevice).toBeDefined();
    expect(dataDevice).toBeDefined();
    expect(errorDevice).toBeDefined();
    if (!sleepyDevice || !dataDevice || !errorDevice) return;

    // sleepMode device recently seen: must not be set offline and must not emit 'offline'
    sleepyDevice.lastseen = Date.now();
    sleepyDevice.online = false;
    const onOffline = vi.fn();
    sleepyDevice.on('offline', onOffline);

    // force a new fetch attempt for the data and error devices
    dataDevice.lastFetched = 0;
    errorDevice.lastFetched = 0;

    const fetchUpdateSpy = vi.spyOn(ShellyDevice.prototype, 'fetchUpdate').mockImplementation(async function (this: ShellyDevice) {
      if (this === dataDevice) return { mac: 'test' };
      if (this === errorDevice) throw new Error('fetch failed');
      return null;
    });
    const saveDevicePayloadsSpy = vi.spyOn(ShellyDevice.prototype, 'saveDevicePayloads').mockResolvedValue(true);

    loggerLogSpy.mockClear();
    await vi.advanceTimersByTimeAsync(10 * 1000);

    // sleepMode device: recently seen so no offline warning and no 'offline' emit
    expect(onOffline).not.toHaveBeenCalled();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('has not reported in the last 24 hours'));

    // data device: fetchUpdate resolved truthy data, so the payloads must be saved
    expect(saveDevicePayloadsSpy).toHaveBeenCalledTimes(1);

    // error device: fetchUpdate rejected, so the error must be logged
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error fetching data from device`));

    fetchUpdateSpy.mockRestore();
    saveDevicePayloadsSpy.mockRestore();
    vi.useRealTimers();
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

  test('getDeviceByHost', () => {
    const host = path.join('src', 'mock', 'shelly1minig3-543204547478.json');
    const device = shellies.getDeviceByHost(host);
    expect(device).toBeDefined();
    expect(device?.host).toBe(host);
    expect(shellies.getDeviceByHost('192.168.255.255')).toBeUndefined();
  });

  test('wsServer on wssupdate', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    const onUpdateSpy = vi.spyOn(device, 'onUpdate');
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    (shellies as any).wsServer.emit('wssupdate', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onUpdateSpy).not.toHaveBeenCalled();

    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    (shellies as any).wsServer.emit('wssupdate', 'shelly1minig3-543204547478', { bthome: {} });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
    expect(onUpdateSpy).toHaveBeenCalledTimes(1);
    expect(onUpdateSpy).toHaveBeenCalledWith({ bthome: {} });
    onUpdateSpy.mockRestore();

    (shellies as any).wsServer.emit('wssupdate', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssupdate from a not registered device`));
  }, 10000);

  test('wsServer on wssevent', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    const onEventSpy = vi.spyOn(device, 'onEvent');
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);

    // params is not a valid object: onEvent must not be called
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onEventSpy).not.toHaveBeenCalled();

    // params is a valid object but events is not a valid array: onEvent must not be called
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', { events: [] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
    expect(onEventSpy).not.toHaveBeenCalled();

    // params is a valid object and events is a valid array: onEvent must be called with the events
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const events = [{ component: 'sys', event: 'cfg_changed', ts: 1234 }];
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', { events });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(3);
    expect(onOnline).toHaveBeenCalledTimes(3);
    expect(onEventSpy).toHaveBeenCalledTimes(1);
    expect(onEventSpy).toHaveBeenCalledWith(events);
    onEventSpy.mockRestore();

    // device already awake, online and not cached: awake/online must not be emitted and the logs must not be sent again
    device.sleepMode = false;
    device.online = true;
    device.cached = false;
    loggerLogSpy.mockClear();
    (shellies as any).wsServer.emit('wssevent', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(3);
    expect(onOnline).toHaveBeenCalledTimes(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));

    // device not registered: handler returns early
    (shellies as any).wsServer.emit('wssevent', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received wssevent from a not registered device`));
  }, 10000);

  test('udpServer on udpupdate', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    const onUpdateSpy = vi.spyOn(device, 'onUpdate');
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);
    shellies.udpServer.emit('udpupdate', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onUpdateSpy).not.toHaveBeenCalled();

    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    shellies.udpServer.emit('udpupdate', 'shelly1minig3-543204547478', { bthome: {} });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
    expect(onUpdateSpy).toHaveBeenCalledTimes(1);
    expect(onUpdateSpy).toHaveBeenCalledWith({ bthome: {} });
    onUpdateSpy.mockRestore();

    device.sleepMode = false;
    device.online = true;
    device.cached = false;
    loggerLogSpy.mockClear();
    shellies.udpServer.emit('udpupdate', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));

    shellies.udpServer.emit('udpupdate', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received udpupdate from a not registered device`));
  }, 10000);

  test('udpServer on udpevent', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    const onEventSpy = vi.spyOn(device, 'onEvent');
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);

    shellies.udpServer.emit('udpevent', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(onEventSpy).not.toHaveBeenCalled();

    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    shellies.udpServer.emit('udpevent', 'shelly1minig3-543204547478', { events: [] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(2);
    expect(onOnline).toHaveBeenCalledTimes(2);
    expect(onEventSpy).not.toHaveBeenCalled();

    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    const events = [{ component: 'sys', event: 'cfg_changed', ts: 1234 }];
    shellies.udpServer.emit('udpevent', 'shelly1minig3-543204547478', { events });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(3);
    expect(onOnline).toHaveBeenCalledTimes(3);
    expect(onEventSpy).toHaveBeenCalledTimes(1);
    expect(onEventSpy).toHaveBeenCalledWith(events);
    onEventSpy.mockRestore();

    device.sleepMode = false;
    device.online = true;
    device.cached = false;
    loggerLogSpy.mockClear();
    shellies.udpServer.emit('udpevent', 'shelly1minig3-543204547478', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onAwake).toHaveBeenCalledTimes(3);
    expect(onOnline).toHaveBeenCalledTimes(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));

    shellies.udpServer.emit('udpevent', 'shellyxxx', {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Received udpevent from a not registered device`));
  }, 10000);

  test('mdnsScanner on discovered', async () => {
    const onDiscovered = vi.fn();
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
    const host = path.join('src', 'mock', 'shelly1minig3-543204547478.json');
    const device = shellies.getDeviceByHost(host);
    expect(device).toBeDefined();
    if (!device) return;
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);

    // device found, component missing (this device was destroyed earlier, so it has no components), sleepMode true, offline, cached
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    (shellies as any).coapServer.emit('update', host, 'sys', 'temperature', 12.3);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`CoIoT update from device id ${hk}shelly1minig3-543204547478${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`does not have component ${CYAN}sys`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);

    // device found, component present, not sleeping, already online, not cached
    const device2 = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
    expect(device2).not.toBeUndefined();
    if (!device2) return;
    expect(await shellies.addDevice(device2)).toBe(shellies);
    const component = device2.getComponent('switch:0');
    expect(component).toBeDefined();
    if (!component) return;
    const setValueSpy = vi.spyOn(component, 'setValue');
    device2.sleepMode = false;
    device2.online = true;
    device2.cached = false;
    loggerLogSpy.mockClear();
    (shellies as any).coapServer.emit('update', device2.host, 'switch:0', 'apower', 42);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`does not have component`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(setValueSpy).toHaveBeenCalledWith('apower', 42);
    setValueSpy.mockRestore();
    device2.destroy();
    shellies.removeDevice(device2);

    // host not matching any device: handler is a no-op
    loggerLogSpy.mockClear();
    (shellies as any).coapServer.emit('update', 'not-a-device-host', 'sys', 'temperature', 12.3);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).not.toHaveBeenCalled();
  }, 10000);

  test('coapServer on coapupdate', async () => {
    const device = shellies.getDeviceByHost(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
    expect(device).toBeDefined();
    if (!device) return;
    const updateComponentSpy = vi.spyOn(device, 'updateComponent');
    const onAwake = vi.fn();
    const onOnline = vi.fn();
    device.on('awake', onAwake);
    device.on('online', onOnline);

    // device found, sleepMode true, offline, cached, valid data: updateComponent is called for each key
    device.sleepMode = true;
    device.online = false;
    device.cached = true;
    (shellies as any).coapServer.emit('coapupdate', device.host, { sys: { temperature: 12.3 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`CoIoT coapupdate from device id ${hk}shelly1minig3-543204547478${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(updateComponentSpy).toHaveBeenCalledTimes(1);
    expect(updateComponentSpy).toHaveBeenCalledWith('sys', { temperature: 12.3 });

    // device found, not sleeping, already online, not cached, data is not a valid object: updateComponent must not be called
    device.sleepMode = false;
    device.online = true;
    device.cached = false;
    updateComponentSpy.mockClear();
    loggerLogSpy.mockClear();
    (shellies as any).coapServer.emit('coapupdate', device.host, {});
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`CoIoT coapupdate from device id ${hk}shelly1minig3-543204547478${db}`));
    expect(onAwake).toHaveBeenCalledTimes(1);
    expect(onOnline).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting online to true`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`setting cached to false`));
    expect(updateComponentSpy).not.toHaveBeenCalled();
    updateComponentSpy.mockRestore();

    // host not matching any device: handler is a no-op
    loggerLogSpy.mockClear();
    (shellies as any).coapServer.emit('coapupdate', 'not-a-device-host', { sys: { temperature: 12.3 } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).not.toHaveBeenCalled();
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

  test('Set log level', async () => {
    expect((shellies as any).log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.udpServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);

    const device2g = await ShellyDevice.create(shellies, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
    expect(device2g).not.toBeUndefined();
    if (!device2g) return;
    expect(await shellies.addDevice(device2g)).toBe(shellies);
    expect(device2g.wsClient).toBeDefined();

    shellies.setLogLevel(LogLevel.DEBUG, true, true, true, true);
    expect((shellies as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.udpServer.log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.DEBUG);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.DEBUG);
    expect(WsClient.logLevel).toBe(LogLevel.DEBUG);
    expect(device2g.wsClient?.log.logLevel).toBe(LogLevel.DEBUG);

    shellies.setLogLevel(LogLevel.INFO, false, false, false, false);
    expect((shellies as any).log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.udpServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);
    expect(device2g.wsClient?.log.logLevel).toBe(LogLevel.INFO);

    shellies.setLogLevel(LogLevel.NOTICE, false, false, false, false);
    expect((shellies as any).log.logLevel).toBe(LogLevel.NOTICE);
    expect(shellies.mdnsScanner.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.udpServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.wsServer.log.logLevel).toBe(LogLevel.INFO);
    expect(shellies.coapServer.log.logLevel).toBe(LogLevel.INFO);
    expect(WsClient.logLevel).toBe(LogLevel.INFO);
    expect(device2g.wsClient?.log.logLevel).toBe(LogLevel.INFO);

    device2g.destroy();
  });
});
