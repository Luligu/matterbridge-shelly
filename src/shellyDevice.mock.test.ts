// src/shellyDevice.mock.test.ts

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceMock';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { setupTest } from 'matterbridge/jestutils';
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { wait } from 'matterbridge/utils';

import { CoapServer } from './coapServer.js';
import { MdnsScanner } from './mdnsScanner.js';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import { ShellyDevice } from './shellyDevice.js';
import { WsClient } from './wsClient.js';
import { WsServer } from './wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

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
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.4-g6d2a586';
  const firmwareGen3 = '1.5.0-g0087a06';
  const firmwareGen4 = '1.6.2-gc8a76e2';

  beforeAll(() => {
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
    await wait(1000);

    // Restore all mocks after all tests
    jest.restoreAllMocks();
  });

  describe('Test gen 1 shellydimmer2', () => {
    let device: ShellyDevice | undefined = undefined;

    beforeEach(async () => {
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
    });

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 1 device', async () => {
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json'));
      expect(device.model).toBe('SHDM-2');
      expect(device.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device.firmware).toBe('v1.14.0-gcb84623');
      expect(device.auth).toBe(true);
      expect(device.gen).toBe(1);
      expect(device.username).toBe('admin');
      expect(device.password).toBe('tango');
    });

    test('Create a gen 1 device with name not null', async () => {
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device.name).not.toBeNull();
      expect(device.name).toBe('Dimmer2 Gen1');
      expect(device.lastseen).not.toBe(0);
    });

    test('Create a gen 1 device with all components', async () => {
      expect(device).not.toBeUndefined();
      if (!device) return;
      const components = device.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(12);
    });

    test('Create a gen 1 device with components WiFi', async () => {
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device.hasComponent('wifi_ap')).toBeTruthy();
      expect(device.hasComponent('wifi_sta')).toBeTruthy();
      expect(device.hasComponent('wifi_sta1')).toBeTruthy();
    });

    test('Create a gen 1 device with dummy component', async () => {
      if (!device) return;
      expect(device).not.toBeUndefined();
      device.addComponent(new ShellyComponent(device, 'dummy1', 'dummy'));
      expect(device.hasComponent('dummy1')).toBeTruthy();
      expect(device.hasComponent('dummy')).toBeFalsy();
      let component = device.getComponent('dummy');
      expect(component).toBeUndefined();
      component = device.getComponent('dummy1');
      expect(component).not.toBeUndefined();
    });

    test('Create a gen 1 device with relay component', async () => {
      if (!device) return;
      expect(device).not.toBeUndefined();
      device.addComponent(new ShellyComponent(device, 'relay:0', 'Relay'));
      const component = device.getComponent('relay:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:0');
      expect(component?.name).toBe('Relay');
    });

    test('Create a gen 1 device and test index', async () => {
      if (!device) return;
      expect(device).not.toBeUndefined();
      let component = device.getComponent('light:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('light:0');
      expect(component?.index).toBe(0);
      expect(component?.name).toBe('Light');

      device.addComponent(new ShellyComponent(device, 'relay:0', 'Relay'));
      component = device?.getComponent('relay:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:0');
      expect(component?.index).toBe(0);
      expect(component?.name).toBe('Relay');

      device.addComponent(new ShellyComponent(device, 'relay:9', 'Relay'));
      component = device?.getComponent('relay:9');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:9');
      expect(component?.index).toBe(9);
      expect(component?.name).toBe('Relay');

      device.addComponent(new ShellyComponent(device, 'sys', 'Sys'));
      component = device?.getComponent('sys');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('sys');
      expect(component?.index).toBe(-1);
      expect(component?.name).toBe('Sys');
    });
  });

  describe('Test gen 2 shellyplus2pm roller mode', () => {
    let device: ShellyDevice | undefined = undefined;

    beforeEach(async () => {
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus2pm-5443B23D81F8.json'));
    });

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 device', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus2pm-5443B23D81F8.json'));
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device?.firmware).toBe(firmwareGen2);
      expect(device?.auth).toBe(true);
      expect(device?.gen).toBe(2);
      expect(device?.lastseen).not.toBe(0);
    });

    test('Create a gen 2 device with name not null', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.name).not.toBeNull();
      expect(device?.name).toBe('2PM Plus Cover');
      expect(device?.lastseen).not.toBe(0);
    });

    test('Create a gen 2 device with cloud property', async () => {
      expect(device).not.toBeUndefined();
      const cloud = device?.getComponent('cloud');
      expect(cloud).not.toBeUndefined();
      expect(cloud?.hasProperty('enable')).toBeTruthy();
      expect(cloud?.hasProperty('disable')).toBeFalsy();
      expect(cloud?.getValue('name')).toBeUndefined();
      expect(cloud?.getValue('server')).toBe('shelly-103-eu.shelly.cloud:6022/jrpc');
      expect(cloud?.getValue('connected')).toBe(true);
      expect(cloud?.properties.length).toBe(3);
      if (cloud) {
        for (const [key, property] of cloud) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(key).toBe(property.key);
          // eslint-disable-next-line jest/no-conditional-expect
          expect(property.key).not.toBeUndefined();
        }
      }
      expect(device?.updateComponent('nocomponent', {})).toBeUndefined();
      expect(device?.lastseen).not.toBe(0);
    });
  });

  describe('Test gen 2 shellyplus2pm switch mode', () => {
    let device: ShellyDevice | undefined = undefined;

    beforeEach(async () => {
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus2pm-C4D8D5517C68.json'));
    });

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 device with all components', async () => {
      expect(device).not.toBeUndefined();
      const components = device?.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(13);
      expect(device?.hasComponent('cover:0')).toBeFalsy();
      expect(device?.hasComponent('switch:0')).toBeTruthy();
      expect(device?.hasComponent('switch:1')).toBeTruthy();
      expect(device?.hasComponent('switch:3')).toBeFalsy();
    });

    test('Create a gen 2 device with components switch', async () => {
      expect(device).not.toBeUndefined();
      const switch0 = device?.getComponent('switch:0');
      expect(switch0).not.toBeUndefined();
      expect(switch0?.logComponent()).toBe(24);
      expect(switch0?.hasProperty('name')).toBeTruthy();
      expect(switch0?.getProperty('name')).not.toBeUndefined();
      expect(switch0?.getValue('name')).toBe(null);
      expect(switch0?.getValue('temperature')).toBeDefined();
      expect(switch0?.getValue('output')).toBe(false);
      expect(switch0?.getValue('state')).toBe(false);

      const switch1 = device?.getComponent('switch:1');
      expect(switch1).not.toBeUndefined();
      expect(switch1?.logComponent()).toBe(24);
      expect(switch1?.hasProperty('name')).toBeTruthy();
      expect(switch1?.getProperty('name')).not.toBeUndefined();
      expect(switch1?.getValue('name')).toBe(null);
      expect(switch1?.getValue('temperature')).toBeDefined();
      expect(switch1?.getValue('output')).toBe(false);
      expect(switch1?.getValue('state')).toBe(false);

      expect(device?.lastseen).not.toBe(0);
    });
  });

  describe('Test gen 2 shellyplus1pm', () => {
    test('Create a gen 2 shellyplus1pm device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus1pm-441793D69718.json'));
      expect(device?.model).toBe('SNSW-001P16EU');
      expect(device?.id).toBe('shellyplus1pm-441793D69718');
      expect(device?.firmware).toBe(firmwareGen2);
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      expect(device.sleepMode).toBe(false);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('Test gen 1 shellybutton1', () => {
    test('Create a gen 1 shellybutton1 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellybutton1-485519F31EA3.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.profile).toBe(undefined);
      expect(device.sleepMode).toBe(true);
      expect(device.host).toBe(path.join('src', 'mock', 'shellybutton1-485519F31EA3.json'));
      expect(device.model).toBe('SHBTN-2');
      expect(device.id).toBe('shellybutton1-485519F31EA3');
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.mac).toBe('485519F31EA3');
      expect(device.name).toBe('Button1 Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.fetchUpdate()).not.toBeNull();
      if (device) device.destroy();
    });

    test('Create a gen 1 shellybutton1 device all components', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellybutton1-485519F31EA3.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.components.length).toBe(10);

      const coiot = device.getComponent('coiot');
      expect(coiot).not.toBeUndefined();
      expect(coiot?.getValue('enabled')).toBe(true);
      const cloud = device.getComponent('cloud');
      expect(cloud).not.toBeUndefined();
      expect(cloud?.getValue('enabled')).toBe(true);
      const mqtt = device.getComponent('mqtt');
      expect(mqtt).not.toBeUndefined();
      expect(mqtt?.getValue('enable')).toBe(false);
      const sntp = device.getComponent('sntp');
      expect(sntp).not.toBeUndefined();
      expect(sntp?.getValue('enabled')).toBe(false);

      const battery = device.getComponent('battery');
      expect(battery).not.toBeUndefined();
      expect(battery?.getValue('level')).toBe(85);
      expect(battery?.getValue('charging')).toBe(false);
      expect(battery?.getValue('voltage')).toBe(4.07);

      if (device) device.destroy();
    });

    test('Create a gen 1 shellybutton1 device with input', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellybutton1-485519F31EA3.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.logDevice()).toBe(10);
      expect(device.components.length).toBe(10);

      const input = device.getComponent('input:0');
      // consoleLogSpy.mockRestore();
      log.logLevel = LogLevel.DEBUG;
      expect(input?.logComponent()).toBe(4);
      expect(input).not.toBeUndefined();
      expect(input?.getValue('input')).toBe(0);
      expect(input?.getValue('name')).toBe(null);
      expect(input?.getValue('event')).toBe('S');
      expect(input?.getValue('event_cnt')).toBe(304);

      device.destroy();
    });
  });
});
