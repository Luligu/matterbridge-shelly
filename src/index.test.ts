/* eslint-disable @typescript-eslint/no-unused-vars */
import { Matterbridge, MatterbridgeDevice, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { ShellyPlatform } from './platform.js';
import initializePlugin from './index';
import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';

describe('initializePlugin', () => {
  let mockMatterbridge: Matterbridge;
  let mockLog: AnsiLogger;
  let mockConfig: PlatformConfig;
  let platform: ShellyPlatform;

  beforeEach(() => {
    mockMatterbridge = {
      matterbridgeDirectory: './jest/matterbridge',
      matterbridgePluginDirectory: './jest/plugins',
      systemInformation: { ipv4Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
      matterbridgeVersion: '1.7.1',
      edge: false,
      log: mockLog,
      getDevices: jest.fn(() => {
        // console.log('getDevices called');
        return [];
      }),
      getPlugins: jest.fn(() => {
        // console.log('getDevices called');
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
    mockLog = { fatal: jest.fn(), error: jest.fn(), warn: jest.fn(), notice: jest.fn(), info: jest.fn(), debug: jest.fn() } as unknown as AnsiLogger;
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
  });

  it('should return an instance of ShellyPlatform', () => {
    platform = initializePlugin(mockMatterbridge, mockLog, mockConfig);
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(ShellyPlatform);
  });

  it('should shutdown the instance of ShellyPlatform', async () => {
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(ShellyPlatform);
    await platform.onShutdown();
    wait(1000);
  });
});
