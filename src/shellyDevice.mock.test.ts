/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import path from 'path';
import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

describe('Shelly devices test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.0-gb2aeadb';

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(`Mocked console.log: ${args}`);
    });
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    //
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
      expect(device.name).toBe('My Shelly dimmer2');
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
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus2pm-5443B23D81F8.cover.json'));
    });

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 device', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus2pm-5443B23D81F8.cover.json'));
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device?.firmware).toBe(firmwareGen2);
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      expect(device?.lastseen).not.toBe(0);
    });

    test('Create a gen 2 device with name not null', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.name).not.toBeNull();
      expect(device?.name).toBe('My Shelly 2PM PLUS');
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
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.switch.json'));
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
      expect(switch0?.getValue('name')).toBe('My Shelly Plus 2 PM');
      expect(switch0?.getValue('temperature')).toBeDefined();
      expect(switch0?.getValue('output')).toBe(false);
      expect(switch0?.getValue('state')).toBe(false);

      const switch1 = device?.getComponent('switch:1');
      expect(switch1).not.toBeUndefined();
      expect(switch1?.logComponent()).toBe(24);
      expect(switch1?.hasProperty('name')).toBeTruthy();
      expect(switch1?.getProperty('name')).not.toBeUndefined();
      expect(switch1?.getValue('name')).toBe('My Shelly Plus 2 PM ch2');
      expect(switch1?.getValue('temperature')).toBeDefined();
      expect(switch1?.getValue('output')).toBe(false);
      expect(switch1?.getValue('state')).toBe(false);

      expect(device?.lastseen).not.toBe(0);
    });
  });

  describe('Test gen 2 shellyplus1pm', () => {
    test('Create a gen 2 shellyplus1pm device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus1pm-441793d69718.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus1pm-441793d69718.json'));
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

  describe('Test gen 3 shellypmminig3', () => {
    test('Create a gen 2 shellypmminig3 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellypmminig3-84fce63957f4.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device?.host).toBe(path.join('src', 'mock', 'shellypmminig3-84fce63957f4.json'));
      expect(device?.model).toBe('S3PM-001PCEU16');
      expect(device?.id).toBe('shellypmminig3-84FCE63957F4');
      expect(device?.firmware).toBe(firmwareGen2);
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(3);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('Test gen 3 shelly1minig3', () => {
    test('Create a gen 2 shelly1minig3 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device?.host).toBe(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
      expect(device?.model).toBe('S3SW-001X8EU');
      expect(device?.id).toBe('shelly1minig3-543204547478');
      expect(device?.firmware).toBe(firmwareGen2);
      expect(device?.auth).toBe(true);
      expect(device?.gen).toBe(3);
      expect(device?.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.sleepMode).toBe(false);
      device?.fetchUpdate();
      if (device) device.destroy();
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
      expect(device.name).toBe('My Shelly button1');
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
      expect(device.components.length).toBe(9);

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
      expect(battery?.getValue('level')).toBe(88);
      expect(battery?.getValue('charging')).toBe(true);
      expect(battery?.getValue('voltage')).toBe(4.1);

      if (device) device.destroy();
    });
    test('Create a gen 1 shellybutton1 device with input', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellybutton1-485519F31EA3.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.logDevice()).toBe(9);
      expect(device.components.length).toBe(9);

      const input = device.getComponent('input:0');
      // consoleLogSpy.mockRestore();
      log.logLevel = LogLevel.DEBUG;
      expect(input?.logComponent()).toBe(4);
      expect(input).not.toBeUndefined();
      expect(input?.getValue('input')).toBe(0);
      expect(input?.getValue('name')).toBe(null);
      expect(input?.getValue('event')).toBe('');
      expect(input?.getValue('event_cnt')).toBe(0);

      device.destroy();
    });
  });

  describe('Test all gen 1 devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplug-s device', async () => {
      id = 'shellyplug-s-C38EAB';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHPLG-S');
      expect(device.mac).toBe('E868E7C38EAB');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('My Shelly Plug S');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(34.05);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shelly1 device', async () => {
      id = 'shelly1-34945472A643';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHSW-1');
      expect(device.mac).toBe('34945472A643');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('My Shelly 1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shelly1l device', async () => {
      id = 'shelly1l-E8DB84AAD781';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHSW-L');
      expect(device.mac).toBe('E8DB84AAD781');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('My Shelly 1L');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'input:1', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(51.97);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });
  });
});
