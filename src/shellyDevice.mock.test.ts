/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import path from 'path';
import { jest } from '@jest/globals';

describe('Shellies', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');

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

  describe('new gen 1 shellydimmer2', () => {
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
      expect(components?.length).toBe(10);
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

  describe('new gen 2 shellyplus2pm roller mode', () => {
    let device: ShellyDevice | undefined = undefined;

    beforeEach(async () => {
      device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.roller.json'));
    });

    afterEach(() => {
      if (device) device.destroy();
    });

    test('Create a gen 2 device', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus2pm-5443b23d81f8.roller.json'));
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      expect(device?.lastseen).not.toBe(0);
    });

    test('Create a gen 2 device with name not null', async () => {
      expect(device).not.toBeUndefined();
      expect(device?.name).not.toBeNull();
      expect(device?.name).toBe('My Shelly 2PM plus');
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

  describe('new gen 2 shellyplus2pm switch mode', () => {
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
      expect(switch0?.getValue('name')).toBeNull();
      expect(switch0?.getValue('temperature')).toBeDefined();
      expect(switch0?.getValue('output')).toBe(false);
      expect(switch0?.getValue('state')).toBe(false);

      const switch1 = device?.getComponent('switch:1');
      expect(switch1).not.toBeUndefined();
      expect(switch1?.logComponent()).toBe(24);
      expect(switch1?.hasProperty('name')).toBeTruthy();
      expect(switch1?.getProperty('name')).not.toBeUndefined();
      expect(switch1?.getValue('name')).toBeNull();
      expect(switch1?.getValue('temperature')).toBeDefined();
      expect(switch1?.getValue('output')).toBe(false);
      expect(switch1?.getValue('state')).toBe(false);

      expect(device?.lastseen).not.toBe(0);
    });
  });

  describe('new gen 2 shellyplus1pm', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellyplus1pm-441793d69718.json'));
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shellyplus1pm-441793d69718.json'));
      expect(device?.model).toBe('SNSW-001P16EU');
      expect(device?.id).toBe('shellyplus1pm-441793D69718');
      expect(device?.firmware).toBe('1.3.2-g34c651b');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new gen 3 shellypmminig3', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shellypmminig3-84fce63957f4.json'));
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shellypmminig3-84fce63957f4.json'));
      expect(device?.model).toBe('S3PM-001PCEU16');
      expect(device?.id).toBe('shellypmminig3-84FCE63957F4');
      expect(device?.firmware).toBe('1.3.2-g34c651b');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(3);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new gen 3 shelly1minig3', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe(path.join('src', 'mock', 'shelly1minig3-543204547478.json'));
      expect(device?.model).toBe('S3SW-001X8EU');
      expect(device?.id).toBe('shelly1minig3-543204547478');
      expect(device?.firmware).toBe('1.3.2-g34c651b');
      expect(device?.auth).toBe(true);
      expect(device?.gen).toBe(3);
      expect(device?.lastseen).not.toBe(0);
      device?.fetchUpdate();
      if (device) device.destroy();
    });
  });
});
