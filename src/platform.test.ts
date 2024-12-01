/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BindingCluster,
  BridgedDeviceBasicInformationCluster,
  DescriptorCluster,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  ElectricalPowerMeasurementCluster,
  FixedLabelCluster,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  Matterbridge,
  MatterbridgeDevice,
  OnOffCluster,
  PlatformConfig,
  PowerSourceCluster,
  PowerTopology,
  PowerTopologyCluster,
  Switch,
  SwitchCluster,
} from 'matterbridge';
import { AnsiLogger, db, dn, er, hk, idn, LogLevel, nf, rs, wr, zb } from 'matterbridge/logger';
import { isValidArray, isValidBoolean, isValidNull, isValidNumber, isValidObject, isValidString, isValidUndefined, wait, waiter } from 'matterbridge/utils';
import { jest } from '@jest/globals';

import { ShellyPlatform } from './platform';
import { ShellyDevice } from './shellyDevice';
import path from 'path';
import { Shelly } from './shelly';
import { CYAN } from 'node-ansi-logger';

describe('ShellyPlatform', () => {
  let mockMatterbridge: Matterbridge;
  let mockLog: AnsiLogger;
  let mockConfig: PlatformConfig;
  let shellyPlatform: ShellyPlatform;

  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  jest.spyOn(Matterbridge.prototype, 'addBridgedDevice').mockImplementation((pluginName: string, device: MatterbridgeDevice) => {
    // console.log(`Mocked addBridgedDevice: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeBridgedDevice').mockImplementation((pluginName: string, device: MatterbridgeDevice) => {
    // console.log(`Mocked unregisterDevice: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeAllBridgedDevices').mockImplementation((pluginName: string) => {
    // console.log(`Mocked removeAllBridgedDevices: ${pluginName}`);
    return Promise.resolve();
  });

  const cleanup = () => {
    shellyPlatform.discoveredDevices.clear();
    shellyPlatform.storedDevices.clear();
    (shellyPlatform as any).saveStoredDevices();
    shellyPlatform.shellyDevices.forEach((device: ShellyDevice) => {
      // console.error(`Destroying shellyPlatform.shellyDevices device: ${device.id}`);
      device.destroy();
      (shellyPlatform as any).shelly.removeDevice(device);
    });
    shellyPlatform.shellyDevices.clear();
    shellyPlatform.bridgedDevices.clear();
    shellyPlatform.bluBridgedDevices.clear();
    (shellyPlatform as any).failsafeCount = 0;
    (shellyPlatform as any).whiteList = [];
    (shellyPlatform as any).blackList = [];

    const shelly = (shellyPlatform as any).shelly as Shelly;
    clearInterval((shelly as any).fetchInterval);
    clearTimeout((shelly as any).coapServerTimeout);

    shelly.devices.forEach((device: ShellyDevice) => {
      // console.error(`Destroying shelly.devices device: ${device.id}`);
      device.destroy();
      (shellyPlatform as any).shelly.removeDevice(device);
    });

    // shelly.destroy();
  };

  beforeAll(() => {
    // Creates the mocks for Matterbridge, AnsiLogger, and PlatformConfig
    mockMatterbridge = {
      matterbridgeDirectory: 'temp',
      matterbridgePluginDirectory: 'temp',
      systemInformation: { ipv4Address: undefined },
      matterbridgeVersion: '1.6.0',
      addBridgedDevice: jest.fn(),
      removeBridgedDevice: jest.fn(),
      removeAllBridgedDevices: jest.fn(),
    } as unknown as Matterbridge;
    mockLog = {
      fatal: jest.fn((message) => {
        console.log(`Fatal: ${message}`);
      }),
      error: jest.fn((message) => {
        console.log(`Error: ${message}`);
      }),
      warn: jest.fn((message) => {
        console.log(`Warn: ${message}`);
      }),
      notice: jest.fn((message) => {
        console.log(`Notice: ${message}`);
      }),
      info: jest.fn((message) => {
        console.log(`Info: ${message}`);
      }),
      debug: jest.fn((message) => {
        console.log(`Debug: ${message}`);
      }),
    } as unknown as AnsiLogger;
    mockConfig = {
      'name': 'matterbridge-shelly',
      'type': 'DynamicPlatform',
      'version': '1.0.0',
      'username': 'admin',
      'password': 'tango',
      'exposeSwitch': 'outlet',
      'exposeInput': 'contact',
      'exposePowerMeter': 'matter13',
      'blackList': [],
      'whiteList': [],
      'enableMdnsDiscover': false,
      'enableStorageDiscover': false,
      'resetStorageDiscover': false,
      'enableConfigDiscover': false,
      'enableBleDiscover': true,
      'deviceIp': {},
      'debug': false,
      'unregisterOnShutdown': false,
    } as PlatformConfig;

    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
  });

  beforeEach(() => {
    // Clears the call history of mockLog.* before each test
    (mockLog.fatal as jest.Mock).mockClear();
    (mockLog.error as jest.Mock).mockClear();
    (mockLog.warn as jest.Mock).mockClear();
    (mockLog.notice as jest.Mock).mockClear();
    (mockLog.info as jest.Mock).mockClear();
    (mockLog.debug as jest.Mock).mockClear();
    // Clears the call history before each test
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(() => {
    //
  });

  it('should initialize platform with config name and version', () => {
    shellyPlatform = new ShellyPlatform(mockMatterbridge, mockLog, mockConfig);
    expect(mockLog.debug).toHaveBeenCalledWith(`Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shellyPlatform as any).shelly.fetchInterval);
    clearTimeout((shellyPlatform as any).shelly.coapServerTimeout);
  });

  it('should validate number', () => {
    expect(isValidNumber(1222222)).toBe(true);
    expect(isValidNumber(NaN)).toBe(false);
    expect(isValidNumber(true)).toBe(false);
    expect(isValidNumber(false)).toBe(false);
    expect(isValidNumber(1212222222222222222111122222222n)).toBe(false);
    expect(isValidNumber('string')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
    expect(isValidNumber({ x: 1, y: 4 })).toBe(false);
    expect(isValidNumber([1, 4, 'string'])).toBe(false);
  });
  it('should validate number in range', () => {
    expect(isValidNumber(5, 0, 100)).toBe(true);
    expect(isValidNumber(-5, 0, 100)).toBe(false);
    expect(isValidNumber(5555, 0, 100)).toBe(false);
    expect(isValidNumber(5, -100, 100)).toBe(true);
    expect(isValidNumber(-50, -100, 100)).toBe(true);
    expect(isValidNumber(0, 0, 100)).toBe(true);
    expect(isValidNumber(100, 0, 100)).toBe(true);
    expect(isValidNumber(0, 0)).toBe(true);
    expect(isValidNumber(-1, 0)).toBe(false);
    expect(isValidNumber(123, 0)).toBe(true);
    expect(isValidNumber(100, 0, 100)).toBe(true);
  });

  it('should validate boolean', () => {
    expect(isValidBoolean(1222222)).toBe(false);
    expect(isValidBoolean(NaN)).toBe(false);
    expect(isValidBoolean(true)).toBe(true);
    expect(isValidBoolean(false)).toBe(true);
    expect(isValidBoolean(1212222222222222222111122222222n)).toBe(false);
    expect(isValidBoolean('string')).toBe(false);
    expect(isValidBoolean(null)).toBe(false);
    expect(isValidBoolean(undefined)).toBe(false);
    expect(isValidBoolean({ x: 1, y: 4 })).toBe(false);
    expect(isValidBoolean([1, 4, 'string'])).toBe(false);
  });

  it('should validate string', () => {
    expect(isValidString(1222222)).toBe(false);
    expect(isValidString(NaN)).toBe(false);
    expect(isValidString(true)).toBe(false);
    expect(isValidString(false)).toBe(false);
    expect(isValidString(1212222222222222222111122222222n)).toBe(false);
    expect(isValidString('string')).toBe(true);
    expect(isValidString('string', 1, 20)).toBe(true);
    expect(isValidString('string', 0)).toBe(true);
    expect(isValidString('string', 10)).toBe(false);
    expect(isValidString('', 1)).toBe(false);
    expect(isValidString('1234', 1, 3)).toBe(false);
    expect(isValidString(null)).toBe(false);
    expect(isValidString(undefined)).toBe(false);
    expect(isValidString({ x: 1, y: 4 })).toBe(false);
    expect(isValidString([1, 4, 'string'])).toBe(false);
  });

  it('should validate object', () => {
    expect(isValidObject(1222222)).toBe(false);
    expect(isValidObject(NaN)).toBe(false);
    expect(isValidObject(true)).toBe(false);
    expect(isValidObject(false)).toBe(false);
    expect(isValidObject(1212222222222222222111122222222n)).toBe(false);
    expect(isValidObject('string')).toBe(false);
    expect(isValidObject(null)).toBe(false);
    expect(isValidObject(undefined)).toBe(false);
    expect(isValidObject({ x: 1, y: 4 })).toBe(true);
    expect(isValidObject([1, 4, 'string'])).toBe(false);

    expect(isValidObject({ x: 1, y: 4 }, 1, 2)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 2, 2)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 2, 3)).toBe(true);
    expect(isValidObject({ x: 1, y: 4 }, 3, 3)).toBe(false);
    expect(isValidObject({ x: 1, y: 4 }, 1, 1)).toBe(false);
  });

  it('should validate array', () => {
    expect(isValidArray(1222222)).toBe(false);
    expect(isValidArray(NaN)).toBe(false);
    expect(isValidArray(true)).toBe(false);
    expect(isValidArray(false)).toBe(false);
    expect(isValidArray(1212222222222222222111122222222n)).toBe(false);
    expect(isValidArray('string')).toBe(false);
    expect(isValidArray(null)).toBe(false);
    expect(isValidArray(undefined)).toBe(false);
    expect(isValidArray({ x: 1, y: 4 })).toBe(false);
    expect(isValidArray([1, 4, 'string'])).toBe(true);

    expect(isValidArray([1, 4, 'string'], 3, 3)).toBe(true);
    expect(isValidArray([1, 4, 'string'], 4, 4)).toBe(false);
    expect(isValidArray([1, 4, 'string'], 1, 2)).toBe(false);
    expect(isValidArray([1, 4, 'string'], 0, 3)).toBe(true);
  });

  it('should validate null', () => {
    expect(isValidNull(1222222)).toBe(false);
    expect(isValidNull(NaN)).toBe(false);
    expect(isValidNull(true)).toBe(false);
    expect(isValidNull(false)).toBe(false);
    expect(isValidNull(1212222222222222222111122222222n)).toBe(false);
    expect(isValidNull('string')).toBe(false);
    expect(isValidNull(null)).toBe(true);
    expect(isValidNull(undefined)).toBe(false);
    expect(isValidNull({ x: 1, y: 4 })).toBe(false);
    expect(isValidNull([1, 4, 'string'])).toBe(false);
  });

  it('should validate undefined', () => {
    expect(isValidUndefined(1222222)).toBe(false);
    expect(isValidUndefined(NaN)).toBe(false);
    expect(isValidUndefined(true)).toBe(false);
    expect(isValidUndefined(false)).toBe(false);
    expect(isValidUndefined(1212222222222222222111122222222n)).toBe(false);
    expect(isValidUndefined('string')).toBe(false);
    expect(isValidUndefined(null)).toBe(false);
    expect(isValidUndefined(undefined)).toBe(true);
    expect(isValidUndefined({ x: 1, y: 4 })).toBe(false);
    expect(isValidUndefined([1, 4, 'string'])).toBe(false);
  });

  it('should return false and log a warning if entity is not in the whitelist', () => {
    (shellyPlatform as any).whiteList = ['entity1', 'entity2'];
    (shellyPlatform as any).blackList = [];

    const result = (shellyPlatform as any).validateWhiteBlackList('entity3');

    expect(result).toBe(false);
    expect(mockLog.warn).toHaveBeenCalledWith(`Skipping ${dn}entity3${wr} because not in whitelist`);
  });

  it('should return false and log a warning if entity is in the blacklist', () => {
    (shellyPlatform as any).whiteList = [];
    (shellyPlatform as any).blackList = ['entity3'];

    const result = (shellyPlatform as any).validateWhiteBlackList('entity3');

    expect(result).toBe(false);
    expect(mockLog.warn).toHaveBeenCalledWith(`Skipping ${dn}entity3${wr} because in blacklist`);
  });

  it('should return true if entity is in the whitelist', () => {
    (shellyPlatform as any).whiteList = ['entity3'];
    (shellyPlatform as any).blackList = [];

    const result = (shellyPlatform as any).validateWhiteBlackList('entity3');

    expect(result).toBe(true);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('should return true if entity is not in the blacklist and whitelist is empty', () => {
    (shellyPlatform as any).whiteList = [];
    (shellyPlatform as any).blackList = [];

    const result = (shellyPlatform as any).validateWhiteBlackList('entity3');

    expect(result).toBe(true);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('should return true if both whitelist and blacklist are empty', () => {
    (shellyPlatform as any).whiteList = [];
    (shellyPlatform as any).blackList = [];

    const result = (shellyPlatform as any).validateWhiteBlackList('entity3');

    expect(result).toBe(true);
    expect(mockLog.warn).not.toHaveBeenCalled();
  });

  it('should validate version', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.4';
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
  });

  it('should validate version beta', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.4-dev.1';
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
    mockMatterbridge.matterbridgeVersion = '1.5.5';
  });

  it('should throw because of version', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.4';
    expect(() => new ShellyPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow();
    mockMatterbridge.matterbridgeVersion = '1.6.0';
  });

  it('should call onStart with reason and start mDNS', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = true;

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Started mDNS query service for shelly devices.');
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(true);
    expect((shellyPlatform as any).shelly.coapServer).toBeDefined();
    expect((shellyPlatform as any).shelly.coapServer.isListening).toBe(false);
    shellyPlatform.config.enableMdnsDiscover = false;
    (shellyPlatform as any).shelly.mdnsScanner?.stop();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    cleanup();
  });

  it('should call onStart with reason and reset the storage', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);
    shellyPlatform.config.enableStorageDiscover = false;
    shellyPlatform.config.enableConfigDiscover = false;
    shellyPlatform.config.resetStorageDiscover = true;
    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Resetting the Shellies storage...`);
    expect(mockLog.info).toHaveBeenCalledWith(`Reset of Shellies storage done!`);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shellyPlatform as any).storedDevices.size).toBe(0);
    shellyPlatform.config.resetStorageDiscover = false;

    cleanup();
  });

  it('should call onStart with reason and load from storageDiscover', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    shellyPlatform.config.enableStorageDiscover = true;
    shellyPlatform.config.enableConfigDiscover = false;
    shellyPlatform.storedDevices.clear();
    shellyPlatform.storedDevices.set('shellyemg3-84FCE636582C', { id: 'shellyemg3-84FCE636582C', host: 'invalid', port: 80, gen: 1 });
    shellyPlatform.storedDevices.set('shellyplus-34FCE636582C', { id: 'shellyplus-34FCE636582C', host: '192.168.255.1', port: 80, gen: 2 });
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect(mockLog.debug).toHaveBeenCalledWith(`Saving ${CYAN}2${db} discovered Shelly devices to the storage`);
    expect((shellyPlatform as any).storedDevices.size).toBe(2);

    await shellyPlatform.onStart('Test reason');

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Loading from storage 2 Shelly devices`);
    expect(mockLog.error).toHaveBeenCalledWith(
      `Stored Shelly device id ${hk}shellyemg3-84FCE636582C${er} host ${zb}invalid${er} is not valid. Please enable resetStorageDiscover in plugin config and restart.`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Loading from storage Shelly device ${hk}shellyplus-34FCE636582C${db} host ${zb}192.168.255.1${db}`);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect(shellyPlatform.storedDevices.size).toBe(2);

    shellyPlatform.storedDevices.clear();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect(shellyPlatform.storedDevices.size).toBe(0);

    shellyPlatform.config.enableStorageDiscover = false;

    cleanup();
  });

  it('should call onStart with reason and load from configDiscover', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    shellyPlatform.config.enableConfigDiscover = true;
    shellyPlatform.config.deviceIp = {
      'shellyemg3-84FCE636582C': 'invalid',
      'shellyplus-34FCE636582C': '192.168.255.1',
    };
    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Loading from config 2 Shelly devices`);
    expect(mockLog.error).toHaveBeenCalledWith(
      `Config Shelly device id ${hk}shellyemg3-84FCE636582C${er} host ${zb}invalid${er} is not valid. Please check the plugin config and restart.`,
    );
    expect(mockLog.debug).toHaveBeenCalledWith(`Loading from config Shelly device ${hk}shellyplus-34FCE636582C${db} host ${zb}192.168.255.1${db}`);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect(shellyPlatform.storedDevices.size).toBe(1);

    shellyPlatform.storedDevices.clear();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(0);

    shellyPlatform.config.enableConfigDiscover = false;
    shellyPlatform.config.deviceIp = undefined;

    cleanup();
  });

  it('should call onStart with reason and check failsafeCount', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    (shellyPlatform as any).failsafeCount = 1;
    shellyPlatform.bridgedDevices.set('shellyemg3-84FCE636582C', { id: 'shellyemg3-84FCE636582C', host: 'invalid', port: 80, gen: 1 } as unknown as MatterbridgeDevice);

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.notice).toHaveBeenCalledWith(`Waiting for the configured number of 1 devices to be loaded.`);
    (shellyPlatform as any).failsafeCount = 0;
    shellyPlatform.bridgedDevices.clear();

    cleanup();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /* too too long 55 secs
  it('should call onStart with reason and check failsafeCount and throw', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    (shellyPlatform as any).failsafeCount = 1;
    shellyPlatform.shellyDevices.clear();
    shellyPlatform.bluBridgedDevices.clear();

    await expect(shellyPlatform.onStart('Test reason')).rejects.toThrow();

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.notice).toHaveBeenCalledWith(`Waiting for the configured number of 1 devices to be loaded.`);

    cleanup();
  }, 60000);
  */

  it('should call onStart with reason and add discovered devices', async () => {
    expect(shellyPlatform).toBeDefined();

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    (shellyPlatform as any).shelly.emit('discovered', { id: 'shelly1l-E8DB84AAD781', host: '192.168.1.241', port: 80, gen: 1 });
    await wait(1000);
    expect((shellyPlatform as any).discoveredDevices.size).toBe(1);
    expect((shellyPlatform as any).shellyDevices.size).toBe(1);

    cleanup();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).discoveredDevices.size).toBe(0);
    expect((shellyPlatform as any).storedDevices.size).toBe(0);
    expect((shellyPlatform as any).shellyDevices.size).toBe(0);
    expect((shellyPlatform as any).bridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).bluBridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);
  });

  it('should call onStart with reason and add shelly1', async () => {
    expect(shellyPlatform).toBeDefined();

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shelly1 = await ShellyDevice.create((shellyPlatform as any).shelly, (shellyPlatform as any).log, path.join('src', 'mock', 'shelly1-34945472A643.json'));
    expect(shelly1).not.toBeUndefined();
    if (!shelly1) return;

    // consoleLogSpy.mockRestore();
    await (shellyPlatform as any).shelly.addDevice(shelly1);
    shellyPlatform.shellyDevices.set(shelly1.id, shelly1);
    await wait(1000);
    expect(mockLog.info).toHaveBeenCalledWith(`Shelly added ${idn}${shelly1.name}${rs} device id ${hk}${shelly1.id}${rs}${nf} host ${zb}${shelly1.host}${nf}`);
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shellyPlatform.shellyDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shelly1-34945472A643')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shelly1-34945472A643');
    expect(device).toBeDefined();
    if (!device) return;

    expect(device.getAllClusterServers()).toHaveLength(3);
    expect(device.getClusterServer(DescriptorCluster)).toBeDefined();
    expect(device.getClusterServer(BridgedDeviceBasicInformationCluster)).toBeDefined();
    expect(device.getClusterServer(FixedLabelCluster)).toBeDefined();
    expect(device.getChildEndpoints()).toHaveLength(4);
    expect(device.getChildEndpointByName('PowerSource')).toBeDefined();
    expect(device.getChildEndpointByName('PowerSource')?.getAllClusterServers()).toHaveLength(2);
    expect(device.getChildEndpointByName('PowerSource')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('PowerSource')?.hasClusterServer(PowerSourceCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')).toBeDefined();
    expect(device.getChildEndpointByName('relay:0')?.getAllClusterServers()).toHaveLength(5);
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(BindingCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(GroupsCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(OnOffCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')).toBeDefined();
    expect(device.getChildEndpointByName('meter:0')?.getAllClusterServers()).toHaveLength(4);
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(PowerTopology.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(ElectricalPowerMeasurement.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(ElectricalEnergyMeasurement.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')).toBeDefined();
    expect(device.getChildEndpointByName('input:0')?.getAllClusterServers()).toHaveLength(4);
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(BindingCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(Switch.Complete)).toBeTruthy();

    cleanup();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shellyPlatform.shellyDevices.size).toBe(0);
    expect(shellyPlatform.bridgedDevices.size).toBe(0);
    expect(shellyPlatform.bluBridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);

    shelly1?.destroy();
  });

  it('should load and save the stored devices', async () => {
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    const originalSize = (shellyPlatform as any).storedDevices.size;
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    const size = (shellyPlatform as any).storedDevices.size;
    expect(size).toBe(originalSize);
  });

  it('should handle Shelly discovered event', async () => {
    shellyPlatform.discoveredDevices.clear();
    shellyPlatform.storedDevices.clear();
    (shellyPlatform as any).shelly.emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);
  });

  it('should not add already discoverd Shelly', async () => {
    (shellyPlatform as any).shelly.emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);
    expect(mockLog.info).toHaveBeenCalledWith(`Shelly device ${hk}shelly1-84FCE1234${nf} host ${zb}invalid${nf} already discovered`);
  });

  it('should not add already discoverd Shelly with different host', async () => {
    (shellyPlatform as any).shelly.emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid new host', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);
    expect(mockLog.warn).toHaveBeenCalledWith(`Shelly device ${hk}shelly1-84FCE1234${wr} host ${zb}invalid new host${wr} has been discovered with a different host.`);
    cleanup();
  });

  it('should call onConfigure', async () => {
    await shellyPlatform.onConfigure();
    expect(mockLog.info).toHaveBeenCalledWith(`Configuring platform ${idn}${mockConfig.name}${rs}${nf}`);
  });

  it('should call onChangeLoggerLevel and log a partial message', async () => {
    await shellyPlatform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(mockLog.debug).toHaveBeenCalledWith(expect.stringContaining(`Changing logger level for platform ${idn}${mockConfig.name}${rs}`));
  });

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockMatterbridge.removeAllBridgedDevices).not.toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Stopped mDNS query service.');
    await wait(1000);
  });

  it('should call onShutdown with reason and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await shellyPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockMatterbridge.removeAllBridgedDevices).toHaveBeenCalled();
    await wait(1000);
  });

  it('should destroy shelly', async () => {
    (shellyPlatform as any).shelly.destroy();
    expect((shellyPlatform as any).shelly.mdnsScanner).toBeUndefined();
    expect((shellyPlatform as any).shelly.coapServer).toBeUndefined();
    expect((shellyPlatform as any).shelly.fetchInterval).toBeUndefined();
    expect((shellyPlatform as any).shelly.coapServerTimeout).toBeUndefined();
    await wait(10000);
  }, 60000);
});
