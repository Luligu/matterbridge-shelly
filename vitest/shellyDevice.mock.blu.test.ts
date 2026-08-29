/**
 * @file vitest/shellyDevice.mock.blu.test.ts
 * @description This file contains the tests for a mock Shelly BLU gateway and its BTHome events.
 * @author Luca Liguori
 */

const NAME = 'ShellyDeviceMockBlu';

import path from 'node:path';

import { MatterbridgeEndpoint, type PlatformMatterbridge } from 'matterbridge';
import { LogLevel } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';
import { log, loggerLogSpy, setupTest } from 'matterbridge/vitest-utils';
import { createTestEnvironment, destroyTestEnvironment, getMatterbridge } from 'matterbridge/vitest-utils/matter';

import { CoapServer } from '../src/coapServer.js';
import { MdnsScanner } from '../src/mdnsScanner.js';
import { ShellyPlatform, type ShellyPlatformConfig } from '../src/module.js';
import type { Shelly } from '../src/shelly.js';
import { ShellyDevice } from '../src/shellyDevice.js';
import { UdpServer } from '../src/udpServer.js';
import { WsClient } from '../src/wsClient.js';
import { WsServer } from '../src/wsServer.js';

await setupTest(NAME, false);

vi.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
vi.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
vi.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
vi.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
vi.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
vi.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
vi.spyOn(UdpServer.prototype, 'start').mockImplementation(() => {});
vi.spyOn(UdpServer.prototype, 'stop').mockImplementation(() => {});
vi.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
vi.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});

const mockConfig: ShellyPlatformConfig = {
  name: 'matterbridge-shelly',
  type: 'DynamicPlatform',
  version: '1.1.2',
  username: 'admin',
  password: 'tango',
  switchList: [],
  lightList: [],
  inputContactList: [],
  inputMomentaryList: [],
  inputLatchingList: [],
  nocacheList: [],
  blackList: [],
  whiteList: [],
  entityBlackList: [],
  deviceEntityBlackList: {},
  enableMdnsDiscover: false,
  enableStorageDiscover: false,
  resetStorageDiscover: false,
  enableBleDiscover: true,
  failsafeCount: 0,
  postfix: '',
  expertMode: true,
  debug: true,
  debugMdns: false,
  debugCoap: false,
  debugWs: false,
  debugUdp: false,
  unregisterOnShutdown: false,
};

describe('Shelly BLU gateway mock device', () => {
  let matterbridge: PlatformMatterbridge;
  let platform: ShellyPlatform;
  let shelly: Shelly;
  let device: ShellyDevice;

  beforeAll(async () => {
    await createTestEnvironment();
    matterbridge = getMatterbridge();
    platform = new ShellyPlatform(matterbridge, log, mockConfig);
    shelly = (platform as unknown as { shelly: Shelly }).shelly;
    clearInterval((shelly as unknown as { fetchInterval: NodeJS.Timeout }).fetchInterval);
    vi.spyOn(platform, 'registerDevice').mockResolvedValue();

    const mockPath = path.join('src', 'mock', 'shellyblugwg3-34CDB077BCD4.json');
    const createdDevice = await ShellyDevice.create(shelly, log, mockPath);
    if (!createdDevice) throw new Error(`Unable to create mock Shelly device from ${mockPath}`);
    device = createdDevice;
    shelly.emit('add', device);
    await wait(100);
  });

  afterAll(async () => {
    device.destroy();
    shelly.destroy();
    await destroyTestEnvironment();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    loggerLogSpy.mockClear();
  });

  test('should register every BTHome event handler when the BLU gateway is added', () => {
    expect(device.bthomeDevices.size).toBe(5);
    expect(device.bthomeSensors.size).toBe(20);
    expect(platform.gatewayDevices.get(device.id)).toBe(device.id);
    expect(platform.bluBridgedDevices.size).toBe(5);
    expect(device.listenerCount('bthomedevice_update')).toBe(1);
    expect(device.listenerCount('bthomesensor_update')).toBe(1);
    expect(device.listenerCount('bthome_event')).toBe(1);
    expect(device.listenerCount('bthomedevice_event')).toBe(1);
    expect(device.listenerCount('bthomesensor_event')).toBe(1);
  });

  test('should handle BTHome device and sensor updates', () => {
    const trvAddress = '28:68:47:fc:9a:6b';
    const htAddress = '7c:c6:b6:65:2d:87';
    const doorWindowAddress = '0c:ef:f6:f1:d7:7b';
    const doorWindow = platform.bluBridgedDevices.get(doorWindowAddress);
    expect(doorWindow).toBeDefined();
    if (!doorWindow) return;

    device.emit('bthomedevice_update', trvAddress, -38, 156, 1779361811);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('observer device update message'));

    loggerLogSpy.mockClear();
    device.emit('bthomedevice_update', '00:00:00:00:00:00', -50, 1, 1779361811);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('sent an unknown BLU device address'));

    loggerLogSpy.mockClear();
    const validateEntitySpy = vi.spyOn(platform, 'validateEntity').mockReturnValue(true);
    const getChildEndpointSpy = vi.spyOn(doorWindow, 'getChildEndpointById').mockReturnValue(doorWindow);
    const setAttributeSpy = vi.spyOn(MatterbridgeEndpoint.prototype, 'setAttribute').mockResolvedValue(true);
    device.emit('bthomesensor_update', trvAddress, 'Battery', 0, 81);
    device.emit('bthomesensor_update', trvAddress, 'Battery', 0, 15);
    device.emit('bthomesensor_update', trvAddress, 'Battery', 0, 5);
    device.emit('bthomesensor_update', trvAddress, 'Temperature', 0, 10);
    device.emit('bthomesensor_update', trvAddress, 'Temperature', 1, 23.7);
    device.emit('bthomesensor_update', htAddress, 'Temperature', 0, 22.5);
    device.emit('bthomesensor_update', htAddress, 'Humidity', 0, 58);
    device.emit('bthomesensor_update', doorWindowAddress, 'Illuminance', 0, 100);
    device.emit('bthomesensor_update', doorWindowAddress, 'Motion', 0, true);
    device.emit('bthomesensor_update', doorWindowAddress, 'Contact', 0, true);
    device.emit('bthomesensor_update', '00:00:00:00:00:00', 'Temperature', 0, 20);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('observer sensor update message'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('sent an unknown BLU device address'));
    expect(setAttributeSpy).toHaveBeenCalled();
    validateEntitySpy.mockRestore();
    getChildEndpointSpy.mockRestore();
    setAttributeSpy.mockRestore();
  });

  test('should handle all BTHome lifecycle and device events', async () => {
    const htAddress = '7c:c6:b6:65:2d:87';
    const bthomeDevice = device.bthomeDevices.get(htAddress);
    const blu = platform.bluBridgedDevices.get(htAddress);
    expect(bthomeDevice).toBeDefined();
    expect(blu).toBeDefined();
    if (!bthomeDevice || !blu) return;

    device.emit('bthome_event', { component: 'bthome', event: 'device_discovered', ts: 1 });
    device.emit('bthome_event', { component: 'bthome', event: 'discovery_done', ts: 2 });
    device.emit('bthome_event', { component: 'bthome', event: 'associations_done', ts: 3 });
    expect(platform.changedDevices.get(device.id)).toBe(device.id);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('observer home event message'));

    loggerLogSpy.mockClear();
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'ota_begin', ts: 4 });
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'ota_progress', ts: 5 });
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'ota_success', ts: 6 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('observer device event message'));

    const fetchUpdateSpy = vi.spyOn(device, 'fetchUpdate').mockResolvedValue(null);
    const updateBTHomeComponentsSpy = vi.spyOn(device, 'updateBTHomeComponents').mockImplementation(() => {});
    const saveDevicePayloadsSpy = vi.spyOn(device, 'saveDevicePayloads').mockResolvedValue(true);
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'config_changed', ts: 7 });
    await wait(0);
    expect(fetchUpdateSpy).toHaveBeenCalled();
    expect(updateBTHomeComponentsSpy).toHaveBeenCalled();
    expect(saveDevicePayloadsSpy).toHaveBeenCalled();

    fetchUpdateSpy.mockRejectedValue(new Error('Test update failure'));
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'config_changed', ts: 8 });
    await wait(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('failed to fetch update'));

    const triggerSwitchEventSpy = vi.spyOn(MatterbridgeEndpoint.prototype, 'triggerSwitchEvent').mockResolvedValue(true);
    const getChildEndpointSpy = vi.spyOn(blu, 'getChildEndpointById').mockReturnValue(blu);
    for (const model of ['Shelly BLU RC Button 4', 'Shelly BLU Wall Switch 4', 'Shelly BLU Button1', 'Shelly BLU HT']) {
      bthomeDevice.model = model;
      device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'single_push', ts: 9, idx: 0 });
    }
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'double_push', ts: 9, idx: 0 });
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'long_push', ts: 10, idx: 0 });
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Single', blu.log);
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Double', blu.log);
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Long', blu.log);

    getChildEndpointSpy.mockImplementation(() => {});
    bthomeDevice.model = 'Shelly BLU RC Button 4';
    device.emit('bthomedevice_event', htAddress, { component: 'bthomedevice:201', event: 'single_push', ts: 11, idx: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('child endpoint for button not found'));

    device.emit('bthomedevice_event', '00:00:00:00:00:00', { component: 'bthomedevice:999', event: 'ota_begin', ts: 12 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('sent an unknown BLU device address'));

    bthomeDevice.model = 'Shelly BLU HT';
    getChildEndpointSpy.mockRestore();
    triggerSwitchEventSpy.mockRestore();
  });

  test('should handle all BTHome sensor button events', () => {
    const htAddress = '7c:c6:b6:65:2d:87';
    const bthomeDevice = device.bthomeDevices.get(htAddress);
    const blu = platform.bluBridgedDevices.get(htAddress);
    expect(bthomeDevice).toBeDefined();
    expect(blu).toBeDefined();
    if (!bthomeDevice || !blu) return;

    const triggerSwitchEventSpy = vi.spyOn(MatterbridgeEndpoint.prototype, 'triggerSwitchEvent').mockResolvedValue(true);
    const getChildEndpointSpy = vi.spyOn(blu, 'getChildEndpointById').mockReturnValue(blu);
    for (const model of ['Shelly BLU RC Button 4', 'Shelly BLU Wall Switch 4', 'Shelly BLU Button1', 'Shelly BLU HT']) {
      bthomeDevice.model = model;
      device.emit('bthomesensor_event', htAddress, 'Button', 0, { component: 'bthomesensor:206', event: 'single_push', ts: 13 });
    }
    device.emit('bthomesensor_event', htAddress, 'Button', 0, { component: 'bthomesensor:206', event: 'double_push', ts: 14 });
    device.emit('bthomesensor_event', htAddress, 'Button', 0, { component: 'bthomesensor:206', event: 'long_push', ts: 15 });
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Single', blu.log);
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Double', blu.log);
    expect(triggerSwitchEventSpy).toHaveBeenCalledWith('Long', blu.log);

    getChildEndpointSpy.mockImplementation(() => {});
    bthomeDevice.model = 'Shelly BLU Wall Switch 4';
    loggerLogSpy.mockClear();
    device.emit('bthomesensor_event', htAddress, 'Button', 0, { component: 'bthomesensor:206', event: 'single_push', ts: 16 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('child endpoint for button not found'));

    device.emit('bthomesensor_event', '00:00:00:00:00:00', 'Button', 0, { component: 'bthomesensor:999', event: 'single_push', ts: 17 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('sent an unknown BLU device address'));

    bthomeDevice.model = 'Shelly BLU HT';
    getChildEndpointSpy.mockRestore();
    triggerSwitchEventSpy.mockRestore();
  });
});
