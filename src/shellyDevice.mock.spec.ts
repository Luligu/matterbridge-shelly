/* eslint-disable @typescript-eslint/no-unused-vars */

import { ShellyDevice, ShellyComponent, ShellyProperty, ShellyDataType, ShellyData } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { shellydimmer2Settings } from './shellydimmer2.js';
import { getIpv4InterfaceAddress } from './utils';

describe('Shellies', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    // (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    // jest.clearAllMocks();
  });

  afterAll(() => {
    //
  });

  describe('new gen 1 shellydimmer2', () => {
    test('Create a gen 1 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.219');
      expect(device?.model).toBe('SHDM-2');
      expect(device?.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device?.firmware).toBe('v1.14.0-gcb84623');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(1);
      expect(device?.username).toBe('admin');
      expect(device?.password).toBeUndefined();
      if (device) device.destroy();
    });

    test('Create a gen 1 device with name = null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      expect(device?.name).toBeNull();
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 1 device with all components', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      const components = device?.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(8);
      if (device) device.destroy();
    });

    test('Create a gen 1 device with a name', async () => {
      shellydimmer2Settings.name = 'my dimmer';
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      expect(device?.name).toBe('my dimmer');
      if (device) device.destroy();
    });

    test('Create a gen 1 device with components WiFi', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      expect(device?.hasComponent('wifi_ap')).toBeTruthy();
      expect(device?.hasComponent('wifi_sta')).toBeTruthy();
      expect(device?.hasComponent('wifi_sta1')).toBeTruthy();
      if (device) device.destroy();
    });

    test('Create a gen 1 device with dummy component', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      device?.addComponent(new ShellyComponent('dummy1', 'dummy', device));
      expect(device?.hasComponent('dummy1')).toBeTruthy();
      expect(device?.hasComponent('dummy')).toBeFalsy();
      let component = device?.getComponent('dummy');
      expect(component).toBeUndefined();
      component = device?.getComponent('dummy1');
      expect(component).not.toBeUndefined();
      if (device) device.destroy();
    });

    test('Create a gen 1 device with relay component', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      device?.addComponent(new ShellyComponent('relay:0', 'Relay', device));
      const component = device?.getComponent('relay:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:0');
      expect(component?.name).toBe('Relay');
      if (device) device.destroy();
    });

    test('Create a gen 1 device and test index', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      let component = device?.getComponent('light:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('light:0');
      expect(component?.index).toBe(0);
      expect(component?.name).toBe('Light');

      device?.addComponent(new ShellyComponent('relay:0', 'Relay', device));
      component = device?.getComponent('relay:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:0');
      expect(component?.index).toBe(0);
      expect(component?.name).toBe('Relay');

      device?.addComponent(new ShellyComponent('relay:9', 'Relay', device));
      component = device?.getComponent('relay:9');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:9');
      expect(component?.index).toBe(9);
      expect(component?.name).toBe('Relay');

      device?.addComponent(new ShellyComponent('sys', 'Sys', device));
      component = device?.getComponent('sys');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('sys');
      expect(component?.index).toBe(-1);
      expect(component?.name).toBe('Sys');
      if (device) device.destroy();
    });
  });

  describe('new gen 2 shellyplus2pm', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.218');
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443b23d81f8');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 2 device with name not null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      expect(device?.name).not.toBeNull();
      expect(device?.name).toBe('Device shellyplus2pm');
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 2 device with all components', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      const components = device?.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(11);
      expect(device?.hasComponent('cover:0')).toBeFalsy();
      expect(device?.hasComponent('switch:0')).toBeTruthy();
      expect(device?.hasComponent('switch:1')).toBeTruthy();
      expect(device?.hasComponent('switch:3')).toBeFalsy();
      if (device) device.destroy();
    });

    test('Create a gen 2 device with components name null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      const switch0 = device?.getComponent('switch:0');
      expect(switch0).not.toBeUndefined();
      expect(switch0?.hasProperty('name')).toBeTruthy();
      expect(switch0?.getProperty('name')).not.toBeUndefined();
      expect(switch0?.getValue('name')).toBeNull();

      const switch1 = device?.getComponent('switch:1');
      expect(switch1).not.toBeUndefined();
      expect(switch1?.hasProperty('name')).toBeTruthy();
      expect(switch1?.getProperty('name')).not.toBeUndefined();
      expect(switch1?.getValue('name')).toBeNull();

      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 2 device with cloud property', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      const cloud = device?.getComponent('cloud');
      expect(cloud).not.toBeUndefined();
      expect(cloud?.hasProperty('enable')).toBeTruthy();
      expect(cloud?.hasProperty('disable')).toBeFalsy();
      expect(cloud?.getValue('name')).toBeUndefined();
      expect(cloud?.getValue('server')).not.toBeUndefined();
      expect(cloud?.properties.length).toBeGreaterThan(0);
      expect(cloud?.properties.length).toBeLessThan(3);
      if (cloud) {
        for (const [key, property] of cloud) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(property.key).not.toBeUndefined();
        }
      }
      expect(device?.addComponentProperties('nocomponent', {})).toBeUndefined();
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new gen 2 shellyplus1pm', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.217');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.217');
      expect(device?.model).toBe('SNSW-001P16EU');
      expect(device?.id).toBe('shellyplus1pm-441793d69718');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(2);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new gen 3 shellypmminig3', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.220');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.220');
      expect(device?.model).toBe('S3PM-001PCEU16');
      expect(device?.id).toBe('shellypmminig3-84fce63957f4');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(3);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new gen 3 shelly1minig3', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.221');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.221');
      expect(device?.model).toBe('S3SW-001X8EU');
      expect(device?.id).toBe('shelly1minig3-543204547478');
      expect(device?.firmware).toBe('1.1.99-minig3prod1-ga898543');
      expect(device?.auth).toBe(false);
      expect(device?.gen).toBe(3);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });
});
