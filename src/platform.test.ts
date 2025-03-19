/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Matterbridge, MatterbridgeBehavior, MatterbridgeEndpoint, PlatformConfig } from 'matterbridge';
import {
  OnOffCluster,
  BindingCluster,
  BridgedDeviceBasicInformationCluster,
  DescriptorCluster,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  FixedLabelCluster,
  GroupsCluster,
  IdentifyCluster,
  PowerSourceCluster,
  PowerTopology,
  Switch,
} from 'matterbridge/matter/clusters';
import { AnsiLogger, db, er, hk, idn, LogLevel, nf, rs, wr, zb, CYAN } from 'matterbridge/logger';
import { getMacAddress, isValidArray, isValidBoolean, isValidNull, isValidNumber, isValidObject, isValidString, isValidUndefined, wait } from 'matterbridge/utils';
import { jest } from '@jest/globals';

import { Shelly } from './shelly';
import { ShellyPlatform, ShellyPlatformConfig } from './platform';
import { ShellyDevice } from './shellyDevice';
import path from 'node:path';
import { CoapServer } from './coapServer';
import { WsServer } from './wsServer';

const address = 'c4:cb:76:b3:cd:1f';

describe('ShellyPlatform', () => {
  let mockMatterbridge: Matterbridge;
  let mockLog: AnsiLogger;
  let mockConfig: PlatformConfig;
  let shellyPlatform: ShellyPlatform;

  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    // console.log(`Mocked addBridgedDevice: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    // console.log(`Mocked unregisterDevice: ${pluginName} ${device.name}`);
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints').mockImplementation((pluginName: string) => {
    // console.log(`Mocked removeAllBridgedDevices: ${pluginName}`);
    return Promise.resolve();
  });

  jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {
    return;
  });

  jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  const cleanup = () => {
    shellyPlatform.discoveredDevices.clear();
    shellyPlatform.storedDevices.clear();
    (shellyPlatform as any).saveStoredDevices();
    (shellyPlatform as any).shelly.devices.forEach((device: ShellyDevice) => {
      // console.error(`Destroying shellyPlatform.shellyDevices device: ${device.id}`);
      device.destroy();
      (shellyPlatform as any).shelly.removeDevice(device);
    });
    (shellyPlatform as any).shelly._devices.clear();
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
      matterbridgeDirectory: './jest/matterbridge',
      matterbridgePluginDirectory: './jest/plugins',
      systemInformation: { ipv4Address: undefined, osRelease: 'xx.xx.xx.xx.xx.xx', nodeVersion: '22.1.10' },
      matterbridgeVersion: '2.2.5',
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
      plugins: {
        get: jest.fn((pluginName: string) => {
          // console.log('plugins.get() called');
          return undefined;
        }),
      },
      addBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
        // console.log('addBridgedEndpoint called');
        // await aggregator.add(device);
      }),
      removeBridgedEndpoint: jest.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {
        // console.log('removeBridgedEndpoint called');
      }),
      removeAllBridgedEndpoints: jest.fn(async (pluginName: string) => {
        // console.log('removeAllBridgedEndpoints called');
      }),
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
      'version': '1.1.2',
      'username': 'admin',
      'password': 'tango',
      'blackList': [],
      'whiteList': [],
      'entityBlackList': [],
      'deviceEntityBlackList': {},
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
    shellyPlatform = new ShellyPlatform(mockMatterbridge, mockLog, mockConfig as any);
    expect(mockLog.debug).toHaveBeenCalledWith(`Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shellyPlatform as any).shelly.fetchInterval);
    clearTimeout((shellyPlatform as any).shelly.coapServerTimeout);
    shellyPlatform.config.entityBlackList = [];
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
    expect(() => new ShellyPlatform(mockMatterbridge, mockLog, mockConfig as any)).toThrow();
    mockMatterbridge.matterbridgeVersion = '2.2.5';
  });

  it('should call onStart with reason and start mDNS', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = true;

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Started MdnsScanner for shelly devices.');
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

  it(
    'should call onStart with reason and load from storageDiscover',
    async () => {
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

      const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
        return Promise.resolve(undefined);
      });
      await shellyPlatform.onStart('Test reason');

      expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
      expect(mockLog.info).toHaveBeenCalledWith(`Loading from storage 2 Shelly devices`);
      expect(mockLog.error).toHaveBeenCalledWith(
        `Stored Shelly device id ${hk}shellyemg3-84FCE636582C${er} host ${zb}invalid${er} is not valid. Please enable resetStorageDiscover in plugin config and restart.`,
      );
      expect(mockLog.debug).toHaveBeenCalledWith(
        `Loading from storage Shelly device ${hk}shellyplus-34FCE636582C${db} host ${zb}192.168.255.1${db} port ${CYAN}80${db} gen ${CYAN}2${db}`,
      );
      expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
      expect(shellyPlatform.storedDevices.size).toBe(2);

      shellyPlatform.storedDevices.clear();
      expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
      expect(shellyPlatform.storedDevices.size).toBe(0);

      shellyPlatform.config.enableStorageDiscover = false;

      create.mockRestore();
      cleanup();
    },
    30 * 1000,
  );

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  it(
    'should call onStart with reason and check failsafeCount',
    async () => {
      jest.useFakeTimers();

      expect(shellyPlatform).toBeDefined();
      expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

      (shellyPlatform as any).failsafeCount = 2;
      shellyPlatform.bridgedDevices.set('shellyemg3-84FCE636582C', { id: 'shellyemg3-84FCE636582C', host: 'invalid', port: 80, gen: 1 } as unknown as MatterbridgeDevice);

      const onStartPromise = shellyPlatform.onStart('Test reason');

      jest.advanceTimersByTime(60 * 1000);
      await onStartPromise;

      jest.useRealTimers();

      expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
      expect(mockLog.notice).toHaveBeenCalledWith(`Waiting for the configured number of 1/2 devices to be loaded.`);
      (shellyPlatform as any).failsafeCount = 0;
      shellyPlatform.bridgedDevices.clear();

      cleanup();
    },
    30 * 1000,
  );
*/

  // eslint-disable-next-line jest/no-commented-out-tests
  /* / too too long 55 secs
  it('should call onStart with reason and check failsafeCount and throw', async () => {
    expect(shellyPlatform).toBeDefined();
    expect((shellyPlatform as any).shelly.mdnsScanner.isScanning).toBe(false);

    (shellyPlatform as any).failsafeCount = 1;
    shellyPlatform.bridgedDevices.clear();
    shellyPlatform.bluBridgedDevices.clear();

    jest.mock('matterbridge/utils', () => ({
      waiter: jest.fn(),
    }));

    await expect(shellyPlatform.onStart('Test reason')).rejects.toThrow(`The plugin did not add the configured number of 0/${1} devices. Registered 0 devices.`);

    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockLog.notice).toHaveBeenCalledWith(`Waiting for the configured number of 0/1 devices to be loaded.`);

    cleanup();
  }, 60000);
  */

  it('should call onStart with reason and add discovered devices', async () => {
    expect(shellyPlatform).toBeDefined();
    (shellyPlatform as any).failsafeCount = 0;

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    (shellyPlatform as any).shelly.emit('discovered', { id: 'shelly1l-E8DB84AAD781', host: '192.168.1.241', port: 80, gen: 1 });
    await wait(1000);
    expect((shellyPlatform as any).discoveredDevices.size).toBe(1);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);

    create.mockRestore();
    cleanup();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).discoveredDevices.size).toBe(0);
    expect((shellyPlatform as any).storedDevices.size).toBe(0);
    expect((shellyPlatform as any).bridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).bluBridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);
  }, 10000);

  it('should call onStart with reason and add shelly1', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = ['shelly1-34945472A643'];

    await shellyPlatform.onStart('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shelly1 = await ShellyDevice.create((shellyPlatform as any).shelly, (shellyPlatform as any).log, path.join('src', 'mock', 'shelly1-34945472A643.json'));
    expect(shelly1).not.toBeUndefined();
    if (!shelly1) return;

    // consoleLogSpy.mockRestore();
    await (shellyPlatform as any).shelly.addDevice(shelly1);
    (shellyPlatform as any).shelly._devices.set(shelly1.id, shelly1);
    await wait(1000);
    expect(mockLog.info).toHaveBeenCalledWith(`Shelly added ${idn}${shelly1.name}${rs} device id ${hk}${shelly1.id}${rs}${nf} host ${zb}${shelly1.host}${nf}`);
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shelly1-34945472A643')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shelly1-34945472A643');
    expect(device).toBeDefined();
    if (!device) return;

    expect(device.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.hasClusterServer(MatterbridgeBehavior)).toBeTruthy();
    expect(device.hasClusterServer(BridgedDeviceBasicInformationCluster)).toBeTruthy();
    expect(device.hasClusterServer(FixedLabelCluster)).toBeTruthy();
    expect(device.hasClusterServer(PowerSourceCluster)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(device.getChildEndpoints()).toHaveLength(3);
    expect(device.getChildEndpointByName('PowerSource')).not.toBeDefined();
    expect(device.getChildEndpointByName('relay:0')).toBeDefined();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(BindingCluster)).not.toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(GroupsCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('relay:0')?.hasClusterServer(OnOffCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')).toBeDefined();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(PowerTopology.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(ElectricalPowerMeasurement.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('meter:0')?.hasClusterServer(ElectricalEnergyMeasurement.Complete)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')).toBeDefined();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(BindingCluster)).not.toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('input:0')?.hasClusterServer(Switch.Complete)).toBeTruthy();

    // const onOff = device.getChildEndpointByName('relay:0')?.getClusterServer(OnOffCluster);
    // expect(onOff).toBeDefined();
    // if (!onOff) return;
    // invokeCommands(onOff as unknown as ClusterServerObj, { endpoint: { number: 100 } });

    cleanup();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);
    expect(shellyPlatform.bridgedDevices.size).toBe(0);
    expect(shellyPlatform.bluBridgedDevices.size).toBe(0);
    expect((shellyPlatform as any).shelly._devices.size).toBe(0);

    shelly1?.destroy();
  }, 10000);

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
    expect(mockMatterbridge.removeAllBridgedEndpoints).not.toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopped MdnsScanner for shelly devices.');
    await wait(1000);
  });

  it('should call onShutdown with reason and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await shellyPlatform.onShutdown('Test reason');
    expect(mockLog.info).toHaveBeenCalledWith(`Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(mockMatterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
    await wait(1000);
  });

  it('should destroy shelly', async () => {
    (shellyPlatform as any).shelly.destroy();
    // expect((shellyPlatform as any).shelly.mdnsScanner).toBeUndefined();
    // expect((shellyPlatform as any).shelly.coapServer).toBeUndefined();
    expect((shellyPlatform as any).shelly.fetchInterval).toBeUndefined();
    expect((shellyPlatform as any).shelly.coapServerTimeout).toBeUndefined();
    await wait(10000);
  }, 60000);
});
