/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Matterbridge, MatterbridgeDevice, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { ShellyPlatform } from './platform.js';
import initializePlugin from './index';
import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';

describe('initializePlugin', () => {
  let platform: ShellyPlatform;

  const mockLog = {
    fatal: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.fatal', message, parameters);
    }),
    error: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.error', message, parameters);
    }),
    warn: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.warn', message, parameters);
    }),
    notice: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.notice', message, parameters);
    }),
    info: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.info', message, parameters);
    }),
    debug: jest.fn((message: string, ...parameters: any[]) => {
      console.log('mockLog.debug', message, parameters);
    }),
  } as unknown as AnsiLogger;

  const mockMatterbridge = {
    matterbridgeDirectory: './jest/matterbridge',
    matterbridgePluginDirectory: './jest/plugins',
    systemInformation: { ipv4Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
    matterbridgeVersion: '1.7.3',
    edge: false,
    log: mockLog,
    getDevices: jest.fn(() => {
      // console.log('getDevices called');
      return [];
    }),
    getPlugins: jest.fn(() => {
      // console.log('getPlugins called');
      return [];
    }),
    addBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
      // console.log('addBridgedDevice called');
    }),
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
      // console.log('addBridgedEndpoint called');
      // await aggregator.add(device);
    }),
    removeBridgedDevice: jest.fn(async (pluginName: string, device: MatterbridgeDevice) => {
      // console.log('removeBridgedDevice called');
    }),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
      // console.log('removeBridgedEndpoint called');
    }),
    removeAllBridgedDevices: jest.fn(async (pluginName: string) => {
      // console.log('removeAllBridgedDevices called');
    }),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {
      // console.log('removeAllBridgedEndpoints called');
    }),
  } as unknown as Matterbridge;

  const mockConfig = {
    'name': 'matterbridge-shelly',
    'type': 'DynamicPlatform',
    'version': '1.1.2',
    'username': 'admin',
    'password': 'tango',
    'exposeSwitch': 'outlet',
    'exposeInput': 'contact',
    'exposeInputEvent': 'momentary',
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

  const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
    console.log(`Mocked AnsiLogger.log: ${level} - ${message}`, ...parameters);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return an instance of ShellyPlatform', () => {
    platform = initializePlugin(mockMatterbridge, mockLog, mockConfig);
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(ShellyPlatform);
    expect(mockLog.error).not.toHaveBeenCalled();
  });

  it('should shutdown the instance of ShellyPlatform', async () => {
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(ShellyPlatform);
    await platform.onShutdown();
    wait(1000);
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('Shutting down platform'));
    expect(mockLog.error).toHaveBeenCalledWith('NodeStorage is not initialized');
    (platform as any).shelly.destroy();
  });
});
