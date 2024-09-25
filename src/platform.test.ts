/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Matterbridge, MatterbridgeDevice, PlatformConfig } from 'matterbridge';
import { AnsiLogger, db, er, hk, idn, LogLevel, nf, rs, zb } from 'matterbridge/logger';
import { isValidArray, isValidBoolean, isValidNull, isValidNumber, isValidObject, isValidString, isValidUndefined, wait } from 'matterbridge/utils';
import { jest } from '@jest/globals';

import { ShellyPlatform } from './platform';

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

  beforeAll(() => {
    // Creates the mocks for Matterbridge, AnsiLogger, and PlatformConfig
    mockMatterbridge = {
      matterbridgeDirectory: 'temp',
      matterbridgePluginDirectory: 'temp',
      systemInformation: { ipv4Address: undefined },
      matterbridgeVersion: '1.5.5',
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
      'enableBleDiscover': false,
      'deviceIp': {},
      'debug': false,
      'unregisterOnShutdown': false,
    } as PlatformConfig;

    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
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

  it('should initialize platform with config name', () => {
    shellyPlatform = new ShellyPlatform(mockMatterbridge, mockLog, mockConfig);
    expect(mockLog.debug).toHaveBeenCalledWith(`Initializing platform: ${idn}${mockConfig.name}${rs}${db}`);
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

  it('should validate version', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.4';
    expect(shellyPlatform.localVerifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.localVerifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.localVerifyMatterbridgeVersion('2.0.0')).toBe(false);
  });

  it('should validate version beta', () => {
    mockMatterbridge.matterbridgeVersion = '1.5.4-dev.1';
    expect(shellyPlatform.localVerifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.localVerifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.localVerifyMatterbridgeVersion('2.0.0')).toBe(false);
    mockMatterbridge.matterbridgeVersion = '1.5.5';
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
  });

  it('should call onStart with reason and reset the storage', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);
    shellyPlatform.config.enableStorageDiscover = false;
    shellyPlatform.config.enableConfigDiscover = false;
    shellyPlatform.config.resetStorageDiscover = true;
    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Resetting the Shellies storage`);
    expect(mockLog.info).toHaveBeenCalledWith(`Reset the Shellies storage`);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shellyPlatform as any).storedDevices.size).toBe(0);
    shellyPlatform.config.resetStorageDiscover = false;
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
    expect(mockLog.debug).toHaveBeenCalledWith(`Saving 2 discovered Shelly devices to the storage`);
    expect((shellyPlatform as any).storedDevices.size).toBe(2);

    await shellyPlatform.onStart('Test reason');

    console.error((shellyPlatform as any).storedDevices);

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
  });

  it('should call onStart with reason and load from configDiscover', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    shellyPlatform.config.enableConfigDiscover = true;
    shellyPlatform.config.deviceIp = {
      'shellyemg3-84FCE636582C': 'invalid',
    };
    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.info).toHaveBeenCalledWith(`Loading from config 1 Shelly devices`);
    expect(mockLog.error).toHaveBeenCalledWith(
      `Config Shelly device id ${hk}shellyemg3-84FCE636582C${er} host ${zb}invalid${er} is not valid. Please check the plugin config and restart.`,
    );
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect(shellyPlatform.storedDevices.size).toBe(0);

    shellyPlatform.storedDevices.clear();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(0);

    shellyPlatform.config.enableConfigDiscover = false;
    shellyPlatform.config.deviceIp = undefined;
  });

  it('should load and save the stored devices', async () => {
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    const originalSize = (shellyPlatform as any).storedDevices.size;
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    const size = (shellyPlatform as any).storedDevices.size;
    expect(size).toBe(originalSize);
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
  }, 60000);

  it('should call onShutdown with reason and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await shellyPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockMatterbridge.removeAllBridgedDevices).toHaveBeenCalled();
    await wait(1000);
  }, 60000);

  it('should destroy shelly', async () => {
    expect((shellyPlatform as any).shelly.mdnsScanner).toBeUndefined();
    expect((shellyPlatform as any).shelly.coapServer).toBeUndefined();
    await wait(1000);
  }, 60000);
});
