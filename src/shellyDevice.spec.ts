/* eslint-disable @typescript-eslint/no-unused-vars */
// import fetch, { Response } from 'node-fetch';
import { jest } from '@jest/globals';
import { ShellyDevice, ShellyComponent, ShellyProperty, ShellyDataType, ShellyData, shellyDimmerSettings } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import exp from 'constants';

//jest.mock('node-fetch', () => jest.fn());
//jest.unstable_mockModule('node-fetch', () => {
//const fetch = jest.fn();
// );
// const { fetch } = await import('node-fetch');

describe('Shellies', () => {
  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

  beforeAll(() => {});

  beforeEach(() => {
    //(fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    //jest.clearAllMocks();
  });

  afterAll(() => {});

  /*
  describe('new not existing ShellyDevice()', () => {
    test('Create a non existing device', async () => {
      const device = await ShellyDevice.create(log, '192.168.1.219');
      expect(device).toBeUndefined;
    }, 30000);
  });
  */

  describe('new gen 1 ShellyDevice()', () => {
    test('Create a gen 1 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined;
      expect(device?.host).toBe('192.168.1.219');
      expect(device?.model).toBe('SHDM-2');
      expect(device?.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device?.firmware).toBe('v1.14.0-gcb84623');
      expect(device?.auth).toBe(false);
    });

    test('Create a gen 1 device with name = null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.name).toBeNull;
    });

    test('Create a gen 1 device with all components', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      const components = device?.components;
      expect(components).toBeDefined;
      expect(components?.length).toBe(8);
    });

    test('Create a gen 1 device with a name', async () => {
      shellyDimmerSettings.name = 'my dimmer';
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.name).toBe('my dimmer');
    });

    test('Create a gen 1 device with components WiFi', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.hasComponent('wifi_ap')).toBeTruthy;
      expect(device?.hasComponent('wifi_sta')).toBeTruthy;
      expect(device?.hasComponent('wifi_sta1')).toBeTruthy;
    });

    test('Create a gen 1 device with dummy component', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      device?.addComponent(new ShellyComponent('dummy1', 'dummy'));
      expect(device?.hasComponent('dummy1')).toBeTruthy;
      expect(device?.hasComponent('dummy')).toBeFalsy;
      let component = device?.getComponent('dummy');
      expect(component).toBeUndefined;
      component = device?.getComponent('dummy1');
      expect(component).not.toBeUndefined;
    });

    test('Create a gen 1 device with relay component', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      device?.addComponent(new ShellyComponent('relay:0', 'Relay'));
      const component = device?.getComponent('relay:0');
      expect(component).not.toBeUndefined;
      expect(component?.id).toBe('relay:0');
      expect(component?.name).toBe('Relay');
    });
  });
});
