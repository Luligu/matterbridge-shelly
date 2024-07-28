/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Matterbridge, MatterbridgeDevice, PlatformConfig } from 'matterbridge';
import { AnsiLogger, db, idn, LogLevel, nf, rs } from 'matterbridge/logger';
import { ShellyPlatform } from './platform';
import { jest } from '@jest/globals';

describe('TestPlatform', () => {
  let mockMatterbridge: Matterbridge;
  let mockLog: AnsiLogger;
  let mockConfig: PlatformConfig;
  let shellyPlatform: ShellyPlatform;

  // const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  // Mock the AnsiLogger.log method
  jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
    // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
  });
  jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
    // console.log(`Mocked debug: ${message}`, ...parameters);
  });
  jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
    // console.log(`Mocked info: ${message}`, ...parameters);
  });
  jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
    // console.log(`Mocked warn: ${message}`, ...parameters);
  });
  jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
    // console.log(`Mocked error: ${message}`, ...parameters);
  });
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

  beforeEach(() => {
    // Creates the mocks for Matterbridge, AnsiLogger, and PlatformConfig
    mockMatterbridge = { addBridgedDevice: jest.fn(), matterbridgeDirectory: '', removeAllBridgedDevices: jest.fn() } as unknown as Matterbridge;
    mockLog = { fatal: jest.fn(), error: jest.fn(), warn: jest.fn(), notice: jest.fn(), info: jest.fn(), debug: jest.fn() } as unknown as AnsiLogger;
    mockConfig = {
      'name': 'matterbridge-test',
      'type': 'DynamicPlatform',
      'debug': false,
      'unregisterOnShutdown': false,
    } as PlatformConfig;

    shellyPlatform = new ShellyPlatform(mockMatterbridge, mockLog, mockConfig);

    // Clears the call history of mockLog.info before each test
    (mockLog.error as jest.Mock).mockClear();
    (mockLog.warn as jest.Mock).mockClear();
    (mockLog.info as jest.Mock).mockClear();
    (mockLog.debug as jest.Mock).mockClear();
  });

  afterEach(() => {
    (shellyPlatform as any).shelly.destroy();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  it('should initialize platform with config name', () => {
    shellyPlatform = new ShellyPlatform(mockMatterbridge, mockLog, mockConfig);
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Initializing platform: ${idn}${mockConfig.name}${rs}${nf}`]);
  });
*/

  it('should call onStart with reason', async () => {
    await shellyPlatform.onStart('Test reason');
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`]);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
  });

  it('should load and save the stored devices', async () => {
    await shellyPlatform.onStart('Test reason');
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`]);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();

    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    const originalSize = (shellyPlatform as any).storedDevices.size;
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    const size = (shellyPlatform as any).storedDevices.size;
    expect(size).toBe(originalSize);
  });

  it('should call onConfigure', async () => {
    await shellyPlatform.onConfigure();
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Configuring platform ${idn}${mockConfig.name}${rs}${nf}`]);
  });

  it('should call onChangeLoggerLevel', async () => {
    await shellyPlatform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect((mockLog.debug as jest.Mock).mock.calls[0]).toEqual([`Changing logger level for platform ${idn}${mockConfig.name}${rs}${db}`]);
  });

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`]);
  });

  it('should call onShutdown and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await shellyPlatform.onShutdown('Test reason');
    expect((mockLog.info as jest.Mock).mock.calls[0]).toEqual([`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`]);
    expect(mockMatterbridge.removeAllBridgedDevices).toHaveBeenCalled();
  });
});
