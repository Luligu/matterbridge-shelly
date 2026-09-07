/**
 * @file vitest/shellyComponent.test.ts
 * @description This file contains the tests for the ShellyComponent class.
 * @author Luca Liguori
 */

const NAME = 'ShellyComponent';

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { setupTest } from 'matterbridge/vitest-utils';
import type { MockInstance } from 'vitest';

import { Shelly } from '../src/shelly.js';
import {
  isCloudComponent,
  isCoverComponent,
  isLightComponent,
  isMatterComponent,
  isSwitchComponent,
  isSysComponent,
  isWsComponent,
  isWifiComponent,
  ShellyComponent,
  type ShellyCoverComponent,
  type ShellyLightComponent,
  type ShellySwitchComponent,
} from '../src/shellyComponent.js';
import { ShellyDevice } from '../src/shellyDevice.js';
import { shellyFetch } from '../src/shellyFetch.js';
import { ShellyProperty } from '../src/shellyProperty.js';
import type { ShellyData, ShellyDataType } from '../src/shellyTypes.js';

// Setup the test environment
await setupTest(NAME, false);

vi.mock('../src/shellyFetch.js', { spy: true });

describe('ShellyComponent', () => {
  let fetchSpy: MockInstance<typeof shellyFetch>;

  const log = new AnsiLogger({ logName: 'shellyComponentTest', logTimestampFormat: TimestampFormat.TIME_MILLIS });
  const shelly = new Shelly(log);
  let device1: ShellyDevice;
  let device2: ShellyDevice;
  let device3: ShellyDevice;

  let id: string;
  let name: string;
  let data: ShellyData;

  const handleUpdate = vi.fn<(component: string, key: string, data: ShellyDataType) => void>().mockImplementation((component, key, data) => {});

  const handleEvent = vi.fn<(component: string, key: string, data: ShellyDataType) => void>().mockImplementation((component, key, data) => {});

  beforeAll(async () => {
    const mockDevice1 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
    const mockDevice2 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'), 11400);
    const mockDevice3 = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplusrgbwpm-A0A3B35C7024.json'));
    if (mockDevice1) device1 = mockDevice1;
    if (mockDevice2) device2 = mockDevice2;
    if (mockDevice3) device3 = mockDevice3;

    fetchSpy = vi
      .mocked(shellyFetch)
      .mockImplementation(async (shelly: Shelly, log: AnsiLogger, host: string, port: number, service: string, params?: Record<string, string | number | boolean | object>) => {
        // console.error(`shellyFetch: ${host} ${service} ${stringify(params ?? {})}`);
        return {};
      });
  });

  beforeEach(async () => {
    // Initialize variables here
    id = 'testId';
    name = 'testName';
    data = { key1: 'value', key2: 123, key3: true };

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset variables here
  });

  afterAll(() => {
    shelly.destroy();
    device1.destroy();
    device2.destroy();
    device3.destroy();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should send a Gen 2 color temperature command when ct is available', () => {
    const component = new ShellyComponent(device2, 'cct:0', 'Cct', { ct: 2700 }) as ShellyLightComponent;
    component.ColorTemp(4000);
    expect(fetchSpy).toHaveBeenCalledWith(device2.shelly, device2.log, device2.host, device2.port, 'Cct.Set', { id: 0, ct: 4000 });
  });

  it('should have mock gen 1 and gen 2', () => {
    expect(device1).not.toBeUndefined();
    expect(device2).not.toBeUndefined();
    expect(device3).not.toBeUndefined();
  });

  it('should expose WiFi methods only on Gen 2+ WiFi components', () => {
    expect(isWifiComponent(device2.getComponent('missing'))).toBe(false);
    expect(isWifiComponent(device2.getComponent('cloud'))).toBe(false);
    const gen1 = new ShellyComponent(device1, 'wifi_sta', 'WiFi');
    expect(isWifiComponent(gen1)).toBe(false);
    expect('Scan' in gen1).toBe(false);
    for (const id of ['wifi_ap', 'wifi_sta', 'wifi_sta1']) expect(isWifiComponent(device2.getComponent(id))).toBe(true);
  });

  it('should validate WiFi configuration and status from every Gen 2+ device fixture', async () => {
    const component = device2.getComponent('wifi_sta');
    if (!isWifiComponent(component)) throw new Error('Missing WiFi component');
    let count = 0;
    for (const file of await fs.readdir(path.join('src', 'mock'))) {
      if (!file.endsWith('.json')) continue;
      const payload = JSON.parse(await fs.readFile(path.join('src', 'mock', file), 'utf8'));
      if (!(payload.shelly?.gen >= 2) || !payload.settings?.wifi || !payload.status?.wifi) continue;
      fetchSpy.mockResolvedValueOnce(payload.settings.wifi);
      expect(await component.GetConfig()).toEqual(payload.settings.wifi);
      fetchSpy.mockResolvedValueOnce(payload.status.wifi);
      expect(await component.GetStatus()).toEqual(payload.status.wifi);
      count++;
    }
    expect(count).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Wifi.GetStatus');
  });

  it('should send partial WiFi updates and read scans and range extender clients', async () => {
    const component = device2.getComponent('wifi_ap');
    if (!isWifiComponent(component)) throw new Error('Missing WiFi component');
    const config = { ap: { range_extender: { enable: true } }, sta: { ssid: 'test-network', pass: 'test-password' } };
    const payload = JSON.parse(await fs.readFile(path.join('src', 'mock', 'shellypstripg4-D885ACE52518.json'), 'utf8'));
    const extenderConfig = { ...payload.settings.wifi, ap: { ssid: '', is_open: false, enable: true, range_extender: { enable: true } } };
    fetchSpy.mockResolvedValueOnce(extenderConfig);
    expect(await component.GetConfig()).toEqual(extenderConfig);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Wifi.GetConfig');
    fetchSpy.mockResolvedValueOnce({ restart_required: false });
    expect(await component.SetConfig(config)).toEqual({ restart_required: false });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Wifi.SetConfig', { config });
    const result = { ssid: null, bssid: '00:11:22:33:44:55', auth: 3, channel: 4, rssi: -56 };
    for (const results of [[], [result], [result, { ...result, auth: 6 }]]) {
      fetchSpy.mockResolvedValueOnce({ results });
      expect(await component.Scan()).toEqual({ results });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Wifi.Scan');
    }
    const client = { mac: 'e4:b0:63:d6:45:78', ip: '192.168.33.32', ip_static: false, mport: 11400, since: 1790013819 };
    for (const response of [
      { ts: 1790013988, ap_clients: [client] },
      { ts: null, ap_clients: [] },
    ]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.ListAPClients()).toEqual(response);
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Wifi.ListAPClients');
    }
    const status = {
      sta_ip: '192.168.68.58',
      status: 'got ip',
      ssid: '',
      channel: 4,
      rssi: -56,
      bssid: '20:23:51:59:e7:ac',
      ap_client_count: 1,
      sta_ip6: ['fe80::da85:acff:fee5:2518'],
    };
    fetchSpy.mockResolvedValueOnce(status);
    expect(await component.GetStatus()).toEqual(status);
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.SetConfig({})).toBeNull();
  });

  it('should reject invalid WiFi responses', async () => {
    const component = device2.getComponent('wifi_sta');
    if (!isWifiComponent(component)) throw new Error('Missing WiFi component');
    const station = { enable: true, is_open: false, ssid: null, ipv4mode: 'dhcp', ip: null, netmask: null, gw: null, nameserver: null };
    for (const config of [
      null,
      {},
      { sta: {} },
      { sta: station, sta1: {} },
      { sta: station, ap: {} },
      { sta: station, ap: { enable: true, is_open: true, ssid: 1 } },
      { sta: station, ap: { enable: true, is_open: true, range_extender: {} } },
      { sta: station, roam: {} },
    ]) {
      fetchSpy.mockResolvedValueOnce(config);
      expect(await component.GetConfig()).toBeNull();
    }
    const base = { sta_ip: null, ssid: null, status: 'disconnected', rssi: 0 };
    for (const status of [null, {}, { ...base, status: 'invalid' }, { ...base, bssid: 1 }, { ...base, channel: '4' }, { ...base, netmask: false }, { ...base, sta_ip6: [1] }]) {
      fetchSpy.mockResolvedValueOnce(status);
      expect(await component.GetStatus()).toBeNull();
    }
    for (const response of [null, {}, { results: [null] }, { results: [{ ssid: 'test', bssid: 'test', auth: 7, channel: 4, rssi: -50 }] }]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.Scan()).toBeNull();
    }
    for (const response of [
      null,
      {},
      { ts: 'now', ap_clients: [] },
      { ts: null, ap_clients: [null] },
      { ts: null, ap_clients: [{ mac: 'test', ip: 'test', ip_static: false, mport: -1, since: 0 }] },
    ]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.ListAPClients()).toBeNull();
    }
  });

  it('should identify native Matter components and reject unsupported components', () => {
    expect(isMatterComponent(device2.getComponent('missing'))).toBe(false);
    expect(isMatterComponent(device2.getComponent('cloud'))).toBe(false);
    const component = new ShellyComponent(device1, 'matter', 'Matter');
    expect(isMatterComponent(component)).toBe(false);
    expect('FactoryReset' in component).toBe(false);
    expect(isMatterComponent(new ShellyComponent(device2, 'matter', 'Matter'))).toBe(true);
  });

  it('should call native Matter RPC methods and preserve pairing code strings', async () => {
    const component = new ShellyComponent(device2, 'matter', 'Matter');
    if (!isMatterComponent(component)) throw new Error('Missing Matter component');
    for (const enable of [true, false]) {
      fetchSpy.mockResolvedValueOnce({ enable });
      expect(await component.GetConfig()).toEqual({ enable });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Matter.GetConfig');
      fetchSpy.mockResolvedValueOnce({ restart_required: false });
      expect(await component.SetConfig({ enable })).toEqual({ restart_required: false });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Matter.SetConfig', { config: { enable } });
    }
    for (const status of [
      { num_fabrics: 0, commissionable: true },
      { num_fabrics: 1, commissionable: false },
    ]) {
      fetchSpy.mockResolvedValueOnce(status);
      expect(await component.GetStatus()).toEqual(status);
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Matter.GetStatus');
    }
    const codes = { qr_code: 'MT:00000O-O03.3QG5.000', manual_code: '00576700759' };
    fetchSpy.mockResolvedValueOnce(codes);
    expect(await component.GetSetupCode()).toEqual(codes);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Matter.GetSetupCode');
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.FactoryReset()).toBeNull();
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Matter.FactoryReset');
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.SetConfig({ enable: false })).toBeNull();
  });

  it('should return null for invalid or missing Matter responses', async () => {
    const component = new ShellyComponent(device2, 'matter', 'Matter');
    if (!isMatterComponent(component)) throw new Error('Missing Matter component');
    for (const response of [null, {}, { enable: 'true' }]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.GetConfig()).toBeNull();
    }
    for (const response of [null, {}, { num_fabrics: -1, commissionable: false }, { num_fabrics: 0.5, commissionable: false }, { num_fabrics: 0, commissionable: 'true' }]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.GetStatus()).toBeNull();
    }
    for (const response of [null, {}, { qr_code: 'MT:test', manual_code: 123 }]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.GetSetupCode()).toBeNull();
    }
  });

  it('should identify only Gen 2+ Ws components', () => {
    expect(isWsComponent(device2.getComponent('missing'))).toBe(false);
    expect(isWsComponent(device2.getComponent('cloud'))).toBe(false);
    const gen1 = new ShellyComponent(device1, 'ws', 'Ws');
    expect(isWsComponent(gen1)).toBe(false);
    expect('GetStatus' in gen1).toBe(false);
    expect(isWsComponent(device2.getComponent('ws'))).toBe(true);
  });

  it('should read Ws settings and status and send partial configuration', async () => {
    const component = device2.getComponent('ws');
    if (!isWsComponent(component)) throw new Error('Missing Ws component');
    for (const ssl_ca of ['*', 'user_ca.pem', 'ca.pem'] as const) {
      for (const server of ['wss://example.com/rpc', null, undefined]) {
        fetchSpy.mockResolvedValueOnce({ enable: false, server, ssl_ca });
        expect(await component.GetConfig()).toStrictEqual({ enable: false, server, ssl_ca });
        expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Ws.GetConfig');
      }
      fetchSpy.mockResolvedValueOnce({ restart_required: true });
      expect(await component.SetConfig({ ssl_ca })).toEqual({ restart_required: true });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Ws.SetConfig', { config: { ssl_ca } });
    }
    const config = { enable: false, server: null, ignored: true };
    await component.SetConfig(config);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Ws.SetConfig', { config: { enable: false, server: null } });
    for (const connected of [true, false]) {
      fetchSpy.mockResolvedValueOnce({ connected });
      expect(await component.GetStatus()).toEqual({ connected });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Ws.GetStatus');
    }
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.SetConfig({ enable: true })).toBeNull();
  });

  it('should return null for missing or invalid Ws responses', async () => {
    const component = device2.getComponent('ws');
    if (!isWsComponent(component)) throw new Error('Missing Ws component');
    for (const config of [null, {}, { enable: 'true' }, { enable: true, server: 42, ssl_ca: '*' }, { enable: true }, { enable: true, ssl_ca: 'invalid' }]) {
      fetchSpy.mockResolvedValueOnce(config);
      expect(await component.GetConfig()).toBeNull();
    }
    for (const status of [null, {}, { connected: 'true' }]) {
      fetchSpy.mockResolvedValueOnce(status);
      expect(await component.GetStatus()).toBeNull();
    }
  });

  it('should identify system components on all generations', () => {
    expect(isSysComponent(device2.getComponent('missing'))).toBe(false);
    expect(isSysComponent(new ShellyComponent(device2, 'cloud', 'Cloud'))).toBe(false);
    const gen1 = new ShellyComponent(device1, 'sys', 'Sys');
    expect(isSysComponent(gen1)).toBe(true);
    expect(isSysComponent(device2.getComponent('sys'))).toBe(true);
  });

  it('should read UDP configuration and system status and write only UDP settings', async () => {
    const component = device2.getComponent('sys');
    if (!isSysComponent(component)) throw new Error('Missing Sys component');
    for (const rpc_udp of [
      { dst_addr: '192.168.1.2:8485', listen_port: 5555 },
      { dst_addr: null, listen_port: null },
    ]) {
      fetchSpy.mockResolvedValueOnce({ rpc_udp, device: { name: 'Ignored' } });
      expect(await component.GetConfig()).toEqual({ rpc_udp });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Sys.GetConfig');
      fetchSpy.mockResolvedValueOnce({ restart_required: true });
      expect(await component.SetConfig({ rpc_udp })).toEqual({ restart_required: true });
      expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Sys.SetConfig', { config: { rpc_udp } });
    }
    const config = { rpc_udp: { dst_addr: null, extra: true }, device: { name: 'Ignored' } };
    await component.SetConfig(config);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Sys.SetConfig', { config: { rpc_udp: { dst_addr: null } } });
    await component.SetConfig({ rpc_udp: { listen_port: 5555 } });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Sys.SetConfig', { config: { rpc_udp: { listen_port: 5555 } } });
    fetchSpy.mockResolvedValueOnce({ mac: '441793D69718', restart_required: false, cfg_rev: 7, uptime: 15 });
    const status = await component.GetStatus();
    expectTypeOf(status?.mac).toEqualTypeOf<string | undefined>();
    expectTypeOf(status?.restart_required).toEqualTypeOf<boolean | undefined>();
    expect(status).toEqual({ mac: '441793D69718', restart_required: false, cfg_rev: 7, time: undefined, uptime: 15 });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Sys.GetStatus');
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.GetStatus()).toBeNull();
    fetchSpy.mockResolvedValueOnce({ mac: '441793D69718', restart_required: true, cfg_rev: 0, time: '12:30', uptime: 0 });
    expect(await component.GetStatus()).toEqual({ mac: '441793D69718', restart_required: true, cfg_rev: 0, time: '12:30', uptime: 0 });
    for (const invalidStatus of [{}, { mac: 123 }, { mac: '' }, { mac: '441793D69718' }, { mac: '441793D69718', restart_required: 'true', uptime: 15 }]) {
      fetchSpy.mockResolvedValueOnce(invalidStatus);
      expect(await component.GetStatus()).toBeNull();
    }
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.SetConfig({ rpc_udp: {} })).toBeNull();
  });

  it('should return undefined restart status on Gen 1 and skip unsupported UDP configuration', async () => {
    const component = new ShellyComponent(device1, 'sys', 'Sys');
    if (!isSysComponent(component)) throw new Error('Missing Sys component');
    expect(await component.GetConfig()).toBeNull();
    expect(await component.SetConfig({ rpc_udp: {} })).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockResolvedValueOnce({ mac: '98CDAC0D01BB', uptime: 15 });
    const status = await component.GetStatus();
    expect(status).toStrictEqual({ mac: '98CDAC0D01BB', restart_required: undefined, cfg_rev: undefined, time: undefined, uptime: 15 });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device1.log, device1.host, device1.port, 'status');
  });

  it('should preserve reported time and validate uptime for both generations', async () => {
    for (const device of [device1, device2]) {
      const component = new ShellyComponent(device, 'sys', 'Sys');
      if (!isSysComponent(component)) throw new Error('Missing Sys component');
      for (const time of ['12:30', null, undefined]) {
        fetchSpy.mockResolvedValueOnce({ mac: '441793D69718', restart_required: false, cfg_rev: 7, time, uptime: 15 });
        const status = await component.GetStatus();
        expectTypeOf(status?.time).toEqualTypeOf<string | null | undefined>();
        expectTypeOf(status?.uptime).toEqualTypeOf<number | undefined>();
        expect(status?.time).toBe(time);
        expect(status?.uptime).toBe(15);
      }
      for (const fields of [{ uptime: undefined }, { uptime: null }, { uptime: '15' }, { uptime: -1 }, { uptime: Infinity }, { time: 123 }]) {
        fetchSpy.mockResolvedValueOnce({ mac: '441793D69718', restart_required: false, cfg_rev: 7, uptime: 15, ...fields });
        expect(await component.GetStatus()).toBeNull();
      }
    }
  });

  it('should validate configuration revisions on Gen 2 and omit them on Gen 1', async () => {
    for (const device of [device1, device2]) {
      const component = new ShellyComponent(device, 'sys', 'Sys');
      if (!isSysComponent(component)) throw new Error('Missing Sys component');
      for (const cfg_rev of [0, 7, undefined, null, '7', -1, Infinity]) {
        fetchSpy.mockResolvedValueOnce({ mac: '441793D69718', restart_required: false, uptime: 15, cfg_rev });
        const status = await component.GetStatus();
        expectTypeOf(status?.cfg_rev).toEqualTypeOf<number | undefined>();
        const valid = device.gen === 1 || cfg_rev === 0 || cfg_rev === 7;
        const expected = valid
          ? { mac: '441793D69718', restart_required: device.gen === 1 ? undefined : false, time: undefined, uptime: 15, cfg_rev: device.gen === 1 ? undefined : cfg_rev }
          : null;
        expect(status).toStrictEqual(expected);
      }
    }
  });

  it('should reject missing or invalid UDP configuration responses', async () => {
    const component = device2.getComponent('sys');
    if (!isSysComponent(component)) throw new Error('Missing Sys component');
    for (const response of [
      null,
      {},
      { rpc_udp: {} },
      { rpc_udp: { dst_addr: null } },
      { rpc_udp: { dst_addr: 5, listen_port: null } },
      { rpc_udp: { dst_addr: null, listen_port: '5555' } },
      { rpc_udp: { dst_addr: null, listen_port: 1.5 } },
    ]) {
      fetchSpy.mockResolvedValueOnce(response);
      expect(await component.GetConfig()).toBeNull();
    }
  });

  it('should construct properly with no data', () => {
    const component = new ShellyComponent(device1, id, name);
    expect(component.device).toBe(device1);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
  });

  it('should reject undefined and non-cloud components when checking the cloud type', () => {
    expect(isCloudComponent(device2.getComponent('missing'))).toBe(false);
    expect(isCloudComponent(new ShellyComponent(device2, 'switch:0', 'Switch'))).toBe(false);
  });

  it('should call cloud RPC methods and return responses when using Gen 2', async () => {
    const component = device2.getComponent('cloud');
    expect(isCloudComponent(component)).toBe(true);
    if (!isCloudComponent(component)) throw new Error('Missing cloud component');
    const config = { enable: false, server: null };
    fetchSpy.mockResolvedValueOnce({ restart_required: false });
    expect(await component.SetConfig({ enable: false })).toEqual({ restart_required: false });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Cloud.SetConfig', { config: { enable: false } });
    fetchSpy.mockResolvedValueOnce(config);
    expect(await component.GetConfig()).toEqual(config);
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Cloud.GetConfig');
    fetchSpy.mockResolvedValueOnce({ connected: true });
    expect(await component.GetStatus()).toEqual({ connected: true });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device2.log, device2.host, device2.port, 'Cloud.GetStatus');
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.GetStatus()).toBeNull();
  });

  it('should validate typed cloud responses when reading configuration and status', async () => {
    for (const device of [device1, device2]) {
      const component = device.getComponent('cloud');
      if (!isCloudComponent(component)) throw new Error('Missing cloud component');
      for (const response of [null, {}, { enable: true }, { enable: true, server: 123 }, { enabled: 'true' }]) {
        fetchSpy.mockResolvedValueOnce(response);
        expect(await component.GetConfig()).toBeNull();
      }
      for (const status of [{}, { connected: 'true' }]) {
        fetchSpy.mockResolvedValueOnce(device.gen === 1 ? { cloud: status } : status);
        expect(await component.GetStatus()).toBeNull();
      }
    }
    const component = device2.getComponent('cloud');
    if (!isCloudComponent(component)) throw new Error('Missing cloud component');
    fetchSpy.mockResolvedValueOnce({ enable: true, server: 'iot.shelly.cloud:6012/jrpc' });
    const config = await component.GetConfig();
    if (!config) throw new Error('Missing cloud configuration');
    expectTypeOf(config.enable).toEqualTypeOf<boolean>();
    expectTypeOf(config.server).toEqualTypeOf<string | null>();
    expect(config.server).toBe('iot.shelly.cloud:6012/jrpc');
    fetchSpy.mockResolvedValueOnce({ connected: false });
    const status = await component.GetStatus();
    expectTypeOf(status?.connected).toEqualTypeOf<boolean | undefined>();
    expect(status?.connected).toBe(false);
  });

  it('should use legacy cloud endpoints and extract status when using Gen 1', async () => {
    const component = device1.getComponent('cloud');
    expect(isCloudComponent(component)).toBe(true);
    if (!isCloudComponent(component)) throw new Error('Missing cloud component');
    fetchSpy.mockResolvedValueOnce({ enabled: false });
    expect(await component.SetConfig({ enable: false })).toEqual({ enabled: false });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device1.log, device1.host, device1.port, 'settings/cloud', { enabled: false });
    for (const enabled of [true, false]) {
      fetchSpy.mockResolvedValueOnce({ enabled, connected: true });
      expect(await component.GetConfig()).toEqual({ enable: enabled, server: null });
    }
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device1.log, device1.host, device1.port, 'settings/cloud');
    fetchSpy.mockResolvedValueOnce({ cloud: { enabled: true, connected: false } });
    expect(await component.GetStatus()).toEqual({ connected: false });
    expect(fetchSpy).toHaveBeenLastCalledWith(shelly, device1.log, device1.host, device1.port, 'status');
    fetchSpy.mockResolvedValueOnce(null);
    expect(await component.GetStatus()).toBeNull();
    fetchSpy.mockResolvedValueOnce({});
    expect(await component.GetStatus()).toBeNull();
  });

  it('should construct properly with data', () => {
    const component = new ShellyComponent(device1, id, name, data);
    expect(component.device).toBe(device1);
    expect(component.id).toBe(id);
    expect(component.name).toBe(name);
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();
  });

  it('should construct properly with light onOff type component gen 1', () => {
    const data = { key1: 'value', key2: 123, key3: true, key4: { ison: true } };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, device1.port, `light/0`, { turn: 'on' });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, device1.port, `light/0`, { turn: 'off' });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device1.log, device1.host, device1.port, `light/0`, { turn: 'toggle' });
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    component.setValue('key4', { ison: false });
    expect(handleUpdate).toHaveBeenCalledTimes(4);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light onOff type component gen 2', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device2, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, device2.port, `Light.Set`, { id: 0, on: true });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, device2.port, `Light.Set`, { id: 0, on: false });
    expect(fetchSpy).toHaveBeenCalledWith(shelly, device2.log, device2.host, device2.port, `Light.Toggle`, { id: 0 });
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    expect(handleUpdate).toHaveBeenCalledTimes(3);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light onOff Level type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    component.on('update', handleUpdate);
    component.on('event', handleEvent);

    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(300);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(handleUpdate).toHaveBeenCalledTimes(0);

    component.setValue('key1', 'value1');
    component.setValue('key2', 1234);
    component.setValue('key3', false);
    expect(handleUpdate).toHaveBeenCalledTimes(3);
    expect(handleEvent).toHaveBeenCalledTimes(0);
  });

  it('should construct properly with light type component and color temp', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50, rgb: [128, 128, 128], red: 128, green: 128, blue: 128, temp: 300 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(9);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(5000);

    device1.gen = 2;
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    device1.gen = 1;

    expect(fetchSpy).toHaveBeenCalledTimes(9);
  });

  it('should construct properly with light type component and color temp with mode', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50, red: 128, green: 128, blue: 128, temp: 300, mode: 'temp' };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(9);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);
    (component as ShellyLightComponent).ColorRGB(128, 128, 128);
    (component as ShellyLightComponent).ColorTemp(5000);

    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('should construct properly with light type component brightness', () => {
    const data = { key1: 'value', key2: 123, key3: true, brightness: 50 };
    const component = new ShellyComponent(device1, 'light:0', 'Light', data);
    expect(component.id).toBe('light:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Light');
    expect(component.properties).toHaveLength(4);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeTruthy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellyLightComponent).On();
    (component as ShellyLightComponent).Off();
    (component as ShellyLightComponent).Toggle();
    (component as ShellyLightComponent).Level(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should construct properly with relay type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, output: true, brightness: 50 };
    const component = new ShellyComponent(device2, 'relay:0', 'Relay', data);
    expect(component.id).toBe('relay:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Relay');
    expect(component.properties).toHaveLength(6);
    expect((component as ShellySwitchComponent).On).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Off).not.toBeUndefined();
    expect((component as ShellySwitchComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeTruthy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();

    (component as ShellySwitchComponent).On();
    (component as ShellySwitchComponent).Off();
    (component as ShellySwitchComponent).Toggle();

    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('should construct properly with switch type component', () => {
    const data = { key1: 'value', key2: 123, key3: true, ison: true };
    const component = new ShellyComponent(device1, 'switch:0', 'Switch', data);
    expect(component.id).toBe('switch:0');
    expect(component.index).toBe(0);
    expect(component.name).toBe('Switch');
    expect(component.properties).toHaveLength(5);
    expect((component as ShellyLightComponent).On).not.toBeUndefined();
    expect((component as ShellyLightComponent).Off).not.toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).not.toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();

    expect(isSwitchComponent(component)).toBeTruthy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeFalsy();
  });

  it('should construct properly with cover type component', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device1, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should construct properly with cover type component gen 2', () => {
    const data = { key1: 'value', key2: 123, key3: true };
    const component = new ShellyComponent(device2, 'cover:1', 'Cover', data);
    expect(component.id).toBe('cover:1');
    expect(component.index).toBe(1);
    expect(component.name).toBe('Cover');
    expect(component.properties).toHaveLength(3);
    expect((component as ShellyLightComponent).On).toBeUndefined();
    expect((component as ShellyLightComponent).Off).toBeUndefined();
    expect((component as ShellyLightComponent).Toggle).toBeUndefined();
    expect((component as ShellyLightComponent).Level).toBeUndefined();
    expect((component as ShellyCoverComponent).Open).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Close).not.toBeUndefined();
    expect((component as ShellyCoverComponent).Stop).not.toBeUndefined();
    expect((component as ShellyCoverComponent).GoToPosition).not.toBeUndefined();

    expect(isSwitchComponent(component)).toBeFalsy();
    expect(isLightComponent(component)).toBeFalsy();
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).Open();
    (component as ShellyCoverComponent).Close();
    (component as ShellyCoverComponent).Stop();
    (component as ShellyCoverComponent).GoToPosition(50);

    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it('should send GoToSlatPosition when slat control is enabled on a gen 2 cover', () => {
    const data = { key1: 'value', slat_pos: 50 };
    const component = new ShellyComponent(device2, 'cover:1', 'Cover', data);
    expect(isCoverComponent(component)).toBeTruthy();
    expect((component as ShellyCoverComponent).GoToSlatPosition).not.toBeUndefined();

    (component as ShellyCoverComponent).GoToSlatPosition(75);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(device2.shelly, device2.log, device2.host, 'Cover.GoToPosition', { id: 1, slat_pos: 75 });

    // The slat position is clamped to the 0-100 range
    (component as ShellyCoverComponent).GoToSlatPosition(150);
    expect(fetchSpy).toHaveBeenCalledWith(device2.shelly, device2.log, device2.host, 'Cover.GoToPosition', { id: 1, slat_pos: 100 });
  });

  it('should not send GoToSlatPosition when slat control is not enabled on a gen 2 cover', () => {
    const component = new ShellyComponent(device2, 'cover:1', 'Cover', { key1: 'value' });
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).GoToSlatPosition(50);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should not send GoToSlatPosition on a gen 1 roller', () => {
    const component = new ShellyComponent(device1, 'roller:0', 'Roller', { slat_pos: 50 });
    expect(isCoverComponent(component)).toBeTruthy();

    (component as ShellyCoverComponent).GoToSlatPosition(50);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('should add property', () => {
    const component = new ShellyComponent(device1, id, name);
    const property = new ShellyProperty(component, 'key', 'value');
    component.addProperty(property);
    expect(component.addProperty(property)).toBe(component);
    expect(component.getProperty('key')).toBe(property);
    expect(component.getProperty('keynot')).toBeUndefined();
    expect(component.hasProperty('key')).toBeTruthy();
    expect(component.hasProperty('keynot')).toBeFalsy();
  });

  it('should set and get value', () => {
    const component = new ShellyComponent(device1, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
  });

  it('should set a new value', () => {
    const component = new ShellyComponent(device1, id, name);
    component.setValue('key', 'value');
    expect(component.getValue('key')).toBe('value');
    component.setValue('key1', 'value3');
    component.setValue('key2', false);
    component.setValue('key3', 345);
    component.setValue('key1', 'valuedd');
    component.setValue('key2', true);
    component.setValue('key3', 456);
    component.setValue('key', 'value1');
    expect(component.getValue('key')).toBe('value1');
  });

  it('should update', () => {
    const data = { key: 'value' };
    const component = new ShellyComponent(device1, id, name, data);
    expect(component.getValue('key')).toBe('value');
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBe('newValue');
  });

  it('should not update', () => {
    const component = new ShellyComponent(device1, id, name);
    component.update({ key: 'newValue' });
    expect(component.getValue('key')).toBeUndefined();
  });

  it('should be Light', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: true });
    expect(isLightComponent(component)).toBe(true);
    // oxlint-disable-next-line unicorn/no-useless-undefined -- the component parameter is required, not optional
    expect(isLightComponent(undefined)).toBe(false);
  });

  it('should be Switch', () => {
    const component = new ShellyComponent(device1, 'switch:0', 'Switch', { ison: true });
    expect(isSwitchComponent(component)).toBe(true);
    // oxlint-disable-next-line unicorn/no-useless-undefined -- the component parameter is required, not optional
    expect(isSwitchComponent(undefined)).toBe(false);
  });

  it('should be Cover', () => {
    const component = new ShellyComponent(device1, 'cover:0', 'Cover', { ison: true });
    expect(isCoverComponent(component)).toBe(true);
    // oxlint-disable-next-line unicorn/no-useless-undefined -- the component parameter is required, not optional
    expect(isCoverComponent(undefined)).toBe(false);
  });

  it('should update state true for ison', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for ison', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { ison: false });
    expect(component.getValue('ison')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ ison: true });
    expect(component.getValue('ison')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state true for output', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
  });

  it('should update state false for output', () => {
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: false });
    expect(component.getValue('output')).toBe(false);
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(false);

    component.update({ output: true });
    expect(component.getValue('output')).toBe(true);
    expect(component.getValue('state')).toBe(true);
  });

  it('should not add or update a shadow state property for non-switch/light components', () => {
    const component = new ShellyComponent(device1, 'cover:0', 'Cover', { ison: true, output: true });
    expect(component.getProperty('state')).toBeUndefined();

    component.update({ ison: false, output: false });
    expect(component.getValue('ison')).toBe(false);
    expect(component.getValue('output')).toBe(false);
    expect(component.getProperty('state')).toBeUndefined();
  });

  it('should not update brightness and color', () => {
    const mockFetch = vi.mocked(shellyFetch).mockResolvedValue({});
    const component = new ShellyComponent(device1, 'light:0', 'Light', { output: true, gain: 50, red: 20, green: 30, blue: 40 });
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
    expect(component.getProperty('brightness')).not.toBeUndefined();
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getProperty('red')).not.toBeUndefined();
    expect(component.getValue('red')).toBe(20);
    expect(component.getProperty('green')).not.toBeUndefined();
    expect(component.getValue('green')).toBe(30);
    expect(component.getProperty('blue')).not.toBeUndefined();
    expect(component.getValue('blue')).toBe(40);
    (component as ShellyLightComponent).Level(34);
    (component as ShellyLightComponent).ColorRGB(10, 20, 30);
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getValue('red')).toBe(20);
    expect(component.getValue('green')).toBe(30);
    expect(component.getValue('blue')).toBe(40);
    mockFetch.mockRestore();
  });

  it('should not update brightness and color for Rgb', () => {
    const mockFetch = vi.mocked(shellyFetch).mockResolvedValue({});
    const component = new ShellyComponent(device3, 'light:0', 'Light', { output: true, brightness: 50, rgb: [20, 30, 40] });
    expect(component.getProperty('state')).not.toBeUndefined();
    expect(component.getValue('state')).toBe(true);
    expect(component.getProperty('brightness')).not.toBeUndefined();
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getProperty('red')).toBeUndefined();
    expect(component.getProperty('green')).toBeUndefined();
    expect(component.getProperty('blue')).toBeUndefined();
    expect(component.getProperty('rgb')).toBeDefined();
    (component as ShellyLightComponent).Level(34);
    (component as ShellyLightComponent).ColorRGB(10, 20, 30);
    expect(component.getValue('brightness')).toBe(50);
    expect(component.getValue('rgb')).toEqual([20, 30, 40]);
    mockFetch.mockRestore();
  });

  it('should iterate over properties', () => {
    const component = new ShellyComponent(device1, id, name, data);
    let count = 0;
    for (const [key, property] of component) {
      expect(property.key).toBe(key);
      count++;
    }
    expect(count).toBe(3);
  });

  it('should log properties', () => {
    const component = new ShellyComponent(device1, id, name, { key1: 'value', key2: 123, key3: true, key4: { on: true } });
    component.logComponent();
    expect(component).not.toBeUndefined();
  });
});
