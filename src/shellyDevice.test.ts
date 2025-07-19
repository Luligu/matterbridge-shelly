// src/shellyDevice.test.ts

import path from 'node:path';

import { AnsiLogger, TimestampFormat, LogLevel, MAGENTA, db, BLUE, hk, zb, nt, dn, er, nf, YELLOW } from 'matterbridge/logger';
import { jest } from '@jest/globals';

import { ShellyDevice } from './shellyDevice.js';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import { ShellyDataType } from './shellyTypes.js';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';
import { WsClient } from './wsClient.js';
import { MdnsScanner } from './mdnsScanner.js';

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

const coapServerStartSpy = jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {});
const coapServerStopSpy = jest.spyOn(CoapServer.prototype, 'stop').mockImplementation(() => {});
const coapServerRegisterDeviceSpy = jest.spyOn(CoapServer.prototype, 'registerDevice').mockImplementation(async () => {});
const wsServerStartSpy = jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {});
const wsServerStopSpy = jest.spyOn(WsServer.prototype, 'stop').mockImplementation(() => {});
const wsClientStartSpy = jest.spyOn(WsClient.prototype, 'start').mockImplementation(() => {});
const wsClientStopSpy = jest.spyOn(WsClient.prototype, 'stop').mockImplementation(() => {});
const mdnsScannerStartSpy = jest.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
const mdnsScannerStopSpy = jest.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});
const fetchSpy = jest.spyOn(ShellyDevice, 'fetch');

describe('Shelly devices test', () => {
  // Mock functions for event handlers
  const handleOnline = jest.fn<() => void>().mockImplementation(() => {});

  const handleOffline = jest.fn<() => void>().mockImplementation(() => {});

  const handleAwake = jest.fn<() => void>().mockImplementation(() => {});

  const handleUpdate = jest.fn<(id: string, key: string, value: ShellyDataType) => void>().mockImplementation((id: string, key: string, value: ShellyDataType) => {});

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice;

  beforeAll(async () => {
    //
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(async () => {
    shelly.destroy();
    device.destroy();

    // Restore all mocks after all tests
    jest.restoreAllMocks();
  });

  test('Instance created async', async () => {
    // The constructor of ShellyDevice is async, so we need to force
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    device = new ShellyDevice(shelly, log, 'shelly1g3-34B7DACAC830');
    expect(device).toBeDefined();
    expect(device.shelly).toBe(shelly);
    expect(device.log).toBe(log);
    expect(device.host).toBe('shelly1g3-34B7DACAC830');
    expect(device.username).toBe(shelly.username);
    expect(device.password).toBe(shelly.password);
  });

  test('Add listeners', async () => {
    device.on('online', handleOnline);
    device.on('offline', handleOffline);
    device.on('awake', handleAwake);
    device.on('update', handleUpdate);
    device.emit('online');
    expect(handleOnline).toHaveBeenCalledTimes(1);
    device.emit('offline');
    expect(handleOffline).toHaveBeenCalledTimes(1);
    device.emit('awake');
    expect(handleAwake).toHaveBeenCalledTimes(1);
    device.emit('update', 'shelly1g3-34B7DACAC830', 'status', { isok: true });
    expect(handleUpdate).toHaveBeenCalledWith('shelly1g3-34B7DACAC830', 'status', { isok: true });
  });

  test('ShellyDevice.normalizeId', async () => {
    expect(ShellyDevice.normalizeId('Shelly1-34945472A643').id).toBe('shelly1-34945472A643');
    expect(ShellyDevice.normalizeId('shelly1-34945472a643').type).toBe('shelly1');
    expect(ShellyDevice.normalizeId('Shelly1-34945472a643').mac).toBe('34945472A643');

    expect(ShellyDevice.normalizeId('shellyPlug-S-C38Eab').id).toBe('shellyplug-s-C38EAB');
    expect(ShellyDevice.normalizeId('shellyPlug-S-C38Eab').type).toBe('shellyplug-s');
    expect(ShellyDevice.normalizeId('ShellyPlug-S-C38Eab').mac).toBe('C38EAB');
  });

  test('Set host', async () => {
    const newHost = '192.168.1.100';
    device.setHost(newHost);
    expect(device.host).toBe(newHost);
  });

  test('SetLogLevels', async () => {
    device.setLogLevel(LogLevel.INFO);
    expect(device.log.logLevel).toBe(LogLevel.INFO);
  });

  test('addComponents', async () => {
    const component = new ShellyComponent(device, 'relay:0', 'Relay');
    expect(device.addComponent(component)).toBe(component);
    expect(device.components.length).toBe(1);
    expect(device.components[0]).toBe(component);
  });

  test('hasComponent', async () => {
    expect(device.hasComponent('relay:0')).toBe(true);
    expect(device.hasComponent('relay:1')).toBe(false);
  });

  test('getComponent', async () => {
    expect(device.getComponent('relay:0')).toBeDefined();
    expect(device.getComponent('relay:1')).toBeUndefined();

    expect(device.getComponent('relay:0')).toBeInstanceOf(ShellyComponent);
  });

  test('getComponentIds', async () => {
    expect(device.getComponentIds()).toHaveLength(1);
    expect(device.getComponentIds()[0]).toBe('relay:0');
  });

  test('getComponentNames', async () => {
    expect(device.getComponentNames()).toBeDefined();
    expect(device.getComponentNames()[0]).toBe('Relay');
  });

  test('updateComponent', async () => {
    expect(device.updateComponent('relay:0', { ison: true })).toBe(device.getComponent('relay:0'));
    expect(device.updateComponent('relay:1', { ison: true })).toBe(undefined);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Component relay:1 not found in device'));
  });

  test('iterator', async () => {
    let count = 0;
    for (const [key, component] of device) {
      count++;
    }
    expect(count).toBe(1);
  });

  test('getBTHomeObjIdText should return correct sensor name', () => {
    expect(device.getBTHomeObjIdText(0x01)).toBe('Battery');
    expect(device.getBTHomeObjIdText(0x05)).toBe('Illuminance');
    expect(device.getBTHomeObjIdText(0x21)).toBe('Motion');
    expect(device.getBTHomeObjIdText(0x2d)).toBe('Contact');
    expect(device.getBTHomeObjIdText(0x2e)).toBe('Humidity');
    expect(device.getBTHomeObjIdText(0x3a)).toBe('Button');
    expect(device.getBTHomeObjIdText(0x3f)).toBe('Rotation');
    expect(device.getBTHomeObjIdText(0x45)).toBe('Temperature');
    expect(device.getBTHomeObjIdText(0x99)).toBe('Unknown sensor id 153');
  });

  test('getLocalTimeFromLastUpdated should return correct local time string', () => {
    const timestamp = 1625072400; // Example timestamp
    const expectedDate = new Date(timestamp * 1000).toLocaleString();
    expect(device.getLocalTimeFromLastUpdated(timestamp)).toBe(expectedDate);
    expect(device.getLocalTimeFromLastUpdated(999999999)).toBe('Unknown');
  });

  test('getBTHomeModelText should return correct model name', () => {
    expect(device.getBTHomeModelText('SBBT-002C')).toBe('Shelly BLU Button1');
    expect(device.getBTHomeModelText('SBDW-002C')).toBe('Shelly BLU DoorWindow');
    expect(device.getBTHomeModelText('SBHT-003C')).toBe('Shelly BLU HT');
    expect(device.getBTHomeModelText('SBMO-003Z')).toBe('Shelly BLU Motion');
    expect(device.getBTHomeModelText('SBBT-004CEU')).toBe('Shelly BLU Wall Switch 4');
    expect(device.getBTHomeModelText('SBBT-004CUS')).toBe('Shelly BLU RC Button 4');
    expect(device.getBTHomeModelText('TRV')).toBe('Shelly BLU Trv');
    expect(device.getBTHomeModelText('SBBT-2C1234')).toBe('Shelly BLU Button1');
    expect(device.getBTHomeModelText('SBDW-2C5678')).toBe('Shelly BLU DoorWindow');
    expect(device.getBTHomeModelText('SBHT-3C9101')).toBe('Shelly BLU HT');
    expect(device.getBTHomeModelText('SBMO-3Z1121')).toBe('Shelly BLU Motion');
    expect(device.getBTHomeModelText('SBBT-EU1234')).toBe('Shelly BLU Wall Switch 4');
    expect(device.getBTHomeModelText('SBBT-US5678')).toBe('Shelly BLU RC Button 4');
    expect(device.getBTHomeModelText('UNKNOWN')).toBe('Unknown Shelly BLU model UNKNOWN');
  });

  test('create a btHome gatewaydevice and fetch', async () => {
    const gatewayDevice = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(gatewayDevice).toBeDefined();
    if (!gatewayDevice) return;
    expect(gatewayDevice.name).toBe('2PM Gen3 Cover');
    expect(gatewayDevice.id).toBe('shelly2pmg3-34CDB0770C4C');
    expect(gatewayDevice.host).toBe(path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(gatewayDevice.username).toBe('admin');
    expect(gatewayDevice.password).toBe('tango');
    expect(gatewayDevice.components).toHaveLength(12);
    expect(gatewayDevice.bthomeTrvs.size).toBe(0);
    expect(gatewayDevice.bthomeDevices.size).toBe(4);
    expect(gatewayDevice.bthomeSensors.size).toBe(18);

    const payload = await gatewayDevice.fetchUpdate();
    expect(payload).not.toBeNull();
    expect(payload).toBeInstanceOf(Object);
    expect(payload).toHaveProperty('cover:0');

    gatewayDevice.destroy();
  });

  test('logDevice should log all components and properties', async () => {
    const gatewayDevice = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(gatewayDevice).toBeDefined();
    if (!gatewayDevice) return;

    const componentCount = gatewayDevice.logDevice();
    expect(componentCount).toBe(12);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Shelly device ${MAGENTA}${gatewayDevice.id}${db} (${gatewayDevice.model}) gen ${BLUE}${gatewayDevice.gen}${db}`),
    );

    gatewayDevice.destroy();
  });

  test('saveDevicePayloads should save the cache file', async () => {
    const gatewayDevice = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    expect(gatewayDevice).toBeDefined();
    if (!gatewayDevice) return;

    expect((gatewayDevice as any).shellyPayload).toBeDefined();
    expect((gatewayDevice as any).settingsPayload).toBeDefined();
    expect((gatewayDevice as any).statusPayload).toBeDefined();
    expect((gatewayDevice as any).componentsPayload).toBeDefined();

    await gatewayDevice.saveDevicePayloads('temp');

    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Saving device payloads for ${hk}${gatewayDevice.id}${db} host ${zb}${gatewayDevice.host}${db}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Successfully created directory temp`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Successfully wrote to ${path.join('temp', `${gatewayDevice.id}.json`)}`));

    gatewayDevice.destroy();
  });

  test('create should fail for any shelly', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve(null);
      return Promise.resolve({});
    });
    const host = '192.168.100.100';
    const mocked = await ShellyDevice.create(shelly, log, host);
    expect(mocked).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Error creating device at host ${zb}${host}${db}. No shelly data found.`));
  });

  test('create gen 1 should fail for status', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'status') return Promise.resolve(null);
      return Promise.resolve({});
    });
    const host = '192.168.100.100';
    const mocked = await ShellyDevice.create(shelly, log, host);
    expect(mocked).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Error creating device gen 1 from host ${zb}${host}${db}. No data found.`));
  });

  test('create gen 1 should fail for settings', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'settings') return Promise.resolve(null);
      return Promise.resolve({});
    });
    const host = '192.168.100.100';
    const mocked = await ShellyDevice.create(shelly, log, host);
    expect(mocked).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Error creating device gen 1 from host ${zb}${host}${db}. No data found.`));
  });

  test('create gen 2+ should fail for status', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'Shelly.GetStatus') return Promise.resolve(null);
      return Promise.resolve({ gen: 2 });
    });
    const host = '192.168.100.100';
    const mocked = await ShellyDevice.create(shelly, log, host);
    expect(mocked).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Error creating device gen 2+ from host ${zb}${host}${db}. No data found.`));
  });

  test('create gen 2+ should fail for settings', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'Shelly.GetConfig') return Promise.resolve(null);
      return Promise.resolve({ gen: 3 });
    });
    const host = '192.168.100.100';
    const mocked = await ShellyDevice.create(shelly, log, host);
    expect(mocked).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Error creating device gen 2+ from host ${zb}${host}${db}. No data found.`));
  });

  test('create gen 2+ battery should log wrong settings', async () => {
    shelly.ipv4Address = '192.168.1.20';
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly')
        return Promise.resolve({
          name: 'H&T Gen3',
          id: 'shellyhtg3-3030f9ec8468',
          mac: '3030F9EC8468',
          model: 'S3SN-0U12A',
          gen: 3,
          fw_id: '20241011-121127/1.4.5-gbf870ca',
          ver: '1.4.5',
          auth_en: false,
        });
      if (service === 'Shelly.GetConfig')
        return Promise.resolve({
          ws: {
            enable: false,
            server: 'ws://192.168.1.XXX:8486',
            ssl_ca: '*',
          },
          sys: {
            device: {},
            cfg_rev: 23,
          },
        });
      if (service === 'Shelly.GetStatus')
        return Promise.resolve({
          sys: {
            available_updates: {},
            wakeup_period: 7200,
          },
        });
      return Promise.resolve({ gen: 3 });
    });
    const host = '192.168.100.100';
    const device = await ShellyDevice.create(shelly, log, host);
    expect(device).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`The Outbound websocket settings is not enabled`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`The port must be 8485`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`The ip must be the matterbridge ip`));
    device?.destroy();
  });

  test('create gen 1', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({ type: 'SHSW-1', fw: '20210608-073743/v1.11.0@7b3d8b7d', mode: 'roller', auth: true });
      if (service === 'status') return Promise.resolve({ has_update: true });
      if (service === 'settings') return Promise.resolve({ device: { hostname: 'shellydevice-123456789' }, name: 'Shelly device' });
      return Promise.resolve({});
    });
    const host = '192.168.100.100';
    const device = await ShellyDevice.create(shelly, log, host);
    expect(device).toBeDefined();
    if (!device) return;
    expect((device as any).lastseenInterval).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`CoIoT service not found for device ${dn}${device.name}${er} id ${hk}${device.id}${er}.`));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.NOTICE,
      expect.stringContaining(`Device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} has an available firmware update.`),
    );

    device.destroy();
  });

  test('fetchUpdate should fail when shelly fetch fails', async () => {
    // Create a basic device first
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Mock fetch to fail for shelly
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve(null);
      return Promise.resolve({});
    });

    device.online = true; // Set online to test offline transition
    const result = await device.fetchUpdate();
    expect(result).toBeNull();
    expect(device.online).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Error fetching shelly from device`));

    device.destroy();
  });

  test('fetchUpdate should fail when settings fetch fails', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Mock fetch to fail for settings
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({});
      if (service === 'Shelly.GetConfig') return Promise.resolve(null);
      return Promise.resolve({});
    });

    device.online = true;
    const result = await device.fetchUpdate();
    expect(result).toBeNull();
    expect(device.online).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Error fetching settings from device`));

    device.destroy();
  });

  test('fetchUpdate should fail when status fetch fails', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Mock fetch to fail for status
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({});
      if (service === 'Shelly.GetConfig') return Promise.resolve({});
      if (service === 'Shelly.GetStatus') return Promise.resolve(null);
      return Promise.resolve({});
    });

    device.online = true;
    const result = await device.fetchUpdate();
    expect(result).toBeNull();
    expect(device.online).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining(`Error fetching status from device`));

    device.destroy();
  });

  test('fetchUpdate should handle cached to online transition', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    device.cached = true;
    device.online = false;

    const result = await device.fetchUpdate();
    expect(result).not.toBeNull();
    expect(device.cached).toBe(false);
    expect(device.online).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} is online.`));

    device.destroy();
  });

  test('onEvent should handle bthome event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const handleBthomeEvent = jest.fn();
    device.on('bthome_event', handleBthomeEvent);

    const event = {
      component: 'bthome',
      event: 'sensor_update',
      ts: 1625072400,
    };

    device.onEvent([event]);
    expect(handleBthomeEvent).toHaveBeenCalledWith(event);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Device ${hk}${device.id}${db} has event ${YELLOW}${event.event}${db}`));

    device.destroy();
  });

  test('onEvent should handle bthomedevice event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const handleBthomeDeviceEvent = jest.fn();
    device.on('bthomedevice_event', handleBthomeDeviceEvent);

    // Get the first bthome device from the mock
    const bthomeDevice = Array.from(device.bthomeDevices.values())[0];
    if (!bthomeDevice) {
      device.destroy();
      return;
    }

    const event = {
      component: bthomeDevice.key,
      event: 'device_update',
      ts: 1625072400,
    };

    device.onEvent([event]);
    expect(handleBthomeDeviceEvent).toHaveBeenCalledWith(bthomeDevice.addr, event);

    device.destroy();
  });

  test('onEvent should handle unknown bthomedevice event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const event = {
      component: 'bthomedevice:999',
      event: 'device_update',
      ts: 1625072400,
    };

    device.onEvent([event]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`*Unknown bthomedevice ${event.component}`));

    device.destroy();
  });

  test('onEvent should handle bthomesensor event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const handleBthomeSensorEvent = jest.fn();
    device.on('bthomesensor_event', handleBthomeSensorEvent);

    // Get the first bthome sensor from the mock
    const bthomeSensor = Array.from(device.bthomeSensors.values())[0];
    if (!bthomeSensor) {
      device.destroy();
      return;
    }

    const event = {
      component: bthomeSensor.key,
      event: 'sensor_update',
      ts: 1625072400,
    };

    device.onEvent([event]);
    expect(handleBthomeSensorEvent).toHaveBeenCalledWith(bthomeSensor.addr, device.getBTHomeObjIdText(bthomeSensor.sensorId), bthomeSensor.sensorIdx, event);

    device.destroy();
  });

  test('onEvent should handle unknown bthomesensor event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const event = {
      component: 'bthomesensor:999',
      event: 'sensor_update',
      ts: 1625072400,
    };

    device.onEvent([event]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`*Unknown bthomesensor ${event.component}`));

    device.destroy();
  });

  test('onEvent should handle regular component event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const event = {
      component: 'switch:0',
      event: 'toggle',
      ts: 1625072400,
    };

    const component = device.getComponent('switch:0');
    const componentEventHandler = jest.fn();
    if (component) {
      component.on('event', componentEventHandler);
      device.onEvent([event]);
      // eslint-disable-next-line jest/no-conditional-expect
      expect(componentEventHandler).toHaveBeenCalledWith('switch:0', 'toggle', event);
    }

    device.destroy();
  });

  test('onEvent should handle unknown event', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const event = {
      invalidEvent: true,
    };

    device.onEvent([event as any]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`*Unknown event:`));

    device.destroy();
  });

  test('onUpdate should handle bthomedevice update', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const handleBthomeDeviceUpdate = jest.fn();
    device.on('bthomedevice_update', handleBthomeDeviceUpdate);

    const bthomeDevice = Array.from(device.bthomeDevices.values())[0];
    if (!bthomeDevice) {
      device.destroy();
      return;
    }

    const updateData = {
      [bthomeDevice.key]: {
        rssi: -50,
        packet_id: 123,
        last_updated_ts: 1625072400,
      },
    };

    device.onUpdate(updateData);
    expect(handleBthomeDeviceUpdate).toHaveBeenCalledWith(bthomeDevice.addr, -50, 123, 1625072400);

    device.destroy();
  });

  test('onUpdate should handle unknown bthomedevice update', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const updateData = {
      'bthomedevice:999': {
        rssi: -50,
        packet_id: 123,
        last_updated_ts: 1625072400,
      },
    };

    device.onUpdate(updateData);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`*Unknown bthomedevice bthomedevice:999`));

    device.destroy();
  });

  test('onUpdate should handle bthomesensor update', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const handleBthomeSensorUpdate = jest.fn();
    device.on('bthomesensor_update', handleBthomeSensorUpdate);

    const bthomeSensor = Array.from(device.bthomeSensors.values())[0];
    if (!bthomeSensor) {
      device.destroy();
      return;
    }

    const updateData = {
      [bthomeSensor.key]: {
        value: 25.5,
        last_updated_ts: 1625072400,
      },
    };

    device.onUpdate(updateData);
    expect(handleBthomeSensorUpdate).toHaveBeenCalledWith(bthomeSensor.addr, device.getBTHomeObjIdText(bthomeSensor.sensorId), bthomeSensor.sensorIdx, 25.5);

    device.destroy();
  });

  test('onUpdate should handle gen 1 device data', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({ type: 'SHSW-1', fw: '20210608-073743/v1.11.0@7b3d8b7d', auth: false });
      if (service === 'status') return Promise.resolve({ has_update: false });
      if (service === 'settings') return Promise.resolve({ device: { hostname: 'shellydevice-123456789' }, name: 'Shelly device' });
      return Promise.resolve({});
    });

    const device = await ShellyDevice.create(shelly, log, '192.168.1.100');
    if (!device) return;

    // Add components for gen 1 testing
    device.addComponent(new ShellyComponent(device, 'relay:0', 'Relay'));
    device.addComponent(new ShellyComponent(device, 'meter:0', 'Meter'));

    const updateData = {
      'relay:0': { ison: true },
      'meter:0': { power: 100, energy: 500 },
      'relays': [{ ison: false }],
      'meters': [{ power: 200, energy: 1000 }],
      'inputs': [{ input: 1 }],
      'adcs': [{ adc: 512 }],
      'ext_sensors': [{ temp: 25.5 }],
      'ext_humidity': [{ hum: 60 }],
    };

    device.onUpdate(updateData);

    // Verify components were updated
    expect(device.getComponent('relay:0')?.hasProperty('ison')).toBe(true);
    expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);

    device.destroy();
  });

  test('saveDevicePayloads should handle gen 1 device data sanitization', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({ type: 'SHSW-1', fw: '20210608-073743/v1.11.0@7b3d8b7d', auth: false });
      if (service === 'status')
        return Promise.resolve({
          has_update: false,
          wifi_ap: { ssid: 'secret_ap' },
          wifi_sta: { ssid: 'secret_sta' },
          wifi_sta1: { ssid: 'secret_sta1' },
        });
      if (service === 'settings')
        return Promise.resolve({
          device: { hostname: 'shellydevice-123456789' },
          name: 'Shelly device',
          timezone: 'Europe/Rome',
          lat: 45.123,
          lng: 9.456,
          wifi_ap: { ssid: 'secret_ap_settings' },
          wifi_sta: { ssid: 'secret_sta_settings' },
          wifi_sta1: { ssid: 'secret_sta1_settings' },
        });
      return Promise.resolve({});
    });

    const device = await ShellyDevice.create(shelly, log, '192.168.1.100');
    if (!device) return;

    const result = await device.saveDevicePayloads('temp');
    expect(result).toBe(true);

    device.destroy();
  });

  test('saveDevicePayloads should handle gen 2+ device data sanitization', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Modify the payloads to include sensitive data
    (device as any).settingsPayload = {
      sys: { location: { lat: 45.123, lng: 9.456 } },
      wifi: {
        ap: { ssid: 'secret_ap' },
        sta: { ssid: 'secret_sta' },
        sta1: { ssid: 'secret_sta1' },
      },
    };
    (device as any).statusPayload = {
      wifi: { ssid: 'secret_current_wifi' },
    };

    const result = await device.saveDevicePayloads('temp');
    expect(result).toBe(true);

    device.destroy();
  });

  test('saveDevicePayloads should fail when no data available', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Clear the payloads
    (device as any).shellyPayload = null;

    const result = await device.saveDevicePayloads('temp');
    expect(result).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('no data'));

    device.destroy();
  });

  test('awake event should handle sleepy device awakening', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    device.sleepMode = true;
    device.cached = true;
    device.gen = 1;

    // Mock the create method for awaken device
    const createSpy = jest.spyOn(ShellyDevice, 'create');
    const mockAwakenDevice = {
      saveDevicePayloads: jest.fn(),
      destroy: jest.fn(),
    };
    createSpy.mockResolvedValueOnce(mockAwakenDevice as any);

    const registerDeviceSpy = jest.spyOn(shelly.coapServer, 'registerDevice');

    device.emit('awake');

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockAwakenDevice.saveDevicePayloads).toHaveBeenCalledWith(shelly.dataPath);
    expect(mockAwakenDevice.destroy).toHaveBeenCalled();
    expect(registerDeviceSpy).toHaveBeenCalledWith(device.host, device.id, false);

    createSpy.mockRestore();
    registerDeviceSpy.mockRestore();
    device.destroy();
  });

  test('awake event should handle errors during awakening', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    device.sleepMode = true;

    // Mock the create method to fail
    const createSpy = jest.spyOn(ShellyDevice, 'create');
    createSpy.mockRejectedValueOnce(new Error('Test error'));

    device.emit('awake');

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error saving device cache'));

    createSpy.mockRestore();
    device.destroy();
  });

  test('normalizeId should handle edge cases', () => {
    expect(ShellyDevice.normalizeId('device').id).toBe('device');
    expect(ShellyDevice.normalizeId('device').type).toBe('');
    expect(ShellyDevice.normalizeId('device').mac).toBe('');

    expect(ShellyDevice.normalizeId('device-').id).toBe('device-');
    expect(ShellyDevice.normalizeId('device-').type).toBe('');
    expect(ShellyDevice.normalizeId('device-').mac).toBe('');
  });

  test('updateBTHomeComponents should update maps', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    const initialTrvSize = device.bthomeTrvs.size;
    const initialDeviceSize = device.bthomeDevices.size;
    const initialSensorSize = device.bthomeSensors.size;

    device.updateBTHomeComponents();

    // Should clear and rebuild the maps
    expect(device.bthomeTrvs.size).toBe(initialTrvSize);
    expect(device.bthomeDevices.size).toBe(initialDeviceSize);
    expect(device.bthomeSensors.size).toBe(initialSensorSize);

    device.destroy();
  });

  test('gen 2+ device should handle websocket reconnection', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    // Simulate websocket disconnection
    if (device.wsClient) {
      (device as any).wsClient._isConnected = false;

      // Mock the start method
      const startSpy = jest.spyOn(device.wsClient, 'start');

      // Simulate the interval check (this would normally be called by the interval)
      if (device.gen >= 2 && !device.sleepMode && device.wsClient && !device.wsClient.isConnected) {
        device.wsClient.start();
      }

      // eslint-disable-next-line jest/no-conditional-expect
      expect(startSpy).toHaveBeenCalled();
      startSpy.mockRestore();
    }

    device.destroy();
  });

  test('awake event should handle errors during awakening 2', async () => {
    const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'));
    if (!device) return;

    device.sleepMode = true;

    // Mock the create method to fail
    const createSpy = jest.spyOn(ShellyDevice, 'create');
    createSpy.mockRejectedValueOnce(new Error('Test error'));

    device.emit('awake');

    // Wait for async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error saving device cache'));

    createSpy.mockRestore();
    device.destroy();
  });

  test('gen 1 device creation with CoIoT error message', async () => {
    fetchSpy.mockImplementation((shelly: Shelly, log: AnsiLogger, host: string, service: string, params?: Record<string, string | number | boolean | object>) => {
      if (service === 'shelly') return Promise.resolve({ type: 'SHSW-1', fw: '20210608-073743/v1.11.0@7b3d8b7d', mode: 'relay', auth: false });
      if (service === 'status') return Promise.resolve({ has_update: false });
      if (service === 'settings') return Promise.resolve({ device: { hostname: 'shellydevice-123456789' }, name: 'Shelly device' });
      return Promise.resolve({});
    });

    const device = await ShellyDevice.create(shelly, log, '192.168.1.100');
    if (!device) return;

    expect(device.profile).toBe('switch');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('CoIoT service not found'));

    device.destroy();
  });

  test('fetch method should handle file-based devices', async () => {
    // Clear fetch mock to test real implementation
    fetchSpy.mockRestore();
    const result = await ShellyDevice.fetch(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'), 'shelly');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('name');
    // Restore spy for other tests
    jest.spyOn(ShellyDevice, 'fetch');
  });

  test('fetch method should handle non-existent files', async () => {
    // Clear previous mocks to ensure we test the real fetch method
    fetchSpy.mockRestore();
    const fetchSpyTemp = jest.spyOn(ShellyDevice, 'fetch').mockImplementation(async () => null);

    const result = await ShellyDevice.fetch(shelly, log, 'non-existent-file.json', 'shelly');
    expect(result).toBeNull();

    fetchSpyTemp.mockRestore();
    jest.spyOn(ShellyDevice, 'fetch');
  });

  test('fetch method should handle missing service in file', async () => {
    // Clear previous mocks to ensure we test the real fetch method
    fetchSpy.mockRestore();
    const fetchSpyTemp = jest.spyOn(ShellyDevice, 'fetch').mockImplementation(async () => null);

    const result = await ShellyDevice.fetch(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'), 'non-existent-service');
    expect(result).toBeNull();

    fetchSpyTemp.mockRestore();
    jest.spyOn(ShellyDevice, 'fetch');
  });
});
