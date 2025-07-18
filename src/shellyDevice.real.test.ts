// src/shellyDevice.real.test.ts

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait } from 'matterbridge/utils';
import { jest } from '@jest/globals';

import { ShellyDevice } from './shellyDevice.ts';
import { Shelly } from './shelly.ts';
import { ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

describe('Shellies', () => {
  const log = new AnsiLogger({ logName: 'ShellyDeviceRealTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.4-g6d2a586';
  const address = 'c4:cb:76:b3:cd:1f';

  beforeAll(async () => {
    shelly.dataPath = 'temp';
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (device) {
      shelly.removeDevice(device);
      device.destroy();
      device = undefined;
    }
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(1000);

    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  if (getMacAddress() !== 'address') return;

  describe('new not existing ShellyDevice()', () => {
    test('Create a non existing device', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.250.219');
      expect(device).toBeUndefined();
    }, 300000);

    test('Create a non existing device name', async () => {
      device = await ShellyDevice.create(shelly, log, 'somename');
      expect(device).toBeUndefined();
    }, 300000);
  });

  describe('create real gen 1 shellydimmer2 219 with auth', () => {
    if (getMacAddress() !== address) return;

    test('create a gen 2 device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.219');
      expect(device).toBeDefined();
      if (!device) return;
      expect(device.gen).toBe(1);
      expect(device.host).toBe('192.168.1.219');
      expect(device.model).toBe('SHDM-2');
      expect(device.id).toBe('shellydimmer2-98CDAC0D01BB');
      expect(device.firmware).toBe(firmwareGen1);
      expect(device.auth).toBe(true);

      await device.fetchUpdate();

      device.destroy();
    });
  });

  describe('create real gen 2 shellyplus1pm 217', () => {
    if (getMacAddress() !== address) return;

    test('create a gen 2 device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device.gen).toBe(2);
      expect(device.host).toBe('192.168.1.217');
      expect(device.model).toBe('SNSW-001P16EU');
      expect(device.id).toBe('shellyplus1pm-441793D69718');
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);

      await device.fetchUpdate();

      device.destroy();
    });

    test('send legacy command to a gen 2 shellyplus1pm device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      expect(device.getComponent('switch:1')).toBeUndefined();
      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) return;

      // console.log(wr, 'shellyplus1pm 2');
      expect(component).not.toBeUndefined();
      const stateProp = component.getProperty('state');
      expect(stateProp).not.toBeUndefined();
      const outputProp = component.getProperty('output');
      expect(outputProp).not.toBeUndefined();
      const state = stateProp?.value;
      const output = outputProp?.value;
      // console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { turn: 'toggle' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      const stateProp2 = component.getProperty('state');
      expect(stateProp2).not.toBeUndefined();
      const outputProp2 = component.getProperty('output');
      expect(outputProp2).not.toBeUndefined();
      // console.log(`state2: ${stateProp2?.value} output2: ${outputProp2?.value}`);
      expect(stateProp2?.value === outputProp2?.value).toBeTruthy();
      // console.log(`state: ${state} state2: ${stateProp2?.value}`);
      expect(state === stateProp2?.value).toBeTruthy();
      expect(stateProp?.value === stateProp2?.value).toBeTruthy();
      device.destroy();
    });

    test('send rpc command to a gen 2 shellyplus1pm device', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) return;

      let response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Toggle', { id: 0 });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { id: 0, on: false });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { id: 0, on: true });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'Switch.Set', { id: 0, on: false });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      device.destroy();
    });

    test('send legacy command relay to a gen 2 shellyplus1pm device', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();
      if (!component) return;

      let response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { turn: 'toggle' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { turn: 'on' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { turn: 'off' });
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      device.destroy();
    });

    test('execute On() Off() Toggle() for a gen 2 shellyplus1pm device', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('switch:0') as ShellySwitchComponent;
      expect(component).not.toBeUndefined();
      if (!component) return;

      component.On();
      component.Off();
      component.Toggle();
      component.Off();
      device.destroy();
    });

    test('execute Open() Close() Stop() for a gen 2 device', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;

      const component = device.getComponent('cover:0') as ShellyCoverComponent;
      if (!component) return;

      component.Open();
      component.Stop();
      component.Close();
      device.destroy();
    });
  });

  describe('create real gen 2 shellyplus2pm 218', () => {
    if (getMacAddress() !== address) return;

    test('send command to a gen 2 device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;
      expect(device).not.toBeUndefined();
      expect(device.gen).toBe(2);
      expect(device.host).toBe('192.168.1.218');
      expect(device.model).toBe('SNSW-102P16EU');
      expect(device.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(true);

      await device.fetchUpdate();

      const component = device.getComponent('switch:1');
      if (!component) return; // roller mode

      expect(component).not.toBeUndefined();
      const stateP = component.getProperty('state');
      const outputP = component.getProperty('output');
      const state = stateP?.value;
      const output = outputP?.value;
      // console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/1', { turn: 'toggle' });
      expect(res).not.toBeUndefined();
      await device.fetchUpdate();
      const state2 = component.getProperty('state');
      const output2 = component.getProperty('output');
      // console.log(`state2: ${state2?.value} output2: ${output2?.value}`);
      expect(state2?.value === output2?.value).toBeTruthy();
      // console.log(`state: ${state} state2: ${state2?.value}`);
      expect(state === state2?.value).toBeTruthy();
      expect(stateP?.value === state2?.value).toBeTruthy();
      device.destroy();
    });

    test('send wrong command to a gen 2 device and update', async () => {
      device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;

      // console.log('send wrong command to a gen 2 device and update');
      let res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/5', { turn: 'toggle' });
      expect(res).toBeNull();
      // console.log('send wrong command to a gen 2 device and update');
      res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/0', { turn: 'toggle' });
      expect(res).toBeNull();
      device.destroy();
    }, 60000);
  });
});
