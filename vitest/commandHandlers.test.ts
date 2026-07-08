/**
 * @file vitest/commandHandlers.test.ts
 * @description This file contains the tests for the ShellyPlatform command handlers.
 * @author Luca Liguori
 */

const NAME = 'PlatformCommandHandler';
const MATTER_PORT = 6200;
const MATTER_CREATE_ONLY = false;

import path from 'node:path';

import { MatterbridgeEndpoint, onOffLight, type PlatformMatterbridge } from 'matterbridge';
import { CYAN, db, hk, idn, LogLevel, nf, rs } from 'matterbridge/logger';
import { log, loggerLogSpy, setDebug, setupTest } from 'matterbridge/vitest-utils';
import {
  addMatterbridge,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMatterbridge,
  startServerNode,
  stopServerNode,
} from 'matterbridge/vitest-utils/matter';

import { CoapServer } from '../src/coapServer.js';
import { shellyCoverCommandHandler, shellyLightCommandHandler, shellySwitchCommandHandler } from '../src/commandHandlers.js';
import { MdnsScanner } from '../src/mdnsScanner.js';
import { ShellyPlatform, type ShellyPlatformConfig } from '../src/module.js';
import type { Shelly } from '../src/shelly.js';
import { isCoverComponent, isLightComponent, isSwitchComponent } from '../src/shellyComponent.js';
import { ShellyDevice } from '../src/shellyDevice.js';
import { WsClient } from '../src/wsClient.js';
import { WsServer } from '../src/wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

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
  debugMdns: true,
  debugCoap: true,
  debugWs: true,
  unregisterOnShutdown: false,
};

describe('ShellyPlatform', () => {
  let matterbridge: PlatformMatterbridge;
  let shellyPlatform: ShellyPlatform;
  let shelly: Shelly;

  const address = 'c4:cb:76:b3:cd:1f';

  const coapServerStartSpy = vi.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
  const coapServerStopSpy = vi.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
  const coapServerRegisterDeviceSpy = vi.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async (host: string, id: string, registerOnly: boolean) => {});
  const wsServerStartSpy = vi.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
  const wsServerStopSpy = vi.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
  const wsClientStartSpy = vi.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
  const wsClientStopSpy = vi.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
  const mdnsScannerStartSpy = vi.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
  const mdnsScannerStopSpy = vi.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});

  const cleanup = (): void => {
    // Clean up the platform
    shellyPlatform.discoveredDevices.clear();
    shellyPlatform.storedDevices.clear();
    shellyPlatform.changedDevices.clear();
    shellyPlatform.gatewayDevices.clear();
    shellyPlatform.bridgedDevices.clear();
    shellyPlatform.bluBridgedDevices.clear();
    (shellyPlatform as any).saveStoredDevices();
    (shellyPlatform as any).failsafeCount = 0;

    // Clean up the shelly instance
    shelly.devices.forEach((device: ShellyDevice) => {
      shelly.removeDevice(device);
      device.destroy();
    });
    (shelly as any)._devices.clear();
    clearInterval((shelly as any).fetchInterval);
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createTestEnvironment();
    await createServerNode(MATTER_PORT);
    if (!MATTER_CREATE_ONLY) await startServerNode();
    matterbridge = getMatterbridge();
  });

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clear the debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should initialize platform with config name and version', () => {
    shellyPlatform = new ShellyPlatform(matterbridge, log, mockConfig);
    addMatterbridge(shellyPlatform);
    shelly = (shellyPlatform as any).shelly;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shelly as any).fetchInterval);
    shellyPlatform.config.entityBlackList = []; // First run turn off entity black list
  });

  it('should send an unrecognized command to a switch component without invoking On/Off/Toggle', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly1-34945472A643.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    const component = device.getComponent('relay:0');
    expect(component).toBeDefined();
    if (!component || !isSwitchComponent(component)) return;

    const endpoint = new MatterbridgeEndpoint(onOffLight, { id: 'CommandHandlerSwitchTest' }).createDefaultIdentifyClusterServer();

    loggerLogSpy.mockClear();
    shellySwitchCommandHandler(endpoint, component, 'InvalidCommand');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}InvalidCommand()${db} to shelly device ${idn}${device.id}${rs}${db}`,
    );

    device.destroy();
  });

  it('should apply the SHBDUO-1 color temperature range for a gen 1 light component', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellybulbduo-34945479CFA4.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    expect(device.model).toBe('SHBDUO-1');
    expect(device.gen).toBe(1);
    const component = device.getComponent('light:0');
    expect(component).toBeDefined();
    if (!component || !isLightComponent(component)) return;

    const endpoint = new MatterbridgeEndpoint(onOffLight, { id: 'CommandHandlerLightTest' }).createDefaultIdentifyClusterServer();

    loggerLogSpy.mockClear();
    shellyLightCommandHandler(endpoint, component, 'ColorTemp', undefined, undefined, 300);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`ColorTemp(for model ${device.model} range 2700-6500`));

    device.destroy();
  });

  it('should send an unrecognized command to a cover component without invoking any action', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(device).not.toBeUndefined();
    if (!device) return;
    const component = device.getComponent('cover:0');
    expect(component).toBeDefined();
    if (!component || !isCoverComponent(component)) return;

    const endpoint = new MatterbridgeEndpoint(onOffLight, { id: 'CommandHandlerCoverTest' }).createDefaultIdentifyClusterServer();

    loggerLogSpy.mockClear();
    shellyCoverCommandHandler(endpoint, component, 'InvalidCommand');
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Sent command'));

    device.destroy();
  });

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
  });
});
