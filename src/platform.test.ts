/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Matterbridge, MatterbridgeDevice, PlatformConfig } from 'matterbridge';
import { wait } from 'matterbridge/utils';
import { AnsiLogger, db, idn, LogLevel, nf, rs } from 'matterbridge/logger';
import { ShellyPlatform } from './platform';
import { isValidArray, isValidBoolean, isValidNull, isValidNumber, isValidObject, isValidString, isValidUndefined } from 'matterbridge/utils';
import { jest } from '@jest/globals';

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
      addBridgedDevice: jest.fn(),
      matterbridgeDirectory: '',
      matterbridgePluginDirectory: 'temp',
      systemInformation: { ipv4Address: undefined },
      matterbridgeVersion: '1.5.4',
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
      'enableMdnsDiscover': true,
      'enableStorageDiscover': true,
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
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);

    mockMatterbridge.matterbridgeVersion = '1.5.4-dev.1';
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
  });

  it('should call onStart with reason', async () => {
    expect(shellyPlatform).toBeDefined();
    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Started mDNS query service for shelly devices.');
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(true);
    expect((shellyPlatform as any).shelly.coapServer).toBeDefined();
    expect((shellyPlatform as any).shelly.coapServer.isListening).toBe(false);
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

  it('should call onShutdown and unregister', async () => {
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
