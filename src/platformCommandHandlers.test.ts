// src/platformCommandHandler.test.ts

const NAME = 'PlatformCommandHandler';
const MATTER_PORT = 6200;

import { jest } from '@jest/globals';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  loggerLogSpy,
  matterbridge,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { CYAN, db, idn, LogLevel, nf, rs } from 'matterbridge/logger';

import { CoapServer } from './coapServer.js';
import { MdnsScanner } from './mdnsScanner.js';
import { ShellyPlatform, ShellyPlatformConfig } from './platform.js';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { WsClient } from './wsClient.js';
import { WsServer } from './wsServer.js';

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
  let shellyPlatform: ShellyPlatform;
  let shelly: Shelly;

  const address = 'c4:cb:76:b3:cd:1f';

  const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
  const coapServerStopSpy = jest.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
  const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async (host: string, id: string, registerOnly: boolean) => {});
  const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
  const wsServerStopSpy = jest.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
  const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
  const wsClientStopSpy = jest.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
  const mdnsScannerStartSpy = jest.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
  const mdnsScannerStopSpy = jest.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});

  const cleanup = () => {
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
    await createMatterbridgeEnvironment();
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear the debug
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should initialize platform with config name and version', () => {
    shellyPlatform = new ShellyPlatform(matterbridge, log, mockConfig as any);
    addMatterbridgePlatform(shellyPlatform, 'matterbridge-shelly');
    shelly = (shellyPlatform as any).shelly;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shelly as any).fetchInterval);
    shellyPlatform.config.entityBlackList = []; // First run turn off entity black list
  });

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
  });
});
