/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
// import { ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent';
import { AnsiLogger, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress } from 'matterbridge/utils';
import { jest } from '@jest/globals';
import { ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';

describe('Shellies', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');

  const firmwareGen1 = '1.14.0-gcb84623';
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

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  describe('new not existing ShellyDevice()', () => {
    test('Create a non existing device', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.250.219');
      expect(device).toBeUndefined();
    }, 300000);

    test('Create a non existing device name', async () => {
      const device = await ShellyDevice.create(shelly, log, 'somename');
      expect(device).toBeUndefined();
    }, 300000);
  });

  describe('create real gen 1 shellydimmer2 219', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;
    test('create a gen 1 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.219');
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device?.gen).toBe(1);
      expect(device?.host).toBe('192.168.1.219');
      expect(device?.model).toBe('SHDM-2');
      expect(device?.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device?.firmware).toBe('v1.14.0-gcb84623');
      expect(device?.auth).toBe(true);

      await device.fetchUpdate();

      device.destroy();
    });
  });

  describe('create real gen 2 shellyplus1pm 217', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;
    test('create a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device?.gen).toBe(2);
      expect(device?.host).toBe('192.168.1.217');
      expect(device?.model).toBe('SNSW-001P16EU');
      expect(device?.id).toBe('shellyplus1pm-441793D69718');
      expect(device?.firmware).toBe('1.4.2-beta1-g84969a6'); // firmwareGen2
      expect(device?.auth).toBe(false);

      await device.fetchUpdate();

      device.destroy();
    });

    test('send legacy command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      expect(device.getComponent('switch:1')).toBeUndefined();
      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) {
        device.destroy();
        return;
      }
      // console.log(wr, 'shellyplus1pm 2');
      expect(component).not.toBeUndefined();
      const stateProp = component.getProperty('state');
      expect(stateProp).not.toBeUndefined();
      const outputProp = component.getProperty('output');
      expect(outputProp).not.toBeUndefined();
      const state = stateProp?.value;
      const output = outputProp?.value;
      console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { 'turn': 'toggle' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      const stateProp2 = component.getProperty('state');
      expect(stateProp2).not.toBeUndefined();
      const outputProp2 = component.getProperty('output');
      expect(outputProp2).not.toBeUndefined();
      console.log(`state2: ${stateProp2?.value} output2: ${outputProp2?.value}`);
      expect(stateProp2?.value === outputProp2?.value).toBeTruthy();
      console.log(`state: ${state} state2: ${stateProp2?.value}`);
      expect(state === stateProp2?.value).toBeTruthy();
      expect(stateProp?.value === stateProp2?.value).toBeTruthy();
      device.destroy();
    });

    test('send rpc command to a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) {
        device.destroy();
        return;
      }
      let response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Toggle', { 'id': 0 });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { 'id': 0, 'on': false });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { 'id': 0, 'on': true });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { 'id': 0, 'on': false });
      device.destroy();
    });

    test('send legacy command relay to a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) {
        device.destroy();
        return;
      }
      let response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { 'turn': 'toggle' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { 'turn': 'on' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { 'turn': 'off' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      device.destroy();
    });

    test('execute On() Off() Toggle() for a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0') as ShellySwitchComponent;
      expect(component).not.toBeUndefined();
      if (!component) {
        device.destroy();
        return;
      }
      component.On();
      // expect(component.getProperty('state')?.value).toBe(true);
      component.Off();
      // expect(component.getProperty('state')?.value).toBe(false);
      component.Toggle();
      // expect(component.getProperty('state')?.value).toBe(true);
      component.Off();
      // expect(component.getProperty('state')?.value).toBe(false);
      device.destroy();
    });

    test('execute Open() CLose() Stop() for a gen 2 device', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('cover:0') as ShellyCoverComponent;
      if (!component) {
        device.destroy();
        return;
      }
      component.Open();
      // expect(component.getProperty('state')?.value).toBe('open');
      component.Stop();
      // expect(component.getProperty('state')?.value).toBe('stop');
      component.Close();
      // expect(component.getProperty('state')?.value).toBe('close');
      device.destroy();
    });
  });

  describe('create real gen 2 shellyplus2pm 218', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;
    test('send command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device?.gen).toBe(2);
      expect(device?.host).toBe('192.168.1.218');
      expect(device?.model).toBe('SNSW-102P16EU');
      expect(device?.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device?.firmware).toBe('1.4.2-beta1-g84969a6'); // firmwareGen2
      expect(device?.auth).toBe(false);

      await device.fetchUpdate();

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
      const res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/1', { 'turn': 'toggle' });
      expect(res).not.toBeUndefined();
      await device.fetchUpdate();
      const state2 = component.getProperty('state');
      const output2 = component.getProperty('output');
      console.log(`state2: ${state2?.value} output2: ${output2?.value}`);
      expect(state2?.value === output2?.value).toBeTruthy();
      console.log(`state: ${state} state2: ${state2?.value}`);
      expect(state === state2?.value).toBeTruthy();
      expect(stateP?.value === state2?.value).toBeTruthy();
      device.destroy();
    });

    test('send wrong command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;
      console.log('send wrong command to a gen 2 device and update');
      let res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/5', { 'turn': 'toggle' });
      expect(res).toBeNull();
      console.log('send wrong command to a gen 2 device and update');
      res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/0', { 'turn': 'toggle' });
      expect(res).toBeNull();
      device.destroy();
    });
  });

  describe('create real gen 3 shelly1minig3 221 with auth', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;
    test('send command to a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.221');
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device.gen).toBe(3);
      expect(device.host).toBe('192.168.1.221');
      expect(device.model).toBe('S3SW-001X8EU');
      expect(device.id).toBe('shelly1minig3-543204547478');
      expect(device.firmware).toBe(firmwareGen2); // firmwareGen2
      expect(device.auth).toBe(true);

      await device.fetchUpdate();

      await device.saveDevicePayloads('temp');

      device.destroy();
    });
  });
});
