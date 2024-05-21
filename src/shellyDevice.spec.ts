/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { ShellyDevice, ShellyComponent, ShellyProperty, ShellyDataType, ShellyData } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { shellydimmer2Settings } from './shellydimmer2.js';
import { getInterfaceAddress } from './coapScanner.js';
import { get } from 'http';

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

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  describe('new not existing ShellyDevice()', () => {
    test('Create a non existing device', async () => {
      const device = await ShellyDevice.create(log, '192.168.250.219');
      expect(device).toBeUndefined();
    }, 30000);

    test('Create a non existing device name', async () => {
      const device = await ShellyDevice.create(log, 'somename');
      expect(device).toBeUndefined();
    }, 30000);
  });
  */

  describe('new gen 1 ShellyDevice()', () => {
    test('Create a gen 1 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.219');
      expect(device?.model).toBe('SHDM-2');
      expect(device?.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device?.firmware).toBe('v1.14.0-gcb84623');
      expect(device?.auth).toBe(false);
      if (device) device.destroy();
    });

    test('Create a gen 1 device with name = null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.name).toBeNull();
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 1 device with all components', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      const components = device?.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(8);
      if (device) device.destroy();
    });

    test('Create a gen 1 device with a name', async () => {
      shellydimmer2Settings.name = 'my dimmer';
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.name).toBe('my dimmer');
      if (device) device.destroy();
    });

    test('Create a gen 1 device with components WiFi', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
      expect(device?.hasComponent('wifi_ap')).toBeTruthy();
      expect(device?.hasComponent('wifi_sta')).toBeTruthy();
      expect(device?.hasComponent('wifi_sta1')).toBeTruthy();
      if (device) device.destroy();
    });

    test('Create a gen 1 device with dummy component', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
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
      device?.addComponent(new ShellyComponent('relay:0', 'Relay', device));
      const component = device?.getComponent('relay:0');
      expect(component).not.toBeUndefined();
      expect(component?.id).toBe('relay:0');
      expect(component?.name).toBe('Relay');
      if (device) device.destroy();
    });
  });

  describe('new gen 2 ShellyDevice()', () => {
    test('Create a gen 2 device', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device).not.toBeUndefined();
      expect(device?.host).toBe('192.168.1.218');
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443b23d81f8');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 1 device with name not null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      expect(device?.name).not.toBeNull();
      expect(device?.name).toBe('Device shellyplus2pm');
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });

    test('Create a gen 1 device with all components', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      const components = device?.components;
      expect(components).toBeDefined();
      expect(components?.length).toBe(10);
      expect(device?.hasComponent('switch:0')).toBeTruthy();
      expect(device?.hasComponent('switch:1')).toBeTruthy();
      expect(device?.hasComponent('switch:3')).toBeFalsy();
      if (device) device.destroy();
    });

    test('Create a gen 1 device with components name null', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
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

    test('Create a gen 1 device with cloud property', async () => {
      const device = await ShellyDevice.create(log, 'mock.192.168.1.218');
      const switch0 = device?.getComponent('cloud');
      expect(switch0).not.toBeUndefined();
      expect(switch0?.hasProperty('enable')).toBeTruthy();
      expect(switch0?.hasProperty('disable')).toBeFalsy();
      expect(switch0?.getValue('name')).toBeUndefined();
      expect(switch0?.getValue('server')).not.toBeUndefined();
      expect(switch0?.properties.length).toBeGreaterThan(0);
      expect(switch0?.properties.length).toBeLessThan(3);
      if (switch0) {
        for (const [key, property] of switch0) {
          // eslint-disable-next-line jest/no-conditional-expect
          expect(property.key).not.toBeUndefined();
        }
      }
      expect(device?.addComponentProperties('nocomponent', {})).toBeUndefined();
      if (device) device.destroy();
      expect(device?.lastseen).toBe(0);
    });
  });

  describe('new real gen 1 ShellyDevice()', () => {
    if (getInterfaceAddress() !== '192.168.1.189') return;

    test('create a gen 1 device and update', async () => {
      const device = await ShellyDevice.create(log, '192.168.1.219');
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device?.gen).toBe(1);
      expect(device?.host).toBe('192.168.1.219');
      expect(device?.model).toBe('SHDM-2');
      expect(device?.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device?.firmware).toBe('v1.14.0-gcb84623');
      expect(device?.auth).toBe(false);

      await device.fetchUpdate();

      log.warn(`Device: ${device.id}`);
      for (const [key, component] of device) {
        log.info(`Component: ${key} (${component.name})`);
        for (const [key, property] of component) {
          log.info(` - property: ${key} = ${property.value}`);
        }
        await component.fetchUpdate();
        component.logComponent();
      }
      device.logDevice();
      if (device) device.destroy();
    });
  });

  describe('new real gen 2 ShellyDevice()', () => {
    test('create a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(log, '192.168.1.217');
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device?.gen).toBe(2);
      expect(device?.host).toBe('192.168.1.217');
      expect(device?.model).toBe('SNSW-001P16EU');
      expect(device?.id).toBe('shellyplus1pm-441793d69718');
      expect(device?.firmware).toBe('1.3.1-gd8534ee');
      expect(device?.auth).toBe(false);

      await device.fetchUpdate();

      log.warn(`Device: ${device.id}`);
      for (const [key, component] of device) {
        log.info(`Component: ${key} (${component.name})`);
        for (const [key, property] of component) {
          log.info(` - property: ${key} = ${property.value}`);
        }
        await component.fetchUpdate();
        component.logComponent();
      }

      device.logDevice();
      if (device) device.destroy();
    });

    test('send command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:1');
      if (!component) {
        device.destroy();
        return; // roller mode
      }
      expect(component).not.toBeUndefined();
      const stateP = component.getProperty('state');
      const outputP = component.getProperty('output');
      const state = stateP?.value;
      const output = outputP?.value;
      console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const res = await device.sendCommand('192.168.1.218', 'relay', 1, 'turn=toggle');
      expect(res).not.toBeUndefined();
      await component.fetchUpdate();
      const state2 = component.getProperty('state');
      const output2 = component.getProperty('output');
      console.log(`state2: ${state2?.value} output2: ${output2?.value}`);
      expect(state2?.value === output2?.value).toBeTruthy();
      console.log(`state: ${state} state2: ${state2?.value}`);
      expect(state === state2?.value).toBeFalsy();
      expect(stateP?.value === state2?.value).toBeTruthy();
      device.destroy();
    });

    test('send wrong command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return; // ss
      let res = await device.sendCommand('192.168.1.218', 'relay', 5, 'turn=toggle');
      expect(res).toBeUndefined();
      res = await device.sendCommand('192.168.1.218', 'relay', 0, 'turn=toggles');
      expect(res).toBeUndefined();
      device.destroy();
    });
  });
});
