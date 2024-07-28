/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Matterbridge, MatterbridgeDevice, PlatformConfig } from 'matterbridge';
import { wait } from 'matterbridge/utils';
import { AnsiLogger, db, idn, LogLevel, nf, rs } from 'matterbridge/logger';
import { ShellyPlatform } from './platform';
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
    mockMatterbridge = { addBridgedDevice: jest.fn(), matterbridgeDirectory: '', removeAllBridgedDevices: jest.fn() } as unknown as Matterbridge;
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

  it('should call onChangeLoggerLevel', async () => {
    await shellyPlatform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(mockLog.debug).toHaveBeenCalledWith(`Changing logger level for platform ${idn}${mockConfig.name}${rs}${db}`);
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
