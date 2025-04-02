/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, LogLevel } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import path from 'node:path';
import { jest } from '@jest/globals';
import { ShellyData } from './shellyTypes.js';
import { wait } from 'matterbridge/utils';
import { CoapServer } from './coapServer.js';
import { WsServer } from './wsServer.js';

// shellyDevice.ts    |   76.51 |    65.16 |   84.37 |    78.5 | ...5,633-635,638-639,645-656,675-691,705-721,726-736,759-761,794-798,802-804,807,882-885,889-892,896-899,903-905,908-910,965-968,1101-1106

describe('Shelly devices test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  jest.spyOn(CoapServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  jest.spyOn(WsServer.prototype, 'start').mockImplementation(() => {
    return;
  });

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.4-g6d2a586';
  const firmwareGen3 = '1.5.0-g0087a06';

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

  afterAll(async () => {
    shelly.destroy();
    await wait(2000);
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

  describe('Test gen 3 shellypmminig3', () => {
    test('Create a gen 2 shellypmminig3 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellypmminig3-84FCE63957F4.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device?.host).toBe(path.join('src', 'mock', 'shellypmminig3-84FCE63957F4.json'));
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

  describe('Test all gen 1 devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 1 shellyplug-s device', async () => {
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
      expect(device.name).toBe('Washing machine plug');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(27.14);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shelly1 device', async () => {
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
      expect(device.name).toBe('1 Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shelly1 device with add-on', async () => {
      id = 'shelly1-34945472A643';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.addon.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.addon.json'));
      expect(device.model).toBe('SHSW-1');
      expect(device.mac).toBe('34945472A643');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1 Gen1 Addon');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Temperature', 'Humidity', 'Sys']);
      // prettier-ignore
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'temperature', 'humidity', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('temperature')?.getValue('0')).toBeDefined();
      expect(device.getComponent('humidity')?.getValue('0')).toBeDefined();
      expect(device.getComponent('temperature')?.getValue('value')).toBe(21.5);
      expect(device.getComponent('humidity')?.getValue('value')).toBe(53.9);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shelly1l device', async () => {
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
      expect(device.name).toBe('1L Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'meter:0', 'input:0', 'input:1', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(53.59);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyflood device', async () => {
      id = 'shellyflood-EC64C9C1DA9A';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHWT-1');
      expect(device.mac).toBe('EC64C9C1DA9A');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Flood Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(true);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Flood', 'Temperature', 'Battery', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'flood', 'temperature', 'battery', 'sys']);

      expect(device.getComponent('flood')?.getValue('flood')).toBe(false);
      expect(device.getComponent('temperature')?.getValue('value')).toBe(22.12);
      expect(device.getComponent('battery')?.getValue('level')).toBe(94);
      expect(device.getComponent('battery')?.getValue('voltage')).toBe(2.91);
      expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellydw2 device', async () => {
      id = 'shellydw2-483FDA825476';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHDW-2');
      expect(device.mac).toBe('483FDA825476');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Door/Window2 Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(true);

      expect(device.components.length).toBe(14);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Temperature', 'Lux', 'Vibration', 'Sensor', 'Contact', 'Battery', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual([
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'mqtt',
        'coiot',
        'sntp',
        'cloud',
        'temperature',
        'lux',
        'vibration',
        'sensor',
        'contact',
        'battery',
        'sys',
      ]);

      expect(device.getComponent('sensor')?.getValue('state')).toBe('open');
      expect(device.getComponent('lux')?.getValue('value')).toBe(292);
      expect(device.getComponent('vibration')?.getValue('vibration')).toBe(false);
      expect(device.getComponent('temperature')?.getValue('value')).toBe(22.6);
      expect(device.getComponent('battery')?.getValue('level')).toBe(100);
      expect(device.getComponent('battery')?.getValue('voltage')).toBe(5.98);
      expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      expect(device.getComponent('sensor')?.getValue('contact_open')).toBe(true);

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyht device', async () => {
      id = 'shellyht-CA969F';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHHT-1');
      expect(device.mac).toBe('485519CA969F');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('HT Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(true);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Temperature', 'Humidity', 'Battery', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'temperature', 'humidity', 'battery', 'sys']);

      expect(device.getComponent('temperature')?.getValue('value')).toBe(23);
      expect(device.getComponent('temperature')?.getValue('units')).toBe('C');
      expect(device.getComponent('temperature')?.getValue('tC')).toBe(23);
      expect(device.getComponent('temperature')?.getValue('tF')).toBe(73.4);
      expect(device.getComponent('temperature')?.getValue('is_valid')).toBe(true);
      expect(device.getComponent('humidity')?.getValue('value')).toBe(50.5);
      expect(device.getComponent('humidity')?.getValue('is_valid')).toBe(true);
      expect(device.getComponent('battery')?.getValue('level')).toBe(100);
      expect(device.getComponent('battery')?.getValue('voltage')).toBe(2.99);
      expect(device.getComponent('battery')?.getValue('charging')).toBe(undefined);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellygas device', async () => {
      id = 'shellygas-7C87CEBCECE4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHGS-1');
      expect(device.mac).toBe('7C87CEBCECE4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Gas Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(9);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Gas', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'gas', 'sys']);

      expect(device.getComponent('gas')?.getValue('sensor_state')).toBe('normal');
      expect(device.getComponent('gas')?.getValue('alarm_state')).toBe('none');
      expect(device.getComponent('gas')?.getValue('ppm')).toBe(0);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellydimmer2 device', async () => {
      id = 'shellydimmer2-98CDAC0D01BB';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHDM-2');
      expect(device.mac).toBe('98CDAC0D01BB');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(true);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Dimmer2 Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'input:0', 'input:1', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyrgbw2 device color mode', async () => {
      id = 'shellyrgbw2-EC64C9D3FFEF';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHRGBW2');
      expect(device.mac).toBe('EC64C9D3FFEF');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('color');
      expect(device.name).toBe('RGBW2 Gen1 Color');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Sys', 'PowerMeter', 'Input']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'sys', 'meter:0', 'input:0']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('red')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('green')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('blue')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyrgbw2 device white mode', async () => {
      id = 'shellyrgbw2-EC64C9D199AD';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHRGBW2');
      expect(device.mac).toBe('EC64C9D199AD');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('white');
      expect(device.name).toBe('RGBW2 Gen1 White');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(17);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'Sys', 'PowerMeter', 'Input']);
      expect(device.getComponentIds()).toStrictEqual([
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'mqtt',
        'coiot',
        'sntp',
        'cloud',
        'light:0',
        'light:1',
        'light:2',
        'light:3',
        'sys',
        'meter:0',
        'meter:1',
        'meter:2',
        'meter:3',
        'input:0',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('blue')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyem3 device', async () => {
      id = 'shellyem3-485519D732F4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHEM-3');
      expect(device.mac).toBe('485519D732F4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('3EM Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'relay:0', 'emeter:0', 'emeter:1', 'emeter:2', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('relay:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('relay:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('relay:0')?.hasProperty('brightness')).toBe(false);

      expect(device.getComponent('emeter:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('emeter:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('emeter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('emeter:0')?.hasProperty('total')).toBe(true);

      expect(device.getComponent('emeter:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('emeter:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('emeter:1')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('emeter:1')?.hasProperty('total')).toBe(true);

      expect(device.getComponent('emeter:2')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('emeter:2')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('emeter:2')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('emeter:2')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellybulbduo device', async () => {
      id = 'shellybulbduo-34945479CFA4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHBDUO-1');
      expect(device.mac).toBe('34945479CFA4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Duo Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Light', 'PowerMeter', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'light:0', 'meter:0', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);

      expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellycolorbulb-485519EE12A7 device color mode', async () => {
      id = 'shellycolorbulb-485519EE12A7';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.color.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.color.json'));
      expect(device.model).toBe('SHCB-1');
      expect(device.mac).toBe('485519EE12A7');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('color');
      expect(device.name).toBe('Bulb Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Sys', 'Light', 'PowerMeter']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'sys', 'light:0', 'meter:0']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.getValue('mode')).toBe('color');

      expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellycolorbulb-485519EE12A7 device white mode', async () => {
      id = 'shellycolorbulb-485519EE12A7';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.white.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.white.json'));
      expect(device.model).toBe('SHCB-1');
      expect(device.mac).toBe('485519EE12A7');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('white');
      expect(device.name).toBe('Bulb Gen1');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Sys', 'Light', 'PowerMeter']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'sys', 'light:0', 'meter:0']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('gain')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.getValue('mode')).toBe('white');

      expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyswitch25-3494547BF36C device relay mode', async () => {
      id = 'shellyswitch25-3494547BF36C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHSW-25');
      expect(device.mac).toBe('3494547BF36C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('switch');
      expect(device.name).toBe('2.5 Gen1 Relay');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(14);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Relay', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual([
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'mqtt',
        'coiot',
        'sntp',
        'cloud',
        'relay:0',
        'relay:1',
        'meter:0',
        'meter:1',
        'input:0',
        'input:1',
        'sys',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(51.61);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(device.getComponent('relay:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('relay:0')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('relay:0')?.hasProperty('gain')).toBe(false);
      expect(device.getComponent('relay:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('relay:0')?.getValue('mode')).toBe(undefined);

      expect(device.getComponent('relay:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('relay:1')?.hasProperty('ison')).toBe(true);
      expect(device.getComponent('relay:1')?.hasProperty('gain')).toBe(false);
      expect(device.getComponent('relay:1')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('relay:1')?.getValue('mode')).toBe(undefined);

      expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

      expect(device.getComponent('meter:1')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:1')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:1')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:1')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellyswitch25-3494546BBF7E device roller mode', async () => {
      id = 'shellyswitch25-3494546BBF7E';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHSW-25');
      expect(device.mac).toBe('3494546BBF7E');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe('cover');
      expect(device.name).toBe('2.5 Gen1 Cover');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'CoIoT', 'Sntp', 'Cloud', 'Roller', 'PowerMeter', 'Input', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'wifi_sta1', 'mqtt', 'coiot', 'sntp', 'cloud', 'roller:0', 'meter:0', 'input:0', 'input:1', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(58.32);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(false);

      expect(device.getComponent('roller:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('roller:0')?.hasProperty('current_pos')).toBe(true);
      expect(device.getComponent('roller:0')?.hasProperty('source')).toBe(true);
      expect(device.getComponent('roller:0')?.hasProperty('last_direction')).toBe(true);

      expect(device.getComponent('meter:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('meter:0')?.hasProperty('power')).toBe(true);
      expect(device.getComponent('meter:0')?.hasProperty('total')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 1 shellytrv-60A423D0E032 device', async () => {
      id = 'shellytrv-60A423D0E032';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SHTRV-01');
      expect(device.mac).toBe('60A423D0E032');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('v2.2.4@ee290818');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(1);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Shelly-UG-CZ-Heizkoerper');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(9);
      expect(device.getComponentNames()).toStrictEqual(['WiFi', 'MQTT', 'Sntp', 'Cloud', 'CoIoT', 'Thermostat', 'Battery', 'Sys']);
      expect(device.getComponentIds()).toStrictEqual(['wifi_ap', 'wifi_sta', 'mqtt', 'sntp', 'cloud', 'coiot', 'thermostat:0', 'battery', 'sys']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('thermostat:0')?.hasProperty('target_t')).toBe(true);
      expect(device.getComponent('thermostat:0')?.hasProperty('tmp')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      expect(device.getComponent('thermostat:0')?.getValue('target_t')).toEqual({ 'enabled': true, 'units': 'C', 'value': 5, 'value_op': 8 });
      expect(device.getComponent('thermostat:0')?.getValue('tmp')).toEqual({ 'is_valid': true, 'units': 'C', 'value': 14.3 });
      device.getComponent('thermostat:0')?.setValue('target_t', { value: 22 });
      device.getComponent('thermostat:0')?.setValue('tmp', { value: 20 });
      expect(device.getComponent('thermostat:0')?.getValue('target_t')).toEqual({ 'value': 22 });
      expect(device.getComponent('thermostat:0')?.getValue('tmp')).toEqual({ 'value': 20 });

      if (device) device.destroy();
    });
  });

  describe('Test all gen 2 devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplusrgbwpm device (rgb mode)', async () => {
      id = 'shellyplusrgbwpm-A0A3B35C7024';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.rgb.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.rgb.json'));
      expect(device.model).toBe('SNDC-0D4P10WW');
      expect(device.mac).toBe('A0A3B35C7024');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('1.3.3-gbdfd9b3'); // firmwareGen2
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe('rgb');
      expect(device.name).toBe('My Shelly RGBW PM PLUS');
      expect(device.hasUpdate).toBe(true);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(14);
      // console.error(device.getComponentNames());
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Rgb', 'Sys', 'Sntp', 'WiFi', 'WS']);
      // console.error(device.getComponentIds());
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'input:0',
        'input:1',
        'input:2',
        'input:3',
        'mqtt',
        'rgb:0',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('rgb:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('rgb:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('rgb:0')?.hasProperty('rgb')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplusi4 AC device', async () => {
      id = 'shellyplusi4-CC7B5C8AEA2C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSN-0024X');
      expect(device.mac).toBe('CC7B5C8AEA2C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('i4 AC Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(15);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Humidity', 'Input', 'MQTT', 'Sys', 'Sntp', 'Temperature', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'humidity:100',
        'input:0',
        'input:1',
        'input:2',
        'input:3',
        'mqtt',
        'sys',
        'sntp',
        'temperature:100',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('input:0')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('type')).toBe(true);

      expect(device.getComponent('input:0')?.getValue('type')).toBe('switch');
      expect(device.getComponent('input:1')?.getValue('type')).toBe('switch');
      expect(device.getComponent('input:2')?.getValue('type')).toBe('switch');
      expect(device.getComponent('input:3')?.getValue('type')).toBe('switch');

      expect(device.getComponent('input:0')?.getValue('state')).toBe(false);
      expect(device.getComponent('input:1')?.getValue('state')).toBe(false);
      expect(device.getComponent('input:2')?.getValue('state')).toBe(false);
      expect(device.getComponent('input:3')?.getValue('state')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplusi4 DC device', async () => {
      id = 'shellyplusi4-D48AFC41B6F4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSN-0D24X');
      expect(device.mac).toBe('D48AFC41B6F4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('i4 DC Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('input:0')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('type')).toBe(true);

      expect(device.getComponent('input:0')?.getValue('type')).toBe('switch');
      expect(device.getComponent('input:1')?.getValue('type')).toBe('switch');
      expect(device.getComponent('input:2')?.getValue('type')).toBe('button');
      expect(device.getComponent('input:3')?.getValue('type')).toBe('button');

      expect(device.getComponent('input:0')?.getValue('enable')).toBe(false);
      expect(device.getComponent('input:1')?.getValue('enable')).toBe(true);
      expect(device.getComponent('input:2')?.getValue('enable')).toBe(true);
      expect(device.getComponent('input:3')?.getValue('enable')).toBe(false);

      expect(device.getComponent('input:0')?.getValue('state')).toBe(null); // in switch mode can be true or false and is a WebSocket update
      expect(device.getComponent('input:1')?.getValue('state')).toBe(false);
      expect(device.getComponent('input:2')?.getValue('state')).toBe(null); // in button mode is null and is a WebSocket event
      expect(device.getComponent('input:3')?.getValue('state')).toBe(null);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellywalldisplay device', async () => {
      id = 'shellywalldisplay-00082261E102';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SAWD-0A1XX10EU1');
      expect(device.mac).toBe('00082261E102');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('2.3.5-be75436c');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Wall Display');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(14);
      expect(device.getComponentNames()).toStrictEqual([
        'Ble',
        'WiFi',
        'Switch',
        'Input',
        'Temperature',
        'Humidity',
        'Illuminance',
        'Sys',
        'Sntp',
        'Cloud',
        'MQTT',
        'WS',
        'Thermostat',
        'Devicepower',
      ]);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'wifi_sta',
        'switch:0',
        'input:0',
        'temperature:0',
        'humidity:0',
        'illuminance:0',
        'sys',
        'sntp',
        'cloud',
        'mqtt',
        'ws',
        'thermostat:0',
        'devicepower:0',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('temperature:0')?.hasProperty('tC')).toBe(true);
      expect(device.getComponent('humidity:0')?.hasProperty('rh')).toBe(true);
      expect(device.getComponent('illuminance:0')?.hasProperty('lux')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellywalldisplay device with thermostat', async () => {
      id = 'shellywalldisplay-00082261E102';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.thermostat.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.thermostat.json'));
      expect(device.model).toBe('SAWD-0A1XX10EU1');
      expect(device.mac).toBe('00082261E102');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('2.2.1-eb899af6');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Wall Display');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(14);
      expect(device.getComponentNames()).toStrictEqual([
        'Ble',
        'WiFi',
        'Switch',
        'Input',
        'Temperature',
        'Humidity',
        'Illuminance',
        'Sys',
        'Sntp',
        'Cloud',
        'MQTT',
        'WS',
        'Thermostat',
        'Devicepower',
      ]);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'wifi_sta',
        'switch:0',
        'input:0',
        'temperature:0',
        'humidity:0',
        'illuminance:0',
        'sys',
        'sntp',
        'cloud',
        'mqtt',
        'ws',
        'thermostat:0',
        'devicepower:0',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('temperature:0')?.hasProperty('tC')).toBe(true);
      expect(device.getComponent('humidity:0')?.hasProperty('rh')).toBe(true);
      expect(device.getComponent('illuminance:0')?.hasProperty('lux')).toBe(true);
      expect(device.getComponent('thermostat:0')?.hasProperty('enable')).toBe(true);
      expect(device.getComponent('thermostat:0')?.hasProperty('type')).toBe(true);
      expect(device.getComponent('thermostat:0')?.hasProperty('target_C')).toBe(true);
      expect(device.getComponent('thermostat:0')?.hasProperty('current_C')).toBe(true);
      expect(device.getComponent('thermostat:0')?.getValue('target_C')).toBe(25);
      expect(device.getComponent('thermostat:0')?.getValue('current_C')).toBe(22.9);
      expect(device.getComponent('thermostat:0')?.getValue('type')).toBe('heating');

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplus1 device', async () => {
      id = 'shellyplus1-E465B8F3028C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSW-001X16EU');
      expect(device.mac).toBe('E465B8F3028C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1 Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      // console.error(device.getComponentNames());
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      // console.error(device.getComponentIds());
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplus1pm device', async () => {
      id = 'shellyplus1pm-441793D69718';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSW-001P16EU');
      expect(device.mac).toBe('441793D69718');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2); // firmwareGen2
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1PM Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      // console.error(device.getComponentNames());
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      // console.error(device.getComponentIds());
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplus2pm device mode switch', async () => {
      id = 'shellyplus2pm-C4D8D5517C68';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSW-102P16EU');
      expect(device.mac).toBe('C4D8D5517C68');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe('switch');
      expect(device.name).toBe('2PM Plus Switch');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'input:0',
        'input:1',
        'mqtt',
        'switch:0',
        'switch:1',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplus2pm device mode cover', async () => {
      id = 'shellyplus2pm-5443B23D81F8';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSW-102P16EU');
      expect(device.mac).toBe('5443B23D81F8');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(true);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe('cover');
      expect(device.name).toBe('2PM Plus Cover');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplusplugs device', async () => {
      id = 'shellyplusplugs-E86BEAEAA000';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNPL-00112EU');
      expect(device.mac).toBe('E86BEAEAA000');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('PlugS Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(undefined);
      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplus010v device', async () => {
      id = 'shellyplus010v-80646FE1FAC4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNDM-00100WW');
      expect(device.mac).toBe('80646FE1FAC4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('0-10V Dimmer Plus');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      // console.error(device.getComponentNames());
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      // console.error(device.getComponentIds());
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('temperature')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('night_mode')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('current')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 2 shellyplussmoke device', async () => {
      id = 'shellyplussmoke-A0A3B3B8AE48';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SNSN-0031Z');
      expect(device.mac).toBe('A0A3B3B8AE48');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe(id);
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(true);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Devicepower', 'MQTT', 'Smoke', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'devicepower:0', 'mqtt', 'smoke:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('smoke:0')?.hasProperty('alarm')).toBe(true);
      expect(device.getComponent('smoke:0')?.hasProperty('mute')).toBe(true);
      expect(device.getComponent('smoke:0')?.getValue('alarm')).toBe(false);
      expect(device.getComponent('smoke:0')?.getValue('mute')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });
  });

  describe('Test all gen 3 devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 3 shellyplugsg3 device', async () => {
      id = 'shellyplugsg3-5432045CE094';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3PL-00112EU');
      expect(device.mac).toBe('5432045CE094');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('1.2.3-plugsg3prod0-gec79607'); // firmwareGen1
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Plug S Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shellyemg3 device', async () => {
      id = 'shellyemg3-84FCE636582C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3EM-002CXCEU');
      expect(device.mac).toBe('84FCE636582C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('1.5.0-g0087a06');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('EM Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'em1:1', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shellyddimmerg3 device', async () => {
      id = 'shellyddimmerg3-84FCE636832C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3DM-0A1WW');
      expect(device.mac).toBe('84FCE636832C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen3);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('DALI Dimmer Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('blu')).toBe(false);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly1g3 device', async () => {
      id = 'shelly1g3-34B7DACAC830';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SW-001X16EU');
      expect(device.mac).toBe('34B7DACAC830');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1 Gen3 I');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly1minig3 device', async () => {
      id = 'shelly1minig3-543204547478';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SW-001X8EU');
      expect(device.mac).toBe('543204547478');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(true);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1mini Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(4);
      expect(device.bthomeSensors.size).toBe(14);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly1pmg3 device', async () => {
      id = 'shelly1pmg3-34B7DAC68344';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SW-001P16EU');
      expect(device.mac).toBe('34B7DAC68344');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1PM Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(11);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('blu')).toBe(false);

      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(3);
      expect(device.bthomeSensors.size).toBe(10);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly2pmg3 device mode switch', async () => {
      id = 'shelly2pmg3-8CBFEA9DE29C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SW-002P16EU');
      expect(device.mac).toBe('8CBFEA9DE29C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen3);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe('switch');
      expect(device.name).toBe('2PM Gen3 Switch');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'input:0',
        'input:1',
        'mqtt',
        'switch:0',
        'switch:1',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly2pmg3 device mode cover', async () => {
      id = 'shelly2pmg3-34CDB0770C4C';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SW-002P16EU');
      expect(device.mac).toBe('34CDB0770C4C');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen3);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe('cover');
      expect(device.name).toBe('2PM Gen3 Cover');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('cover:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(4);
      expect(device.bthomeSensors.size).toBe(18);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shellyi4g3 device', async () => {
      id = 'shellyi4g3-5432045661B4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3SN-0024X');
      expect(device.mac).toBe('5432045661B4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('i4 Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'input:2', 'input:3', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shelly0110dimg3 device', async () => {
      id = 'shelly0110dimg3-34B7DA902E24';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3DM-0010WW');
      expect(device.mac).toBe('34B7DA902E24');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('1.4.2-beta1-g84969a6');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Dimmer 0/1-10V PM Gen3');
      expect(device.hasUpdate).toBe(true);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('rgb')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('red')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('green')).toBe(false);
      expect(device.getComponent('light:0')?.hasProperty('blu')).toBe(false);

      expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a gen 3 shellyblugwg3 device', async () => {
      id = 'shellyblugwg3-34CDB077BCD4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S3GW-1DBT001');
      expect(device.mac).toBe('34CDB077BCD4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen3);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(3);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('BLU Gateway Gen3');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(10);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Blugw', 'Cloud', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'blugw', 'cloud', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.bthomeTrvs.size).toBe(2);
      expect(device.bthomeDevices.size).toBe(5);
      expect(device.bthomeSensors.size).toBe(20);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });
  });

  describe('Test all pro devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a pro shellypro1pm device', async () => {
      id = 'shellypro1pm-EC62608AB9A4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPSW-201PE16EU');
      expect(device.mac).toBe('EC62608AB9A4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('1PM Pro');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'eth', 'input:0', 'input:1', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThan(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a pro shellypro2pm device', async () => {
      id = 'shellypro2pm-EC62608C9C00';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPSW-202PE16EU');
      expect(device.mac).toBe('EC62608C9C00');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe('switch');
      expect(device.name).toBe('2PM Pro');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(14);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'eth',
        'input:0',
        'input:1',
        'mqtt',
        'switch:0',
        'switch:1',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('brightness')).toBe(false);

      expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a pro shellypro2cover device', async () => {
      id = 'shellypro2cover-0CB815FC11B4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPSH-002PE16EU');
      expect(device.mac).toBe('0CB815FC11B4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('2Cover Pro');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(16);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Eth', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'cover:0',
        'cover:1',
        'eth',
        'input:0',
        'input:1',
        'input:2',
        'input:3',
        'mqtt',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('temperature')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('cover:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.getComponent('cover:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:1')?.hasProperty('temperature')).toBe(true);
      expect(device.getComponent('cover:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('cover:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('cover:1')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('cover:1')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('cover:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a pro shellypro4pm device', async () => {
      id = 'shellypro4pm-34987A67D7D0';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPSW-104PE16EU');
      expect(device.mac).toBe('34987A67D7D0');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('4PM Pro');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(18);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual([
        'ble',
        'cloud',
        'eth',
        'input:0',
        'input:1',
        'input:2',
        'input:3',
        'mqtt',
        'switch:0',
        'switch:1',
        'switch:2',
        'switch:3',
        'sys',
        'sntp',
        'wifi_ap',
        'wifi_sta',
        'wifi_sta1',
        'ws',
      ]);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:2')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:3')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.getComponent('switch:1')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('brightness')).toBe(false);
      expect(device.getComponent('switch:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('switch:1')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('switch:1')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a pro shellyproem50 device', async () => {
      id = 'shellyproem50-A0DD6CA09158';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPEM-002CEBEU50');
      expect(device.mac).toBe('A0DD6CA09158');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Breaker box PRO-EM50 I');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'PowerMeter', 'Eth', 'MQTT', 'Switch', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'em1:0', 'em1:1', 'eth', 'mqtt', 'switch:0', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('switch:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('switch:0')?.hasProperty('brightness')).toBe(false);

      expect(device.getComponent('em1:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('em1:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('em1:0')?.hasProperty('act_power')).toBe(true);
      expect(device.getComponent('em1:0')?.hasProperty('total')).toBe(false);

      expect(device.getComponent('em1:1')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('em1:1')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('em1:1')?.hasProperty('act_power')).toBe(true);
      expect(device.getComponent('em1:1')?.hasProperty('total')).toBe(false);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });

    test('Create a pro shellyprodm1pm device', async () => {
      id = 'shellyprodm1pm-34987A4957C4';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('SPDM-001PE01EU');
      expect(device.mac).toBe('34987A4957C4');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(2);
      expect(device.profile).toBe(undefined);
      expect(device.name).toBe('Dimmer 1PM Pro');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(13);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Eth', 'Input', 'Light', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'eth', 'input:0', 'input:1', 'light:0', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('light:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('output')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('brightness')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('light:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('light:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });
  });

  describe('Test all gen 4 devices', () => {
    let device: ShellyDevice | undefined = undefined;
    let id: string;

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 4 shelly2pmg4 device mode cover', async () => {
      id = 'shelly2pmg4-7C2C677A0110';
      log.logName = id;

      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', id + '.json'));
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.host).toBe(path.join('src', 'mock', id + '.json'));
      expect(device.model).toBe('S4SW-002P16EU');
      expect(device.mac).toBe('7C2C677A0110');
      expect(device.id).toBe(id);
      expect(device.firmware).toBe('r1.4-389-ge55943de7-main');
      expect(device.auth).toBe(false);
      expect(device.gen).toBe(4);
      expect(device.profile).toBe('cover');
      expect(device.name).toBe('shelly2pmg4-7C2C677A0110');
      expect(device.hasUpdate).toBe(false);
      expect(device.lastseen).not.toBe(0);
      expect(device.online).toBe(true);
      expect(device.cached).toBe(false);
      expect(device.sleepMode).toBe(false);

      expect(device.components.length).toBe(12);
      expect(device.getComponentNames()).toStrictEqual(['Ble', 'Cloud', 'Cover', 'Input', 'MQTT', 'Sys', 'Sntp', 'WiFi', 'WS']);
      expect(device.getComponentIds()).toStrictEqual(['ble', 'cloud', 'cover:0', 'input:0', 'input:1', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws']);

      expect(device.getComponent('sys')?.getValue('temperature')).toBe(undefined);
      expect(device.getComponent('sys')?.getValue('overtemperature')).toBe(undefined);

      expect(device.getComponent('input:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('input:1')?.hasProperty('state')).toBe(true);

      expect(device.getComponent('cover:0')?.hasProperty('state')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('voltage')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('current')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('apower')).toBe(true);
      expect(device.getComponent('cover:0')?.hasProperty('aenergy')).toBe(true);
      expect((device.getComponent('cover:0')?.getValue('aenergy') as ShellyData).total).toBeGreaterThanOrEqual(0);

      expect(device.bthomeTrvs.size).toBe(0);
      expect(device.bthomeDevices.size).toBe(0);
      expect(device.bthomeSensors.size).toBe(0);

      expect(await device.fetchUpdate()).not.toBeNull();

      if (device) device.destroy();
    });
  });
});
