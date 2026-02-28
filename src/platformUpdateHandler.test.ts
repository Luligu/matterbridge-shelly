// src/platformUpdateHandler.test.ts

const MATTER_PORT = 6100;
const NAME = 'PlatformUpdateHandler';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import {
  addMatterbridgePlatform,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  flushAsync,
  log,
  loggerDebugSpy,
  loggerInfoSpy,
  loggerLogSpy,
  matterbridge,
  setAttributeSpy,
  setDebug,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from 'matterbridge/jestutils';
import { CYAN, db, dn, hk, idn, LogLevel, nf, rs, zb } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

import { MatterbridgeEndpoint } from '../../matterbridge/packages/core/dist/matterbridgeEndpoint';
import { dev } from '../../matterbridge/packages/types/dist/matterbridgeTypes';
import { CoapServer } from './coapServer.ts';
import { MdnsScanner } from './mdnsScanner.ts';
import { ShellyPlatform, ShellyPlatformConfig } from './platform.ts';
import { shellyUpdateHandler } from './platformUpdateHandler.ts';
import { Shelly } from './shelly.ts';
import { ShellyDevice } from './shellyDevice.ts';
import { WsClient } from './wsClient.ts';
import { WsServer } from './wsServer.ts';

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
  const mdnsScannerStartSpy = jest.spyOn(MdnsScanner.prototype, 'start').mockImplementation(() => {});
  const mdnsScannerStopSpy = jest.spyOn(MdnsScanner.prototype, 'stop').mockImplementation(() => {});

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

  afterEach(async () => {
    // Clear the debug flag before each test
    await setDebug(false);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should initialize platform with config name and version', () => {
    shellyPlatform = new ShellyPlatform(matterbridge, log, mockConfig as any);
    addMatterbridgePlatform(shellyPlatform, 'matterbridge-shelly');
    shelly = (shellyPlatform as any).shelly;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing platform: ${idn}${mockConfig.name}${rs}${db} v.${CYAN}${mockConfig.version}`);
    clearInterval((shelly as any).fetchInterval);
    shellyPlatform.config.entityBlackList = []; // First run turn off entity black list
    shellyPlatform.config.inputMomentaryList = ['shelly1-34945472A643', 'shelly1g4-A085E3BCA4C8']; // Add to input momentary list for testing
    shellyPlatform.config.inputLatchingList = ['shelly1pmg4-A085E3BD0544']; // Add to input latching list for testing
    shellyPlatform.config.inputContactList = ['shellyi4g3-5432045661B4']; // Add to input contact list for testing
  });

  const shellies = [
    // Shelly Gen1
    { id: 'shelly1-34945472A643', host: '192.168.1.240', port: 80, gen: 1 },
    { id: 'shelly1l-E8DB84AAD781', host: '192.168.1.241', port: 80, gen: 1 },
    { id: 'shellybulbduo-34945479CFA4', host: '192.168.1.154', port: 80, gen: 1 },
    { id: 'shellybutton1-485519F31EA3', host: '192.168.1.233', port: 80, gen: 1 },
    { id: 'shellycolorbulb-485519EE12A7', host: '192.168.1.155', port: 80, gen: 1 },
    { id: 'shellydimmer2-98CDAC0D01BB', host: '192.168.1.184', port: 80, gen: 1 },
    { id: 'shellydw2-483FDA825476', host: '192.168.1.247', port: 80, gen: 1 },
    { id: 'shellyem3-485519D732F4', host: '192.168.1.249', port: 80, gen: 1 },
    { id: 'shellyflood-EC64C9C1DA9A', host: '192.168.1.248', port: 80, gen: 1 },
    { id: 'shellygas-7C87CEBCECE4', host: '192.168.68.165', port: 80, gen: 1 },
    { id: 'shellyht-703523', host: '192.168.1.176', port: 80, gen: 1 },
    { id: 'shellymotion2-8CF68108A6F5', host: '192.168.1.246', port: 80, gen: 1 },
    { id: 'shellymotionsensor-60A42386E566', host: '192.168.1.245', port: 80, gen: 1 },
    { id: 'shellyplug-s-C38EAB', host: '192.168.68.75', port: 80, gen: 1 },
    { id: 'shellyrgbw2-EC64C9D199AD', host: '192.168.1.152', port: 80, gen: 1 },
    { id: 'shellyrgbw2-EC64C9D3FFEF', host: '192.168.1.226', port: 80, gen: 1 },
    { id: 'shellyswitch25-3494546BBF7E', host: '192.168.1.222', port: 80, gen: 1 },
    { id: 'shellyswitch25-3494547BF36C', host: '192.168.1.236', port: 80, gen: 1 },
    { id: 'shellytrv-60A423D0E032', host: '192.168.24.122', port: 80, gen: 1 },
    { id: 'shellysmoke-XXXXXXXXXXXX', host: '192.168.33.3', port: 80, gen: 1 },

    // Gen2
    { id: 'shelly1mini-348518E0E804', host: '192.168.1.238', port: 80, gen: 2 },
    { id: 'shelly1pmmini-348518E04D44', host: '192.168.1.239', port: 80, gen: 2 },
    { id: 'shellyblugw-B0B21CFAAD18', host: '192.168.1.168', port: 80, gen: 2 },
    { id: 'shellywalldisplay-00082261E102', host: '192.168.1.167', port: 80, gen: 2 },

    // Gen2 plus
    { id: 'shellyplus010v-80646FE1FAC4', host: '192.168.1.160', port: 80, gen: 2 },
    { id: 'shellyplus1-E465B8F3028C', host: '192.168.1.237', port: 80, gen: 2 },
    { id: 'shellyplus1pm-441793D69718', host: '192.168.1.217', port: 80, gen: 2 },
    { id: 'shellyplus2pm-30C922810DA0', host: '192.168.1.85', port: 80, gen: 2 },
    { id: 'shellyplus2pm-30C92286CB68', host: '192.168.1.86', port: 80, gen: 2 },
    { id: 'shellyplus2pm-5443B23D81F8', host: '192.168.1.218', port: 80, gen: 2 },
    { id: 'shellyplus2pm-C4D8D5517C68', host: '192.168.1.163', port: 80, gen: 2 },
    { id: 'shellyplusi4-CC7B5C8AEA2C', host: '192.168.1.224', port: 80, gen: 2 },
    { id: 'shellyplusi4-D48AFC41B6F4', host: '192.168.1.161', port: 80, gen: 2 },
    { id: 'shellyplusplugs-E86BEAEAA000', host: '192.168.1.153', port: 80, gen: 2 },
    { id: 'shellyplusrgbwpm-A0A3B35C7024', host: '192.168.1.180', port: 80, gen: 2 },
    { id: 'shellyplusrgbwpm-ECC9FF4CEAF0', host: '192.168.1.171', port: 80, gen: 2 },
    { id: 'shellyplussmoke-A0A3B3B8AE48', host: '192.168.68.164', port: 80, gen: 2 },

    // Gen2 pro
    { id: 'shellypro1pm-EC6260927F7C', host: '192.168.68.56', port: 80, gen: 2 },
    { id: 'shellypro2cover-0CB815FC11B4', host: '192.168.68.104', port: 80, gen: 2 },
    { id: 'shellypro2pm-EC62608C9C00', host: '192.168.68.95', port: 80, gen: 2 },
    { id: 'shellypro3em-A0DD6CA0C27C', host: '192.168.68.93', port: 80, gen: 2 },
    { id: 'shellypro4pm-34987A67D7D0', host: '192.168.68.54', port: 80, gen: 2 },
    { id: 'shellyprodm1pm-34987A4957C4', host: '192.168.68.57', port: 80, gen: 2 },
    { id: 'shellyproem50-A0DD6CA09158', host: '192.168.70.24', port: 80, gen: 2 },

    { id: 'shellyprorgbwwpm-2CBCBBA78F00', host: '10.101.9.36', port: 80, gen: 2 },
    { id: 'shellyprorgbwwpm-AC1518784844', host: '192.168.70.24', port: 80, gen: 2 },

    // Gen3
    { id: 'shelly1g3-34B7DACAC830', host: '192.168.70.7', port: 80, gen: 3 },
    { id: 'shelly1minig3-543204547478', host: '192.168.70.5', port: 80, gen: 3 },
    { id: 'shelly1pmg3-34B7DAC68344', host: '192.168.68.89', port: 80, gen: 3 },
    { id: 'shelly1pmminig3-543204519264', host: '192.168.68.96', port: 80, gen: 3 },
    { id: 'shelly2pmg3-34CDB0770C4C', host: '192.168.68.91', port: 80, gen: 3 },
    { id: 'shellyblugwg3-34CDB077BCD4', host: '192.168.68.90', port: 80, gen: 3 },
    { id: 'shellyddimmerg3-84FCE636832C', host: '192.168.68.80', port: 80, gen: 3 },
    { id: 'shellyemg3-84FCE636582C', host: '192.168.68.83', port: 80, gen: 3 },
    { id: 'shellyhtg3-3030F9EC8468', host: '192.168.70.12', port: 80, gen: 3 },
    { id: 'shellyi4g3-5432045661B4', host: '192.168.68.76', port: 80, gen: 3 },
    { id: 'shellyplugsg3-8CBFEAA133F0', host: '192.168.68.59', port: 80, gen: 3 },
    { id: 'shellypmminig3-84FCE63957F4', host: '192.168.68.50', port: 80, gen: 3 },

    // Gen4
    { id: 'shelly1g4-A085E3BCA4C8', host: '192.168.70.1', port: 80, gen: 4 },
    { id: 'shelly1pmg4-A085E3BD0544', host: '192.168.70.3', port: 80, gen: 4 },
    { id: 'shelly1minig4-A085E3BB944C', host: '192.168.70.2', port: 80, gen: 4 },
    { id: 'shelly1pmminig4-CCBA97C64580', host: '192.168.70.4', port: 80, gen: 4 },
  ];

  const debugDevice = '';

  for (const shellyId of shellies) {
    if (debugDevice && shellyId.id !== debugDevice) continue;
    let device: ShellyDevice | undefined;
    let endpoint: MatterbridgeEndpoint | undefined;

    it(`should load shelly ${shellyId.id}`, async () => {
      if (shellyId.id === debugDevice) await setDebug(true);
      device = await ShellyDevice.create(shelly, (shellyPlatform as any).log, path.join('src', 'mock', `${shellyId.id}.json`));
      expect(device).not.toBeUndefined();
      if (!device) return;
    });

    it(`should add shelly ${shellyId.id}`, async () => {
      if (shellyId.id === debugDevice) await setDebug(true);
      expect(device).not.toBeUndefined();
      if (!device) return;
      await shelly.addDevice(device);
      await wait(100);
      expect(loggerInfoSpy).toHaveBeenCalledWith(`Shelly added ${idn}${device.name}${rs} device id ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf}`);
      expect(shelly.hasDevice(device.id)).toBe(true);
      expect(shellyPlatform.bridgedDevices.has(device.id)).toBe(true);
      endpoint = shellyPlatform.bridgedDevices.get(device.id);
    });

    if (shellyId.id === 'shelly1-34945472A643') {
      it(`should not update and log errors`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'unknown', 'unknown', null);
        expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`shellyUpdateHandler error: endpoint unknown not found for shelly device ${dn}${device.id}${db}`));
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'unknown', 'unknown', null, 'PowerSource');
        expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`shellyUpdateHandler error: component unknown not found for shelly device ${dn}${device.id}${db}`));
      });

      it(`should trigger input events Gen1 devices`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('input:0')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('input:0')).not.toBeUndefined();
        device.getComponent('input:0')?.setValue('event', ''); // Invalid event
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'input:0', 'event_cnt', 1);
        device.getComponent('input:0')?.setValue('event', 'S'); // Single
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'input:0', 'event_cnt', 1);
        device.getComponent('input:0')?.setValue('event', 'SS'); // Double
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'input:0', 'event_cnt', 1);
        device.getComponent('input:0')?.setValue('event', 'L'); // Long
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'input:0', 'event_cnt', 1);
      });
    }

    if (shellyId.id === 'shellybutton1-485519F31EA3') {
      it(`should update charging Gen1 battery devices`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('battery')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'battery', 'level', 9, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'battery', 'level', 19, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'battery', 'level', 100, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'battery', 'charging', 0, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'battery', 'charging', 1, 'PowerSource');
      });
    }

    if (shellyId.id === 'shellyhtg3-3030F9EC8468') {
      it(`should update charging Gen3 battery devices`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('devicepower:0')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'devicepower:0', 'battery', { V: 12, percent: 9 }, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'devicepower:0', 'battery', { V: 12, percent: 19 }, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'devicepower:0', 'battery', { V: 12, percent: 100 }, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'devicepower:0', 'charging', 0, 'PowerSource');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'devicepower:0', 'charging', 1, 'PowerSource');
      });
    }

    if (shellyId.id === 'shellysmoke-XXXXXXXXXXXX') {
      it(`should update alarm for shellysmoke`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('smoke')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('smoke')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'smoke', 'alarm', false);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'smoke', 'alarm', true);
      });
    }

    if (shellyId.id === 'shellydw2-483FDA825476') {
      it(`should update lux and vibration for shellydw2`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('vibration')).not.toBeUndefined();
        expect(device.getComponent('vibration')?.hasProperty('vibration')).toBeTruthy();
        expect(device.getComponent('lux')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('vibration')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('lux')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'vibration', 'vibration', true);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'lux', 'lux', 10);
      });
    }

    if (shellyId.id === 'shellytrv-60A423D0E032') {
      it(`should update thermostat for shellytrv`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('thermostat:0')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('thermostat:0')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'target_t', { enabled: false, value: 21 });
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'target_t', { enabled: true, value: 21 });
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'tmp', { value: 21, is_valid: true });
      });
    }

    if (shellyId.id === 'shellywalldisplay-00082261E102') {
      it(`should update thermostat for shellywalldisplay`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('thermostat:0')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('thermostat:0')).not.toBeUndefined();
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'enable', false);
        device.getComponent('thermostat:0')?.setValue('type', 'heating');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'enable', true);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'target_C', 21);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'current_C', 21);
        const dataEndpoint = endpoint.getChildEndpointByOriginalId('thermostat:0');
        if (!dataEndpoint) return;
        dataEndpoint.setAttribute = async (clusterId, attribute, value, log) => {
          return true;
        };
        device.getComponent('thermostat:0')?.setValue('type', 'cooling');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'enable', true);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'target_C', 23);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'thermostat:0', 'current_C', 23);
      });
    }

    if (shellyId.id === 'shellyswitch25-3494546BBF7E') {
      it(`should update roller for shellyswitch25`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('sys')).not.toBeUndefined();
        device.getComponent('sys')?.setValue('voltage', 230);
        expect(device.getComponent('roller:0')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('roller:0')).not.toBeUndefined();
        device.coverUpdateTimeoutMs = 1; // Set shorter cover update timeout for testing
        await endpoint.getChildEndpointByOriginalId('roller:0')?.setAttribute('WindowCovering', 'currentPositionLiftPercent100ths', 3000, shellyPlatform.log); // Set feature to support stop command
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'roller:0', 'state', 'stop');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'roller:0', 'state', 'open');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'roller:0', 'state', 'close');
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'roller:0', 'current_pos', 50);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'roller:0', 'target_pos', 50);
      });
    }

    if (shellyId.id === 'shellycolorbulb-485519EE12A7') {
      it(`should update light for shellycolorbulb`, async () => {
        expect(device).not.toBeUndefined();
        if (!device) return;
        expect(endpoint).not.toBeUndefined();
        if (!endpoint) return;
        expect(device.getComponent('light:0')).not.toBeUndefined();
        expect(endpoint.getChildEndpointByOriginalId('light:0')).not.toBeUndefined();
        device.colorUpdateTimeoutMs = 10; // Set shorter color update timeout for testing
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'light:0', 'red', 128);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'light:0', 'green', 128);
        shellyUpdateHandler(shellyPlatform, endpoint, device, 'light:0', 'blue', 128);
        await flushAsync(undefined, undefined, 50);
      });
    }

    it(`should update shelly ${shellyId.id}`, async () => {
      if (shellyId.id === debugDevice) await setDebug(true);
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(endpoint).not.toBeUndefined();
      if (!endpoint) return;
      /*
      matterbridge.setLogLevel(LogLevel.NOTICE);
      log.logLevel = LogLevel.NOTICE;
      device.log.logLevel = LogLevel.NOTICE;
      */
      // await setDebug(true);
      for (const component of device.components) {
        for (const property of component.properties) {
          let dataEndpoint: MatterbridgeEndpoint | undefined;
          let endpointName: string | undefined;
          if (component.id === 'battery' || component.id === 'devicepower:0') {
            // console.warn(`Found component ${component.id} property ${property.key}`);
            endpointName = 'PowerSource';
            dataEndpoint = endpoint;
          }
          if (!dataEndpoint) dataEndpoint = endpoint.getChildEndpointByName(component.id);
          if (!dataEndpoint) dataEndpoint = endpoint.getChildEndpointByName(component.id.replace(':', ''));
          if (!dataEndpoint) {
            // console.warn(`No endpoint found for component ${component.id} property ${property.key}`);
            continue;
          }
          // console.warn(`Testing update for component ${component.id} property ${property.key} endpointName ${endpointName}`);
          shellyUpdateHandler(shellyPlatform, endpoint, device, component.id, property.key, property.value, endpointName);
          expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`${db}Shelly message for device ${idn}${device.id}${rs}${db}`));
          await flushAsync(undefined, undefined, 0);
        }
      }
      await flushAsync(undefined, undefined, 50);
    }, 60000);

    it(`should destroy shelly ${shellyId.id}`, async () => {
      if (shellyId.id === debugDevice) await setDebug(true);
      expect(device).not.toBeUndefined();
      if (!device) return;
      device.destroy();
    });
  }

  it('should call onShutdown with reason', async () => {
    await shellyPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Shutting down platform ${idn}${mockConfig.name}${rs}${nf}: Test reason`);
  });
});
