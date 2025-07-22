// src/index.test.ts

const NAME = 'Index';
const HOMEDIR = path.join('jest', NAME);

import { rmSync } from 'node:fs';
import path from 'node:path';

import { Matterbridge, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { jest } from '@jest/globals';
import { wait } from 'matterbridge/utils';

import { ShellyPlatform } from './platform.js';
import initializePlugin from './index.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logs

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the test environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('initializePlugin', () => {
  let platform: ShellyPlatform;

  const mockLog = {
    fatal: jest.fn((message: string, ...parameters: any[]) => {}),
    error: jest.fn((message: string, ...parameters: any[]) => {}),
    warn: jest.fn((message: string, ...parameters: any[]) => {}),
    notice: jest.fn((message: string, ...parameters: any[]) => {}),
    info: jest.fn((message: string, ...parameters: any[]) => {}),
    debug: jest.fn((message: string, ...parameters: any[]) => {}),
  } as unknown as AnsiLogger;

  const mockMatterbridge = {
    matterbridgeDirectory: HOMEDIR + '/.matterbridge',
    matterbridgePluginDirectory: HOMEDIR + '/Matterbridge',
    systemInformation: { ipv4Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
    matterbridgeVersion: '3.1.6',
    log: mockLog,
    getDevices: jest.fn(() => []),
    getPlugins: jest.fn(() => []),
    plugins: { get: jest.fn((pluginName: string) => undefined) },
    addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
    removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {}),
  } as unknown as Matterbridge;

  const mockConfig = {
    name: 'matterbridge-shelly',
    type: 'DynamicPlatform',
    version: '1.1.2',
    username: 'admin',
    password: 'tango',
    exposeSwitch: 'outlet',
    exposeInput: 'contact',
    exposeInputEvent: 'momentary',
    exposePowerMeter: 'matter13',
    blackList: [],
    whiteList: [],
    enableMdnsDiscover: false,
    enableStorageDiscover: false,
    resetStorageDiscover: false,
    enableConfigDiscover: false,
    enableBleDiscover: false,
    deviceIp: {},
    debug: false,
    unregisterOnShutdown: false,
  } as PlatformConfig;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
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
    await wait(1000);
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('Shutting down platform'));
    expect(mockLog.error).toHaveBeenCalledWith('NodeStorage is not initialized');
    (platform as any).shelly.destroy();
  });
});
