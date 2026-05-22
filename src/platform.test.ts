// src/platform.test.ts

const NAME = 'Platform';
const MATTER_PORT = 6000;

import * as fs from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { featuresFor, MatterbridgeEndpoint } from 'matterbridge';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  getMoveToColorRequest,
  getMoveToHueRequest,
  getMoveToLevelRequest,
  getMoveToSaturationRequest,
  log,
  loggerLogSpy,
  matterbridge,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { CYAN, db, er, hk, idn, LogLevel, nf, or, rs, wr, YELLOW, zb } from 'matterbridge/logger';
import { OnOffBehavior, RelativeHumidityMeasurementBehavior, TemperatureMeasurementBehavior } from 'matterbridge/matter/behaviors';
import {
  BindingCluster,
  ColorControl,
  DescriptorCluster,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  GroupsCluster,
  IdentifyCluster,
  OnOffCluster,
  PowerTopology,
  RelativeHumidityMeasurementCluster,
  Switch,
  TemperatureMeasurementCluster,
} from 'matterbridge/matter/clusters';
import { wait } from 'matterbridge/utils';

import { CoapServer } from './coapServer.js';
import { MdnsScanner } from './mdnsScanner.js';
import initializePlugin, { ShellyPlatform, ShellyPlatformConfig } from './platform.js';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyData, ShellyEvent } from './shellyTypes.js';
import { WsClient } from './wsClient.js';
import { WsServer } from './wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

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
  expertMode: true,
  debug: true,
  debugMdns: true,
  debugCoap: true,
  debugWs: true,
  unregisterOnShutdown: false,
};

function expectUnorderedNumberArray(actual: unknown, expected: number[]): void {
  expect(Array.isArray(actual)).toBe(true);
  expect([...(actual as number[])].sort((a, b) => a - b)).toEqual([...expected].sort((a, b) => a - b));
}

describe('ShellyPlatform', () => {
  let shellyPlatform: ShellyPlatform;
  let shelly: Shelly;

  const address = 'c4:cb:76:b3:cd:1f';

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
    await createMatterbridgeEnvironment();
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clear debug
    await setDebug(false);
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
    shellyPlatform.config.entityBlackList = []; // First run turn off entity black list
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
    matterbridge.matterbridgeVersion = '3.7.0';
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
    // await aggregator.add(device);

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

    await switchEndpoint.executeCommandHandler('identify', { identifyTime: 0 }, 'identify', {} as any, switchEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Identify command received for endpoint ${or}MA-onoffpluginunit${nf}`));

    await switchEndpoint.executeCommandHandler('on', {}, 'onOff', {} as any, switchEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}On()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`);

    await switchEndpoint.executeCommandHandler('off', {}, 'onOff', {} as any, switchEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}Off()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`);

    await switchEndpoint.executeCommandHandler('toggle', {}, 'onOff', {} as any, switchEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Relay${db}:${hk}relay:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shelly1.id}${rs}${db}`,
    );

    fetch.mockRestore();

    await shellyPlatform.onConfigure();

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
    // await aggregator.add(device);

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

    await shellyPlatform.onConfigure();

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
    // await aggregator.add(device);

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

    await rgbEndpoint.executeCommandHandler('on', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, on: true });

    await rgbEndpoint.executeCommandHandler('off', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, on: false });

    await rgbEndpoint.executeCommandHandler('toggle', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Toggle', { id: 0 });

    await rgbEndpoint.executeCommandHandler(
      'moveToLevel',
      { level: 50, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'levelControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, brightness: 20 });

    await rgbEndpoint.executeCommandHandler(
      'moveToHueAndSaturation',
      { hue: 50, saturation: 50, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}144${hk}, ${YELLOW}153${hk}, ${YELLOW}103${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, rgb: [144, 153, 103] });

    await rgbEndpoint.executeCommandHandler(
      'moveToColorTemperature',
      { colorTemperatureMireds: 250, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}255${hk}, ${YELLOW}206${hk}, ${YELLOW}166${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Rgb.Set', { id: 0, rgb: [255, 206, 166] });

    await cctEndpoint.executeCommandHandler('on', {}, 'onOff', {} as any, cctEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, on: true });

    await cctEndpoint.executeCommandHandler('off', {}, 'onOff', {} as any, cctEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, on: false });

    await cctEndpoint.executeCommandHandler('toggle', {}, 'onOff', {} as any, cctEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`);
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Toggle', { id: 0 });

    await cctEndpoint.executeCommandHandler(
      'moveToLevel',
      { level: 50, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'levelControl',
      {} as any,
      cctEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, brightness: 20 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler(
      'moveToColorTemperature',
      { colorTemperatureMireds: 250, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      cctEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}250${hk}->${YELLOW}4329${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 4329 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler(
      'moveToColorTemperature',
      { colorTemperatureMireds: 500, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      cctEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}500${hk}->${YELLOW}2700${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 2700 });

    loggerLogSpy.mockClear();
    await cctEndpoint.executeCommandHandler(
      'moveToColorTemperature',
      { colorTemperatureMireds: 147, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      cctEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cct${db}:${hk}cct:0${db}:${hk}ColorTemp(for model ${shellyPro.model} range 2700-5000 ${YELLOW}147${hk}->${YELLOW}5000${hk})${db} to shelly device ${idn}${shellyPro.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPro.shelly, shellyPro.log, shellyPro.host, 'Cct.Set', { id: 0, ct: 5000 });

    fetch.mockRestore();

    await shellyPlatform.onConfigure();

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
    // await aggregator.add(device);

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
    expect(featuresFor(child as MatterbridgeEndpoint, 'electricalEnergyMeasurement')).toEqual(
      matterbridge.matterbridgeVersion === '3.7.10'
        ? {
            cumulativeEnergy: true,
            exportedEnergy: true,
            importedEnergy: true,
            periodicEnergy: false,
          }
        : {
            apparentEnergy: false,
            cumulativeEnergy: true,
            exportedEnergy: true,
            importedEnergy: true,
            periodicEnergy: false,
            reactiveEnergy: false,
          },
    );
    expect(child?.getAttribute('Descriptor', 'tagList')).toEqual([{ mfgCode: null, namespaceId: 7, tag: 0, label: 'rgb:0' }]);
    expect(child?.getAttribute('Descriptor', 'deviceTypeList')).toEqual([
      { deviceType: 269, revision: 4 },
      { deviceType: 1296, revision: 1 },
    ]);
    expectUnorderedNumberArray(child?.getAttribute('Identify', 'acceptedCommandList'), [0, 64]);
    expectUnorderedNumberArray(child?.getAttribute('OnOff', 'acceptedCommandList'), [0, 64, 65, 66, 1, 2]);
    expectUnorderedNumberArray(child?.getAttribute('LevelControl', 'acceptedCommandList'), [0, 1, 2, 3, 4, 5, 6, 7]);
    expectUnorderedNumberArray(child?.getAttribute('ColorControl', 'acceptedCommandList'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 75, 76, 71]);

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
    await rgbEndpoint.executeCommandHandler('on', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}On()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, on: true });

    await rgbEndpoint.executeCommandHandler('off', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Off()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, on: false });

    await rgbEndpoint.executeCommandHandler('toggle', {}, 'onOff', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Toggle()${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Toggle', { id: 0 });

    await rgbEndpoint.executeCommandHandler(
      'moveToLevel',
      { level: 50, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'levelControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Level(${YELLOW}20${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, brightness: 20 });

    await rgbEndpoint.executeCommandHandler(
      'moveToHueAndSaturation',
      { hue: 50, saturation: 50, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}144${hk}, ${YELLOW}153${hk}, ${YELLOW}103${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [144, 153, 103] });

    await rgbEndpoint.executeCommandHandler(
      'moveToColorTemperature',
      { colorTemperatureMireds: 250, transitionTime: 0, optionsMask: {} as any, optionsOverride: {} as any },
      'colorControl',
      {} as any,
      rgbEndpoint,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}255${hk}, ${YELLOW}206${hk}, ${YELLOW}166${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [255, 206, 166] });

    await rgbEndpoint.executeCommandHandler('identify', { identifyTime: 0 }, 'identify', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Identify command received for endpoint'));

    await rgbEndpoint.executeCommandHandler('moveToLevelWithOnOff', getMoveToLevelRequest(127, 0, false), 'levelControl', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}Level(${YELLOW}50${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, brightness: 50 });

    await rgbEndpoint.executeCommandHandler('moveToHue', getMoveToHueRequest(50, 0, false), 'colorControl', {} as any, rgbEndpoint);
    await wait(600);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}209${hk}, ${YELLOW}255${hk}, ${YELLOW}0${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [209, 255, 0] });

    await rgbEndpoint.executeCommandHandler('moveToSaturation', getMoveToSaturationRequest(50, 0, false), 'colorControl', {} as any, rgbEndpoint);
    await wait(600);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}153${hk}, ${YELLOW}103${hk}, ${YELLOW}109${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [153, 103, 109] });

    await rgbEndpoint.executeCommandHandler('moveToColor', getMoveToColorRequest(16384, 16384, 0, false), 'colorControl', {} as any, rgbEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Rgb${db}:${hk}rgb:0${db}:${hk}ColorRGB(${YELLOW}171${hk}, ${YELLOW}191${hk}, ${YELLOW}255${hk})${db} to shelly device ${idn}${shellyPlusRgbwPm.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shellyPlusRgbwPm.shelly, shellyPlusRgbwPm.log, shellyPlusRgbwPm.host, 'Rgb.Set', { id: 0, rgb: [171, 191, 255] });

    fetch.mockRestore();

    // Test Sys component update and event handlers
    const sysComponent = shellyPlusRgbwPm.getComponent('sys');
    expect(sysComponent).toBeDefined();
    if (!sysComponent) return;

    loggerLogSpy.mockClear();
    sysComponent.emit('update', 'sys', 'cfg_rev', 45);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('sent config changed rev:'));
    expect(shellyPlatform.changedDevices.has(shellyPlusRgbwPm.id)).toBe(true);

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'component_added', { component: 'sys', event: 'component_added', ts: 0, target: 'switch:2' } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('added a component:'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'component_removed', { component: 'sys', event: 'component_removed', ts: 0, target: 'switch:2' } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('removed a component:'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'scheduled_restart', { component: 'sys', event: 'scheduled_restart', ts: 0, time_ms: 5000 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('is restarting in'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'config_changed', { component: 'sys', event: 'config_changed', ts: 0, cfg_rev: 45 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('sent config changed rev:'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'ota_begin', { component: 'sys', event: 'ota_begin', ts: 0 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('is starting OTA'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'ota_progress', { component: 'sys', event: 'ota_progress', ts: 0, progress_percent: 50 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('OTA is progressing:'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'ota_success', { component: 'sys', event: 'ota_success', ts: 0 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('finished succesfully OTA'));

    loggerLogSpy.mockClear();
    sysComponent.emit('event', 'sys', 'sleep', { component: 'sys', event: 'sleep', ts: 0 } as ShellyEvent);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('is sleeping'));

    await shellyPlatform.onConfigure();

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
    // await aggregator.add(device);

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

    await coverEndpoint.executeCommandHandler('identify', { identifyTime: 0 }, 'identify', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Identify command received for endpoint'));

    await coverEndpoint.executeCommandHandler('downOrClose', {}, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Close()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Close', { id: 0 });

    await coverEndpoint.executeCommandHandler('upOrOpen', {}, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Open()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Open', { id: 0 });

    await coverEndpoint.executeCommandHandler('stopMotion', {}, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Stop()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Stop', { id: 0 });

    await coverEndpoint.executeCommandHandler('goToLiftPercentage', { liftPercent100thsValue: 5000 }, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}GoToPosition(${YELLOW}50${hk})${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.GoToPosition', { id: 0, pos: 50 });

    await coverEndpoint.executeCommandHandler('goToLiftPercentage', { liftPercent100thsValue: 0 }, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Open()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Open', { id: 0 });

    await coverEndpoint.executeCommandHandler('goToLiftPercentage', { liftPercent100thsValue: 10000 }, 'windowCovering', {} as any, coverEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `${db}Sent command ${hk}Cover${db}:${hk}cover:0${db}:${hk}Close()${db} to shelly device ${idn}${shelly2PMGen3.id}${rs}${db}`,
    );
    expect(fetch).toHaveBeenCalledWith(shelly2PMGen3.shelly, shelly2PMGen3.log, shelly2PMGen3.host, 'Cover.Close', { id: 0 });

    fetch.mockRestore();

    // Test cover:0 component electrical update events
    const coverComponent = shelly2PMGen3.getComponent('cover:0');
    expect(coverComponent).toBeDefined();
    if (!coverComponent) return;

    coverComponent.emit('update', 'cover:0', 'apower', 12.85);
    coverComponent.emit('update', 'cover:0', 'voltage', 233.8);
    coverComponent.emit('update', 'cover:0', 'current', 1.5);
    coverComponent.emit('update', 'cover:0', 'aenergy', { total: 55.774 } as ShellyData);
    await wait(100);
    expect(coverEndpoint.getAttribute('ElectricalPowerMeasurement', 'activePower')).toBe(12850);
    expect(coverEndpoint.getAttribute('ElectricalPowerMeasurement', 'voltage')).toBe(233800);
    expect(coverEndpoint.getAttribute('ElectricalPowerMeasurement', 'activeCurrent')).toBe(1500);
    expect(coverEndpoint.getAttribute('ElectricalEnergyMeasurement', 'cumulativeEnergyImported')?.energy).toBe(55774);

    await shellyPlatform.onConfigure();

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

  it('should call onAction', async () => {
    // scanNetwork path
    const sendQuerySpy = jest.spyOn(shelly.mdnsScanner, 'sendQuery').mockImplementation(() => {});
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('scanNetwork');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Scanning the network for Shelly devices`);
    expect(sendQuerySpy).toHaveBeenCalledTimes(1);
    sendQuerySpy.mockRestore();

    // addDevice with invalid IP
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('addDevice', 'not-an-ip');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to add device on IP address not-an-ip. Please check the IP address.`);

    // addDevice with valid IP but ShellyDevice.create returns undefined
    const createSpy = jest.spyOn(ShellyDevice, 'create' as any).mockResolvedValue(undefined);
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('addDevice', '192.168.1.100');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Adding device on IP address ${zb}192.168.1.100${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Failed to add device on IP address'));

    // addDevice with valid IP and ShellyDevice.create returns a device (strips url prefix/suffix)
    const mockDevice = { id: 'shellymock-AABBCCDD', host: '192.168.1.100', gen: 2, destroy: jest.fn() };
    createSpy.mockResolvedValue(mockDevice as any);
    const addDeviceSpy = jest.spyOn(shellyPlatform as any, 'addDevice').mockResolvedValue(undefined);
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('addDevice', 'http://192.168.1.100/');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Adding device on IP address ${zb}192.168.1.100${nf}`);
    expect(shellyPlatform.storedDevices.has('shellymock-AABBCCDD')).toBe(true);
    expect(mockDevice.destroy).toHaveBeenCalled();
    createSpy.mockRestore();
    addDeviceSpy.mockRestore();
    shellyPlatform.storedDevices.delete('shellymock-AABBCCDD');

    // removeDevice for an ID only in storedDevices (not in shelly)
    shellyPlatform.storedDevices.set('shellydevice-AABBCC', { id: 'shellydevice-AABBCC', host: '10.0.0.1', port: 80, gen: 2 });
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('removeDevice', 'shellydevice-AABBCC');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removing device id ${hk}shellydevice-AABBCC${nf}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed device id ${hk}shellydevice-AABBCC${nf}`);
    expect(shellyPlatform.storedDevices.has('shellydevice-AABBCC')).toBe(false);

    // removeDevice for an ID that IS in shelly (still in use)
    const fakeDevice = { id: 'shellydevice-CCDDEE', host: '10.0.0.2', gen: 2, destroy: jest.fn() };
    (shelly as any)._devices.set('shellydevice-CCDDEE', fakeDevice);
    shellyPlatform.storedDevices.set('shellydevice-CCDDEE', { id: 'shellydevice-CCDDEE', host: '10.0.0.2', port: 80, gen: 2 });
    loggerLogSpy.mockClear();
    await shellyPlatform.onAction('removeDevice', 'shellydevice-CCDDEE');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Removing device id ${hk}shellydevice-CCDDEE${wr} while it is still in use`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed device id ${hk}shellydevice-CCDDEE${nf}`);
    expect(shellyPlatform.storedDevices.has('shellydevice-CCDDEE')).toBe(false);
    expect(fakeDevice.destroy).toHaveBeenCalled();
  });

  it('should call hasElectricalMeasurements', () => {
    const noProps = { hasProperty: () => false } as any;
    const hasVoltage = { hasProperty: (k: string) => k === 'voltage' } as any;
    const hasCurrent = { hasProperty: (k: string) => k === 'current' } as any;
    const hasPower = { hasProperty: (k: string) => k === 'apower' } as any;
    const hasEnergy = { hasProperty: (k: string) => k === 'aenergy' } as any;

    // entityBlackList contains 'PowerMeter' → always false
    mockConfig.entityBlackList = ['PowerMeter'];
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, noProps)).toBe(false);
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, hasVoltage)).toBe(false);
    mockConfig.entityBlackList = [];

    // component has an electrical property → true
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, hasVoltage)).toBe(true);
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, hasCurrent)).toBe(true);
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, hasPower)).toBe(true);
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, hasEnergy)).toBe(true);

    // component has no electrical properties → false
    expect((shellyPlatform as any).hasElectricalMeasurements(undefined, noProps)).toBe(false);
  });

  it('should call addElectricalMeasurements', () => {
    const makeEndpoint = () =>
      ({
        createDefaultPowerTopologyClusterServer: jest.fn().mockReturnThis(),
        createDefaultElectricalPowerMeasurementClusterServer: jest.fn().mockReturnThis(),
        createDefaultElectricalEnergyMeasurementClusterServer: jest.fn().mockReturnThis(),
        name: 'test-endpoint',
      }) as any;
    const mockShelly = { id: 'shelly-test-001', log: { debug: jest.fn() } } as any;
    const hasVoltage = { hasProperty: (k: string) => k === 'voltage' } as any;
    const noProps = { hasProperty: () => false } as any;

    // entityBlackList contains 'PowerMeter' → validateEntity returns false → early return
    mockConfig.entityBlackList = ['PowerMeter'];
    const ep1 = makeEndpoint();
    (shellyPlatform as any).addElectricalMeasurements({} as any, ep1, mockShelly, hasVoltage);
    expect(ep1.createDefaultPowerTopologyClusterServer).not.toHaveBeenCalled();
    mockConfig.entityBlackList = [];

    // component has electrical property + validateEntity passes → adds 3 cluster servers
    const ep2 = makeEndpoint();
    (shellyPlatform as any).addElectricalMeasurements({} as any, ep2, mockShelly, hasVoltage);
    expect(ep2.createDefaultPowerTopologyClusterServer).toHaveBeenCalled();
    expect(ep2.createDefaultElectricalPowerMeasurementClusterServer).toHaveBeenCalled();
    expect(ep2.createDefaultElectricalEnergyMeasurementClusterServer).toHaveBeenCalled();

    // component has no electrical properties → clusters not added
    const ep3 = makeEndpoint();
    (shellyPlatform as any).addElectricalMeasurements({} as any, ep3, mockShelly, noProps);
    expect(ep3.createDefaultPowerTopologyClusterServer).not.toHaveBeenCalled();
  });

  it('should call saveStoredDevices', async () => {
    // nodeStorage not initialized → false + error log
    const originalNodeStorage = (shellyPlatform as any).nodeStorage;
    (shellyPlatform as any).nodeStorage = undefined;
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).saveStoredDevices()).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'NodeStorage is not initialized');
    (shellyPlatform as any).nodeStorage = originalNodeStorage;

    // nodeStorage initialized → true
    expect(await (shellyPlatform as any).saveStoredDevices()).toBe(true);
  });

  it('should call loadStoredDevices', async () => {
    // nodeStorage not initialized → false + error log
    const originalNodeStorage = (shellyPlatform as any).nodeStorage;
    (shellyPlatform as any).nodeStorage = undefined;
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).loadStoredDevices()).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'NodeStorage is not initialized');
    (shellyPlatform as any).nodeStorage = originalNodeStorage;

    // nodeStorage initialized → true
    expect(await (shellyPlatform as any).loadStoredDevices()).toBe(true);
  });

  it('should call addDevice', async () => {
    // Path 1: device already added → info log + return undefined
    (shelly as any)._devices.set('shellytest-ALREADY', { id: 'shellytest-ALREADY', host: '10.0.0.10' });
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-ALREADY', '10.0.0.10')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('already added'));
    (shelly as any)._devices.delete('shellytest-ALREADY');

    const createSpy = jest.spyOn(ShellyDevice, 'create' as any).mockResolvedValue(undefined);
    const shellyAddSpy = jest.spyOn(shelly, 'addDevice').mockResolvedValue(shelly as any);
    const cacheDir = path.join(matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly');
    fs.mkdirSync(cacheDir, { recursive: true });

    // Path 2: loadFromCache=true, cache file exists → device loaded from cache, setHost/cached/online set
    const cacheFilePath = path.join(cacheDir, 'shellytest-CACHE.json');
    fs.writeFileSync(cacheFilePath, '{}');
    const cacheDevice = {
      id: 'shellytest-CACHE',
      host: '10.0.0.11',
      name: 'Cache Dev',
      mac: 'AA:BB:CC',
      gen: 2,
      setHost: jest.fn(),
      destroy: jest.fn(),
      cached: false,
      online: false,
      log: { logName: '' },
    } as any;
    createSpy.mockResolvedValue(cacheDevice);
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-CACHE', '10.0.0.11')).toBe(cacheDevice);
    expect(cacheDevice.setHost).toHaveBeenCalledWith('10.0.0.11');
    expect(cacheDevice.cached).toBe(true);
    expect(cacheDevice.online).toBe(true);
    expect(shellyAddSpy).toHaveBeenCalledWith(cacheDevice);
    shellyAddSpy.mockClear();
    fs.unlinkSync(cacheFilePath);

    // Use nocacheList so loadFromCache=false for the remaining paths
    mockConfig.nocacheList = ['shellytest-GOOD', 'shellytest-FAIL', 'shellytest-FALLBACK', 'shellytest-BLACK'];

    // Path 3: create from host succeeds → saveDevicePayloads called + shelly.addDevice called
    const goodDevice = {
      id: 'shellytest-GOOD',
      host: '10.0.0.12',
      name: 'Good Dev',
      mac: 'DD:EE:FF',
      gen: 2,
      setHost: jest.fn(),
      destroy: jest.fn(),
      saveDevicePayloads: jest.fn(),
      cached: false,
      online: false,
      log: { logName: '' },
    } as any;
    createSpy.mockResolvedValue(goodDevice);
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-GOOD', '10.0.0.12')).toBe(goodDevice);
    expect(goodDevice.saveDevicePayloads).toHaveBeenCalled();
    expect(shellyAddSpy).toHaveBeenCalledWith(goodDevice);
    shellyAddSpy.mockClear();

    // Path 4: create from host fails, no fallback cache file → error log + return undefined
    createSpy.mockResolvedValue(undefined);
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-FAIL', '10.0.0.13')).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Failed to create Shelly device'));

    // Path 5: create from host fails, fallback cache file exists → device loaded from cache, setHost/cached/online set
    const fallbackFilePath = path.join(cacheDir, 'shellytest-FALLBACK.json');
    fs.writeFileSync(fallbackFilePath, '{}');
    const fallbackDevice = {
      id: 'shellytest-FALLBACK',
      host: '10.0.0.14',
      name: 'Fallback Dev',
      mac: 'GG:HH:II',
      gen: 2,
      setHost: jest.fn(),
      destroy: jest.fn(),
      cached: false,
      online: false,
      log: { logName: '' },
    } as any;
    createSpy.mockResolvedValueOnce(undefined).mockResolvedValue(fallbackDevice);
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-FALLBACK', '10.0.0.14')).toBe(fallbackDevice);
    expect(fallbackDevice.setHost).toHaveBeenCalledWith('10.0.0.14');
    expect(fallbackDevice.cached).toBe(true);
    expect(fallbackDevice.online).toBe(true);
    expect(shellyAddSpy).toHaveBeenCalledWith(fallbackDevice);
    shellyAddSpy.mockClear();
    fs.unlinkSync(fallbackFilePath);

    // Path 6: validateDevice fails (blacklisted) → device.destroy() called + return undefined
    const blacklistedDevice = {
      id: 'shellytest-BLACK',
      host: '10.0.0.15',
      name: 'Black Dev',
      mac: 'JJ:KK:LL',
      gen: 2,
      setHost: jest.fn(),
      destroy: jest.fn(),
      saveDevicePayloads: jest.fn(),
      cached: false,
      online: false,
      log: { logName: '' },
    } as any;
    createSpy.mockResolvedValue(blacklistedDevice);
    mockConfig.blackList = ['shellytest-BLACK'];
    loggerLogSpy.mockClear();
    expect(await (shellyPlatform as any).addDevice('shellytest-BLACK', '10.0.0.15')).toBeUndefined();
    expect(blacklistedDevice.destroy).toHaveBeenCalled();
    mockConfig.blackList = [];

    mockConfig.nocacheList = [];
    createSpy.mockRestore();
    shellyAddSpy.mockRestore();
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
});
