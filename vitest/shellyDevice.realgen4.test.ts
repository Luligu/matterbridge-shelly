// oxlint-disable vitest/no-conditional-expect
/**
 * @file vitest/shellyDevice.realgen4.test.ts
 * @description This file contains the tests for real gen 4 Shelly devices and typed components.
 * @author Luca Liguori
 */

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { HOMEDIR, setupTest } from 'matterbridge/test-utils/vitest';
import { getMacAddress, wait } from 'matterbridge/utils';

import { Shelly } from '../src/shelly.js';
import { isCloudComponent, isMatterComponent, isSwitchComponent, isSysComponent, isWifiComponent, isWsComponent } from '../src/shellyComponent.js';
import { ShellyDevice } from '../src/shellyDevice.js';

const NAME = 'ShellyDeviceRealGen4';

await setupTest(NAME, true);

describe('Shellies Gen 4', () => {
  const log = new AnsiLogger({ logName: NAME, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const address = ['c4:cb:76:b3:cd:1f', '00:15:5d:58:f3:aa'];

  beforeAll(async () => {
    shelly.dataPath = HOMEDIR;
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true, true);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (device) {
      shelly.removeDevice(device);
      device.destroy();
      device = undefined;
    }
    await wait(1000);
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(1000);
    vi.restoreAllMocks();
  });

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  if (!address.includes(getMacAddress() ?? '')) return;

  test('should create a shellypstripg4-D885ACE52518.local Shelly device and read its typed components', async () => {
    const host = '192.168.68.58'; // 'shellypstripg4-D885ACE52518.local';
    device = await ShellyDevice.create(shelly, log, host);
    if (!device) throw new Error(`Unable to create Shelly device at ${host}`);
    await shelly.addDevice(device);
    expect(device.wsClient).toBeDefined();
    expect(device.gen).toBe(4);
    expect(device.host).toBe(host);
    expect(device.model).toBe('S4PL-00416EU');
    expect(device.mac).toBe('D885ACE52518');
    expect(device.id).toBe('shellypstripg4-D885ACE52518');
    expect(await device.fetchUpdate()).not.toBeNull();
    await device.saveDevicePayloads('temp');

    for (let index = 0; index < 4; index++) {
      const component = device.getComponent(`switch:${index}`);
      if (!isSwitchComponent(component)) throw new Error(`Missing switch:${index} component`);
      expect(component.getValue('state')).toEqual(expect.any(Boolean));
      expect(component.getValue('voltage')).toEqual(expect.any(Number));
      expect(component.getValue('current')).toEqual(expect.any(Number));
      expect(component.getValue('apower')).toEqual(expect.any(Number));
      expect(component.getValue('aenergy')).toEqual(expect.objectContaining({ total: expect.any(Number) }));
    }

    const sys = device.getComponent('sys');
    if (!isSysComponent(sys)) throw new Error('Missing typed Sys component');
    expect(await sys.GetConfig()).toEqual(expect.objectContaining({ rpc_udp: expect.any(Object) }));
    expect(await sys.GetStatus()).toEqual(expect.objectContaining({ mac: 'D885ACE52518', uptime: expect.any(Number) }));

    const cloud = device.getComponent('cloud');
    if (!isCloudComponent(cloud)) throw new Error('Missing typed Cloud component');
    expect(await cloud.GetConfig()).toEqual(expect.objectContaining({ enable: expect.any(Boolean) }));
    expect(await cloud.GetStatus()).toEqual({ connected: expect.any(Boolean) });

    const ws = device.getComponent('ws');
    if (!isWsComponent(ws)) throw new Error('Missing typed Ws component');
    expect(await ws.GetConfig()).toEqual(expect.objectContaining({ enable: expect.any(Boolean), ssl_ca: expect.any(String) }));
    expect(await ws.GetStatus()).toEqual({ connected: expect.any(Boolean) });

    const matter = device.getComponent('matter');
    if (!isMatterComponent(matter)) throw new Error('Missing typed Matter component');
    const matterConfig = await matter.GetConfig();
    expect(matterConfig).toEqual({ enable: expect.any(Boolean) });
    expect(await matter.GetStatus()).toEqual({ num_fabrics: expect.any(Number), commissionable: expect.any(Boolean) });
    if (matterConfig?.enable) {
      expect(await matter.GetSetupCode()).toEqual({ qr_code: expect.any(String), manual_code: expect.any(String) });
    } else log.warn('Matter is not enabled, skipping GetSetupCode check.');

    const wifi = device.getComponent('wifi_sta');
    if (!isWifiComponent(wifi)) throw new Error('Missing typed WiFi component');
    const wifiConfig = await wifi.GetConfig();
    expect(wifiConfig).toEqual(expect.objectContaining({ sta: expect.objectContaining({ enable: true }) }));
    expect(await wifi.GetStatus()).toEqual(expect.objectContaining({ sta_ip: expect.any(String), rssi: expect.any(Number) }));
    expect.soft(await wifi.Scan()).toEqual({ results: expect.any(Array) });
    // This RPC requires the access point and range extender to be enabled.
    if (wifiConfig?.ap?.enable && wifiConfig.ap.range_extender?.enable) {
      const apClients = await wifi.ListAPClients();
      expect(apClients).toEqual(expect.objectContaining({ ap_clients: expect.any(Array) }));
      log.info('AP Clients:', apClients);
      for (const client of apClients?.ap_clients ?? []) {
        log.info(`AP Client mac address: ${client.mac}, ip: ${client.ip}, mport: ${client.mport}`);
        const clientDevice = await ShellyDevice.create(shelly, log, device.host, client.mport);
        expect(clientDevice).not.toBeUndefined();
        expect(clientDevice?.host).toBe(device.host);
        expect(clientDevice?.port).toBe(client.mport);
        clientDevice?.destroy();
      }
    } else log.warn('WiFi access point or range extender is not enabled, skipping ListAPClients check.');
  }, 60000);
});
