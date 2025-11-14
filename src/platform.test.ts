// src/platform.test.ts

const MATTER_PORT = 6000;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { Matterbridge, MatterbridgeEndpoint, featuresFor } from 'matterbridge';
import {
  OnOffCluster,
  BindingCluster,
  DescriptorCluster,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  GroupsCluster,
  IdentifyCluster,
  PowerTopology,
  Switch,
  ColorControl,
  TemperatureMeasurementCluster,
  RelativeHumidityMeasurementCluster,
} from 'matterbridge/matter/clusters';
import { OnOffBehavior, RelativeHumidityMeasurementBehavior, TemperatureMeasurementBehavior } from 'matterbridge/matter/behaviors';
import { AnsiLogger, db, er, hk, idn, LogLevel, nf, rs, wr, zb, CYAN, TimestampFormat, YELLOW, or } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';
// Matter.js
import { jest } from '@jest/globals';

import { Shelly } from './shelly.ts';
import initializePlugin, { ShellyPlatform, ShellyPlatformConfig } from './platform.ts';
import { ShellyDevice } from './shellyDevice.ts';
import { CoapServer } from './coapServer.ts';
import { WsServer } from './wsServer.ts';
import { WsClient } from './wsClient.ts';
import { ShellyData } from './shellyTypes.ts';
import { MdnsScanner } from './mdnsScanner.ts';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  loggerLogSpy,
  matterbridge,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
  aggregator,
} from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

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
  expertMode: false,
  debug: true,
  debugMdns: true,
  debugCoap: true,
  debugWs: true,
  unregisterOnShutdown: false,
};

describe('ShellyPlatform', () => {
  const log = new AnsiLogger({ logName: NAME, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  let shellyPlatform: ShellyPlatform;
  let shelly: Shelly;

  const address = 'c4:cb:76:b3:cd:1f';

  jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
    return Promise.resolve();
  });
  jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints').mockImplementation((pluginName: string) => {
    return Promise.resolve();
  });

  const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
  const coapServerStopSpy = jest.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
  const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async (host: string, id: string, registerOnly: boolean) => {});
  const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
  const wsServerStopSpy = jest.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
  const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
  const wsClientStopSpy = jest.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
  const mdnsScannerStartSpy = jest.spyOn(MdnsScanner.prototype, 'start');
  const mdnsScannerStopSpy = jest.spyOn(MdnsScanner.prototype, 'stop');

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
    // const shelly = (shellyPlatform as any).shelly as Shelly;
    shelly.devices.forEach((device: ShellyDevice) => {
      shelly.removeDevice(device);
      device.destroy();
    });
    (shelly as any)._devices.clear();
    clearInterval((shelly as any).fetchInterval);
  };

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should return an instance of ShellyPlatform', async () => {
    const platform = initializePlugin(matterbridge, log, mockConfig);
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(ShellyPlatform);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.any(String));

    jest.clearAllMocks();
    await platform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Shutting down platform'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'NodeStorage is not initialized');
    (platform as any).shelly.destroy();
  });

  it('should initialize platform with config name and version', () => {
    shellyPlatform = new ShellyPlatform(matterbridge, log, mockConfig as any);
    addMatterbridgePlatform(shellyPlatform, 'matterbridge-shelly');
    shelly = (shellyPlatform as any).shelly;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shelly as any).fetchInterval);
    shellyPlatform.config.entityBlackList = [];
  });

  it('should validate version', () => {
    matterbridge.matterbridgeVersion = '1.5.4';
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
  });

  it('should validate version beta', () => {
    matterbridge.matterbridgeVersion = '1.5.4-dev.1';
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(shellyPlatform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
    matterbridge.matterbridgeVersion = '1.5.5';
  });

  it('should throw because of version', () => {
    matterbridge.matterbridgeVersion = '1.5.4';
    expect(() => new ShellyPlatform(matterbridge, log, mockConfig as any)).toThrow();
    matterbridge.matterbridgeVersion = '3.1.4';
  });

  it('should call onStart with reason and start mDNS', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = true;

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Started MdnsScanner for shelly devices.');
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shelly as any).mdnsScanner).toBeDefined();
    expect((shelly as any).mdnsScanner.isScanning).toBe(true);
    expect((shelly as any).coapServer).toBeDefined();
    expect((shelly as any).coapServer.isListening).toBe(false);
    expect((shelly as any).wsServer).toBeDefined();
    expect((shelly as any).wsServer.isListening).toBe(false);
    shellyPlatform.config.enableMdnsDiscover = false;
    (shelly as any).mdnsScanner?.stop();
    expect((shelly as any).mdnsScanner.isScanning).toBe(false);

    cleanup();
  });

  it('should call onStart with reason and reset the storage', async () => {
    shellyPlatform.config.enableStorageDiscover = false;
    shellyPlatform.config.resetStorageDiscover = true;
    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting the Shellies storage...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Reset of Shellies storage done!`);
    expect((shellyPlatform as any).nodeStorageManager).toBeDefined();
    expect((shellyPlatform as any).storedDevices.size).toBe(0);
    shellyPlatform.config.resetStorageDiscover = false;

    cleanup();
  });

  it('should call onStart with reason and load from storageDiscover', async () => {
    shellyPlatform.config.enableStorageDiscover = true;
    shellyPlatform.storedDevices.clear();
    shellyPlatform.storedDevices.set('shellyemg3-84FCE636582C', { id: 'shellyemg3-84FCE636582C', host: 'invalid', port: 80, gen: 1 });
    shellyPlatform.storedDevices.set('shellyplus-34FCE636582C', { id: 'shellyplus-34FCE636582C', host: '192.168.255.1', port: 80, gen: 2 });
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saving ${CYAN}2${db} discovered Shelly devices to the storage`);
    expect((shellyPlatform as any).storedDevices.size).toBe(2);

    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });
    await shellyPlatform.onStart('Test reason');

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Loading from storage 2 Shelly devices`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `Stored Shelly device id ${hk}shellyemg3-84FCE636582C${er} host ${zb}invalid${er} is not valid. Please remove it from the storage.`,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `Loading from storage Shelly device ${hk}shellyplus-34FCE636582C${db} host ${zb}192.168.255.1${db} port ${CYAN}80${db} gen ${CYAN}2${db}`,
    );
    expect(shellyPlatform.storedDevices.size).toBe(2);
    shellyPlatform.config.enableStorageDiscover = false;

    create.mockRestore();
    cleanup();
  });

  it('should call onStart with reason and check failsafeCount', async () => {
    shellyPlatform.config.failsafeCount = 2;
    (shellyPlatform as any).failsafeCountSeconds = 1;

    await expect(shellyPlatform.onStart('Test reason')).rejects.toThrow();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Waiting for the configured number of 0/2 devices to be loaded.`);
    shellyPlatform.config.failsafeCount = 0;

    cleanup();
  });

  it('should call onStart with reason and add discovered devices', async () => {
    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    (shelly as any).emit('discovered', { id: 'shelly1l-E8DB84AAD781', host: '192.168.1.241', port: 80, gen: 1 });
    await wait(100);
    expect((shellyPlatform as any).discoveredDevices.size).toBe(1);
    expect((shelly as any)._devices.size).toBe(0);

    create.mockRestore();
    cleanup();
  });

  it('should add shelly1', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = ['shelly1-34945472A643'];

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shelly1 = await ShellyDevice.create(shelly, (shellyPlatform as any).log, path.join('src', 'mock', 'shelly1-34945472A643.json'));
    expect(shelly1).not.toBeUndefined();
    if (!shelly1) return;

    await shelly.addDevice(shelly1);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shelly added ${idn}${shelly1.name}${rs} device id ${hk}${shelly1.id}${rs}${nf} host ${zb}${shelly1.host}${nf}`);
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shelly.devices).toHaveLength(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shelly1-34945472A643')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shelly1-34945472A643');
    expect(device).toBeDefined();
    if (!device) return;
    await aggregator.add(device);

    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(device.getChildEndpoints()).toHaveLength(3);
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

    // Test updates on switch from Shelly to Matter
    const switchEndpoint = device.getChildEndpointByName('relay:0') as MatterbridgeEndpoint;
    expect(switchEndpoint).toBeDefined();
    if (!switchEndpoint) return;
    expect(switchEndpoint.behaviors.has(OnOffBehavior)).toBeTruthy();
    await switchEndpoint.setStateOf(OnOffBehavior, { onOff: true });
    expect(switchEndpoint.stateOf(OnOffBehavior).onOff).toBe(true);
    await switchEndpoint.setStateOf(OnOffBehavior, { onOff: false });
    expect(switchEndpoint.stateOf(OnOffBehavior).onOff).toBe(false);
    shelly = shelly as any;
    shelly.coapServer.emit('coapupdate', shelly1.host, { 'relay:0': { state: true } } as ShellyData);
    await wait(100);
    expect(switchEndpoint.stateOf(OnOffBehavior).onOff).toBe(true);

    // Test commands for switch from Matter to Shelly
    const fetch = jest.spyOn(ShellyDevice, 'fetch' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    await switchEndpoint.executeCommandHandler('identify', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Identify command received for endpoint ${or}MA-onoffpluginunit${nf}`));

    await switchEndpoint.executeCommandHandler('on', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}On()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`);

    await switchEndpoint.executeCommandHandler('off', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}Off()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`);

    await switchEndpoint.executeCommandHandler('toggle', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`,
    );

    fetch.mockRestore();

    cleanup();
    shelly1.destroy();
  });

  it('should add shellyht', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = ['shellyht-703523'];

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shellyHt = await ShellyDevice.create(shelly, (shellyPlatform as any).log, path.join('src', 'mock', 'shellyht-703523.json'));
    expect(shellyHt).not.toBeUndefined();
    if (!shellyHt) return;

    await shelly.addDevice(shellyHt);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shelly added ${idn}${shellyHt.name}${rs} device id ${hk}${shellyHt.id}${rs}${nf} host ${zb}${shellyHt.host}${nf}`);
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shelly.devices).toHaveLength(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shellyht-703523')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shellyht-703523');
    expect(device).toBeDefined();
    if (!device) return;
    await aggregator.add(device);

    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(device.getChildEndpoints()).toHaveLength(2);
    expect(device.getChildEndpointByName('temperature')).toBeDefined();
    expect(device.getChildEndpointByName('temperature')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('temperature')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('temperature')?.hasClusterServer(TemperatureMeasurementCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('humidity')).toBeDefined();
    expect(device.getChildEndpointByName('humidity')?.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('humidity')?.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(device.getChildEndpointByName('humidity')?.hasClusterServer(RelativeHumidityMeasurementCluster)).toBeTruthy();

    // Test updates on switch from Shelly to Matter
    shelly.coapServer.emit('coapupdate', shellyHt.host, { temperature: { tC: 20.75, tF: 71.15 }, humidity: { value: 60.5 } } as ShellyData);
    await wait(100);
    const temperatureEndpoint = device.getChildEndpointByName('temperature') as MatterbridgeEndpoint;
    expect(temperatureEndpoint.stateOf(TemperatureMeasurementBehavior).measuredValue).toBe(2075);
    const humidityEndpoint = device.getChildEndpointByName('humidity') as MatterbridgeEndpoint;
    expect(humidityEndpoint.stateOf(RelativeHumidityMeasurementBehavior).measuredValue).toBe(6050);

    cleanup();
    shellyHt.destroy();
  });

  it('should add shellyprorgbwwpm mode rgbctt', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = ['shellyprorgbwwpm-AC1518784844'];

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shellyPro = await ShellyDevice.create(shelly as any, (shellyPlatform as any).log, path.join('src', 'mock', 'shellyprorgbwwpm-AC1518784844.json'));
    expect(shellyPro).not.toBeUndefined();
    if (!shellyPro) return;

    await shelly.addDevice(shellyPro);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shelly added ${idn}${shellyPro.name}${rs} device id ${hk}${shellyPro.id}${rs}${nf} host ${zb}${shellyPro.host}${nf}`);
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shelly.devices).toHaveLength(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shellyprorgbwwpm-AC1518784844')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shellyprorgbwwpm-AC1518784844');
    expect(device).toBeDefined();
    if (!device) return;
    await aggregator.add(device);

    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(featuresFor(device, 'powerSource').wired).toBe(true);

    expect(device.getChildEndpoints()).toHaveLength(7);
    expect(device.getChildEndpointByName('input:0')).toBeDefined();
    expect(device.getChildEndpointByName('input:1')).toBeDefined();
    expect(device.getChildEndpointByName('input:2')).toBeDefined();
    expect(device.getChildEndpointByName('input:3')).toBeDefined();
    expect(device.getChildEndpointByName('input:4')).toBeDefined();

    let child = device.getChildEndpointByName('rgb:0');
    expect(child?.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'groups',
      'onOff',
      'levelControl',
      'colorControl',
      'powerTopology',
      'electricalPowerMeasurement',
      'electricalEnergyMeasurement',
    ]);
    expect(featuresFor(child as MatterbridgeEndpoint, 'colorControl').hueSaturation).toBe(true);
    expect(featuresFor(child as MatterbridgeEndpoint, 'colorControl').colorTemperature).toBe(true);

    child = device.getChildEndpointByName('cct:0');
    expect(child?.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'groups',
      'onOff',
      'levelControl',
      'colorControl',
      'powerTopology',
      'electricalPowerMeasurement',
      'electricalEnergyMeasurement',
    ]);
    expect(featuresFor(child as MatterbridgeEndpoint, 'colorControl').hueSaturation).toBe(false);
    expect(featuresFor(child as MatterbridgeEndpoint, 'colorControl').colorTemperature).toBe(true);

    // Test updates on cct
    const cctEndpoint = device.getChildEndpointByName('cct:0') as MatterbridgeEndpoint;
    expect(cctEndpoint).toBeDefined();
    if (!cctEndpoint) return;
    await cctEndpoint.setAttribute('onOff', 'onOff', false);
    await cctEndpoint.setAttribute('levelControl', 'currentLevel', 100);
    await cctEndpoint.setAttribute('colorControl', 'colorTemperatureMireds', 300);
    expect(cctEndpoint.getAttribute('onOff', 'onOff')).toBe(false);
    expect(cctEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(300);
    shelly = shelly as any;
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { state: true, brightness: 50, ct: 3000 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('onOff', 'onOff')).toBe(true);
    expect(cctEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(127);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(454);
    expect(cctEndpoint.getAttribute('colorControl', 'colorMode')).toBe(ColorControl.ColorMode.ColorTemperatureMireds);
    expect(cctEndpoint.getAttribute('colorControl', 'enhancedColorMode')).toBe(ColorControl.ColorMode.ColorTemperatureMireds);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 2700 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(500);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 6500 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(147);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 6600 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(147);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 1600 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(147);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 1600 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(147);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 1600 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(147);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'cct:0': { ct: 4329 } } as ShellyData);
    await wait(100);
    expect(cctEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(250);

    // Test updates on rgb
    const rgbEndpoint = device.getChildEndpointByName('rgb:0') as MatterbridgeEndpoint;
    expect(rgbEndpoint).toBeDefined();
    if (!rgbEndpoint) return;
    await rgbEndpoint.setAttribute('onOff', 'onOff', false);
    await rgbEndpoint.setAttribute('levelControl', 'currentLevel', 100);
    await rgbEndpoint.setAttribute('colorControl', 'currentHue', 100);
    await rgbEndpoint.setAttribute('colorControl', 'currentSaturation', 100);
    expect(rgbEndpoint.getAttribute('onOff', 'onOff')).toBe(false);
    expect(rgbEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(100);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentHue')).toBe(100);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentSaturation')).toBe(100);
    shelly.wsServer.emit('wssupdate', shellyPro.id, { 'rgb:0': { state: true, brightness: 50, rgb: [100, 200, 255] } } as ShellyData);
    await wait(200);
    expect(rgbEndpoint.getAttribute('onOff', 'onOff')).toBe(true);
    expect(rgbEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(127);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentHue')).toBe(142);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentSaturation')).toBe(254);
    expect(rgbEndpoint.getAttribute('colorControl', 'colorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(rgbEndpoint.getAttribute('colorControl', 'enhancedColorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    const fetch = jest.spyOn(ShellyDevice, 'fetch' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    // Test commands for light from Matter to Shelly
    loggerLogSpy.mockClear();

    await rgbEndpoint.executeCommandHandler('on', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, on: true });

    await rgbEndpoint.executeCommandHandler('off', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, on: false });

    await rgbEndpoint.executeCommandHandler('toggle', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Toggle', { id: 0 });

    await rgbEndpoint.executeCommandHandler('moveToLevel', { level: 50 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, brightness: 20 });

    await rgbEndpoint.executeCommandHandler('moveToHueAndSaturation', { hue: 50, saturation: 50 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}144${hk}, ${YELLOW}153${hk}, ${YELLOW}103${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, rgb: [144, 153, 103] });

    await rgbEndpoint.executeCommandHandler('moveToColorTemperature', { colorTemperatureMireds: 250 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}255${hk}, ${YELLOW}206${hk}, ${YELLOW}166${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, rgb: [255, 206, 166] });

    await cctEndpoint.executeCommandHandler('on', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, on: true });

    await cctEndpoint.executeCommandHandler('off', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, on: false });

    await cctEndpoint.executeCommandHandler('toggle', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Toggle', { id: 0 });

    await cctEndpoint.executeCommandHandler('moveToLevel', { level: 50 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, brightness: 20 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler('moveToColorTemperature', { colorTemperatureMireds: 250 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}250${hk}->${YELLOW}4329${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 4329 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler('moveToColorTemperature', { colorTemperatureMireds: 500 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}500${hk}->${YELLOW}2700${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 2700 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler('moveToColorTemperature', { colorTemperatureMireds: 147 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}147${hk}->${YELLOW}5000${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 5000 });

    fetch.mockRestore();

    cleanup();
    shellyPro.destroy();
  });

  it('should add shellyplusrgbwpm mode rgb', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = ['shellyplusrgbwpm-A0A3B35C7024'];

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shellyPlusRgbwPm = await ShellyDevice.create(shelly as any, (shellyPlatform as any).log, path.join('src', 'mock', 'shellyplusrgbwpm-A0A3B35C7024.json'));
    expect(shellyPlusRgbwPm).not.toBeUndefined();
    if (!shellyPlusRgbwPm) return;

    await shelly.addDevice(shellyPlusRgbwPm);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Shelly added ${idn}${shellyPlusRgbwPm.name}${rs} device id ${hk}${shellyPlusRgbwPm.id}${rs}${nf} host ${zb}${shellyPlusRgbwPm.host}${nf}`,
    );
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shelly.devices).toHaveLength(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shellyplusrgbwpm-A0A3B35C7024')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shellyplusrgbwpm-A0A3B35C7024');
    expect(device).toBeDefined();
    if (!device) return;
    await aggregator.add(device);

    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(featuresFor(device, 'powerSource')).toEqual({
      battery: false,
      rechargeable: false,
      replaceable: false,
      wired: true,
    });

    expect(device.getChildEndpoints()).toHaveLength(5);
    expect(device.getChildEndpointByName('input:0')).toBeDefined();
    expect(device.getChildEndpointByName('input:1')).toBeDefined();
    expect(device.getChildEndpointByName('input:2')).toBeDefined();
    expect(device.getChildEndpointByName('input:3')).toBeDefined();

    const child = device.getChildEndpointByName('rgb:0');
    expect(child?.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'groups',
      'onOff',
      'levelControl',
      'colorControl',
      'powerTopology',
      'electricalPowerMeasurement',
      'electricalEnergyMeasurement',
    ]);
    expect(featuresFor(child as MatterbridgeEndpoint, 'descriptor')).toEqual({ tagList: true });
    expect(featuresFor(child as MatterbridgeEndpoint, 'onOff')).toEqual({ lighting: true, deadFrontBehavior: false, offOnly: false });
    expect(featuresFor(child as MatterbridgeEndpoint, 'levelControl')).toEqual({ onOff: true, lighting: true, frequency: false });
    expect(featuresFor(child as MatterbridgeEndpoint, 'colorControl')).toEqual({
      colorLoop: false,
      colorTemperature: true,
      enhancedHue: false,
      hueSaturation: true,
      xy: true,
    });
    expect(featuresFor(child as MatterbridgeEndpoint, 'powerTopology')).toEqual({ nodeTopology: false, treeTopology: true, setTopology: false, dynamicPowerFlow: false });
    expect(featuresFor(child as MatterbridgeEndpoint, 'electricalPowerMeasurement')).toEqual({
      alternatingCurrent: true,
      directCurrent: false,
      harmonics: false,
      polyphasePower: false,
      powerQuality: false,
    });
    expect(featuresFor(child as MatterbridgeEndpoint, 'electricalEnergyMeasurement')).toEqual({
      cumulativeEnergy: true,
      exportedEnergy: true,
      importedEnergy: true,
      periodicEnergy: false,
    });
    expect(child?.getAttribute('Descriptor', 'tagList')).toEqual([{ mfgCode: null, namespaceId: 7, tag: 0, label: 'rgb:0' }]);
    expect(child?.getAttribute('Descriptor', 'deviceTypeList')).toEqual([
      { deviceType: 269, revision: 4 },
      { deviceType: 1296, revision: 1 },
    ]);
    expect(child?.getAttribute('Identify', 'acceptedCommandList')).toEqual([0, 64]);
    expect(child?.getAttribute('OnOff', 'acceptedCommandList')).toEqual([0, 64, 65, 66, 1, 2]);
    expect(child?.getAttribute('LevelControl', 'acceptedCommandList')).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(child?.getAttribute('ColorControl', 'acceptedCommandList')).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 75, 76, 71]);

    // Test updates on rgb
    const rgbEndpoint = device.getChildEndpointByName('rgb:0') as MatterbridgeEndpoint;
    expect(rgbEndpoint).toBeDefined();
    if (!rgbEndpoint) return;
    await rgbEndpoint.setAttribute('onOff', 'onOff', false);
    await rgbEndpoint.setAttribute('levelControl', 'currentLevel', 100);
    await rgbEndpoint.setAttribute('colorControl', 'currentHue', 100);
    await rgbEndpoint.setAttribute('colorControl', 'currentSaturation', 100);
    await rgbEndpoint.setAttribute('colorControl', 'colorTemperatureMireds', 250);
    expect(rgbEndpoint.getAttribute('onOff', 'onOff')).toBe(false);
    expect(rgbEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(100);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentHue')).toBe(100);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentSaturation')).toBe(100);
    expect(rgbEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(250);
    shelly.wsServer.emit('wssupdate', shellyPlusRgbwPm.id, { 'rgb:0': { id: 0, state: true, brightness: 50, rgb: [255, 111, 128] } } as ShellyData);
    await wait(100);
    expect(rgbEndpoint.getAttribute('onOff', 'onOff')).toBe(true);
    expect(rgbEndpoint.getAttribute('levelControl', 'currentLevel')).toBe(127);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentHue')).toBe(249);
    expect(rgbEndpoint.getAttribute('colorControl', 'currentSaturation')).toBe(254);
    expect(rgbEndpoint.getAttribute('colorControl', 'colorTemperatureMireds')).toBe(250);
    expect(rgbEndpoint.getAttribute('colorControl', 'colorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    expect(rgbEndpoint.getAttribute('colorControl', 'enhancedColorMode')).toBe(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

    shelly.wsServer.emit('wssupdate', shellyPlusRgbwPm.id, {
      'rgb:0': { id: 0, aenergy: { total: 55.774, by_minute: [Array], minute_ts: 1745084640 }, apower: 12.85, current: 0.15, voltage: 12.8 },
    } as ShellyData);
    await wait(100);
    expect(rgbEndpoint.getAttribute('ElectricalPowerMeasurement', 'voltage')).toBe(12800);
    expect(rgbEndpoint.getAttribute('ElectricalPowerMeasurement', 'activeCurrent')).toBe(150);
    expect(rgbEndpoint.getAttribute('ElectricalPowerMeasurement', 'activePower')).toBe(12850);
    expect(rgbEndpoint.getAttribute('ElectricalEnergyMeasurement', 'cumulativeEnergyImported')?.energy).toBe(55774);

    const fetch = jest.spyOn(ShellyDevice, 'fetch' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    // Test commands for light from Matter to Shelly
    loggerLogSpy.mockClear();
    await rgbEndpoint.executeCommandHandler('on', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, on: true });

    await rgbEndpoint.executeCommandHandler('off', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, on: false });

    await rgbEndpoint.executeCommandHandler('toggle', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Toggle', { id: 0 });

    await rgbEndpoint.executeCommandHandler('moveToLevel', { level: 50 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, brightness: 20 });

    await rgbEndpoint.executeCommandHandler('moveToHueAndSaturation', { hue: 50, saturation: 50 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}144${hk}, ${YELLOW}153${hk}, ${YELLOW}103${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [144, 153, 103] });

    await rgbEndpoint.executeCommandHandler('moveToColorTemperature', { colorTemperatureMireds: 250 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}255${hk}, ${YELLOW}206${hk}, ${YELLOW}166${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [255, 206, 166] });

    fetch.mockRestore();

    cleanup();
    shellyPlusRgbwPm.destroy();
  });

  it('should add shelly2pmg3 mode cover', async () => {
    expect(shellyPlatform).toBeDefined();
    shellyPlatform.config.enableMdnsDiscover = false;
    shellyPlatform.config.inputMomentaryList = [];

    await shellyPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);

    const shelly2PMGen3 = await ShellyDevice.create(shelly, (shellyPlatform as any).log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(shelly2PMGen3).not.toBeUndefined();
    if (!shelly2PMGen3) return;

    await shelly.addDevice(shelly2PMGen3);
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Shelly added ${idn}${shelly2PMGen3.name}${rs} device id ${hk}${shelly2PMGen3.id}${rs}${nf} host ${zb}${shelly2PMGen3.host}${nf}`,
    );
    expect(shellyPlatform.discoveredDevices.size).toBe(0);
    expect(shellyPlatform.storedDevices.size).toBe(0);
    expect(shelly.devices).toHaveLength(1);
    expect(shellyPlatform.bridgedDevices.size).toBe(1);
    expect(shellyPlatform.bridgedDevices.has('shelly2pmg3-34CDB0770C4C')).toBe(true);

    const device = shellyPlatform.bridgedDevices.get('shelly2pmg3-34CDB0770C4C');
    expect(device).toBeDefined();
    if (!device) return;
    await aggregator.add(device);

    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'bridgedDeviceBasicInformation', 'powerSource', 'fixedLabel']);
    expect(featuresFor(device, 'powerSource').wired).toBe(true);

    expect(device.getChildEndpoints()).toHaveLength(1);
    expect(device.getChildEndpointByName('input:0')).not.toBeDefined();
    expect(device.getChildEndpointByName('input:1')).not.toBeDefined();

    const coverEndpoint = device.getChildEndpointByName('cover:0');
    expect(coverEndpoint).toBeDefined();
    if (!coverEndpoint) return;
    expect(coverEndpoint?.getAllClusterServerNames()).toEqual([
      'descriptor',
      'matterbridge',
      'identify',
      'windowCovering',
      'powerTopology',
      'electricalPowerMeasurement',
      'electricalEnergyMeasurement',
    ]);
    expect(featuresFor(coverEndpoint as MatterbridgeEndpoint, 'windowCovering').lift).toBe(true);
    expect(featuresFor(coverEndpoint as MatterbridgeEndpoint, 'windowCovering').positionAwareLift).toBe(true);

    // Test updates on cover
    // Matter uses 10000 = fully closed   0 = fully opened
    // Shelly uses 0 = fully closed   100 = fully opened
    await coverEndpoint.setAttribute('windowCovering', 'currentPositionLiftPercent100ths', 0);
    await coverEndpoint.setAttribute('windowCovering', 'targetPositionLiftPercent100ths', 0); // Fully open
    expect(coverEndpoint.getAttribute('windowCovering', 'currentPositionLiftPercent100ths')).toBe(0);
    expect(coverEndpoint.getAttribute('windowCovering', 'targetPositionLiftPercent100ths')).toBe(0);
    shelly = shelly as any;

    shelly2PMGen3.getComponent('cover:0')?.setValue('current_pos', 50);
    shelly2PMGen3.getComponent('cover:0')?.setValue('target_pos', 50);

    shelly.wsServer.emit('wssupdate', shelly2PMGen3.id, { 'cover:0': { current_pos: 0, target_pos: 0 } } as ShellyData); // Fully closed
    await wait(100);
    expect(coverEndpoint.getAttribute('windowCovering', 'currentPositionLiftPercent100ths')).toBe(10000);
    expect(coverEndpoint.getAttribute('windowCovering', 'targetPositionLiftPercent100ths')).toBe(10000);

    shelly.wsServer.emit('wssupdate', shelly2PMGen3.id, { 'cover:0': { current_pos: 50, target_pos: 50 } } as ShellyData); // Fully open
    await wait(100);
    expect(coverEndpoint.getAttribute('windowCovering', 'currentPositionLiftPercent100ths')).toBe(5000);
    expect(coverEndpoint.getAttribute('windowCovering', 'targetPositionLiftPercent100ths')).toBe(5000);

    shelly.wsServer.emit('wssupdate', shelly2PMGen3.id, { 'cover:0': { current_pos: 100, target_pos: 100 } } as ShellyData); // Fully open
    await wait(100);
    expect(coverEndpoint.getAttribute('windowCovering', 'currentPositionLiftPercent100ths')).toBe(0);
    expect(coverEndpoint.getAttribute('windowCovering', 'targetPositionLiftPercent100ths')).toBe(0);

    // Test commands for cover from Matter to Shelly
    const fetch = jest.spyOn(ShellyDevice, 'fetch' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    loggerLogSpy.mockClear();

    await coverEndpoint.executeCommandHandler('downOrClose', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Close()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Close', { id: 0 });

    await coverEndpoint.executeCommandHandler('upOrOpen', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Open()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Open', { id: 0 });

    await coverEndpoint.executeCommandHandler('stopMotion', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Stop()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Stop', { id: 0 });

    await coverEndpoint.executeCommandHandler('goToLiftPercentage', { liftPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}GoToPosition(${YELLOW}50${hk})${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.GoToPosition', { id: 0, pos: 50 });

    fetch.mockRestore();

    cleanup();
    shelly2PMGen3.destroy();
  });

  it('should load and save the stored devices', async () => {
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    const originalSize = (shellyPlatform as any).storedDevices.size;
    expect(await (shellyPlatform as any).saveStoredDevices()).toBeTruthy();
    const size = (shellyPlatform as any).storedDevices.size;
    expect(size).toBe(originalSize);
  });

  it('should handle Shelly discovered event', async () => {
    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    shellyPlatform.discoveredDevices.clear();
    shellyPlatform.storedDevices.clear();
    (shelly as any).emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);

    create.mockRestore();
  });

  it('should not add already discoverd Shelly', async () => {
    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    (shelly as any).emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shelly device ${hk}shelly1-84FCE1234${nf} host ${zb}invalid${nf} already discovered`);

    create.mockRestore();
  });

  it('should not add already discoverd Shelly with different host', async () => {
    const create = jest.spyOn(ShellyDevice, 'create' as any).mockImplementation(async () => {
      return Promise.resolve(undefined);
    });

    (shelly as any).emit('discovered', { id: 'shelly1-84FCE1234', host: 'invalid new host', port: 80, gen: 1 });
    expect(await (shellyPlatform as any).loadStoredDevices()).toBeTruthy();
    expect((shellyPlatform as any).storedDevices.size).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.WARN,
      `Shelly device ${hk}shelly1-84FCE1234${wr} host ${zb}invalid new host${wr} has been discovered with a different host.`,
    );

    cleanup();
    create.mockRestore();
  });

  it('should call onConfigure', async () => {
    await shellyPlatform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Configuring platform ${idn}${mockConfig.name}${rs}${nf}`);
  });

  it('should call onChangeLoggerLevel and log a partial message', async () => {
    await shellyPlatform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Changing logger level for platform ${idn}${mockConfig.name}${rs}`));
  });

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(matterbridge.removeAllBridgedEndpoints).not.toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopped MdnsScanner for shelly devices.');
  });

  it('should call onShutdown with reason and unregister', async () => {
    mockConfig.unregisterOnShutdown = true;
    await shellyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  it('should destroy shelly', async () => {
    (shelly as any).destroy();
    expect((shelly as any).fetchInterval).toBeUndefined();
  });
});
