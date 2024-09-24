/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { jest } from '@jest/globals';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';

describe('Shellies', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'ShellyDeviceRealTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const shelly = new Shelly(log, 'admin', 'tango');
  let device: ShellyDevice | undefined;

  const firmwareGen1 = 'v1.14.0-gcb84623';
  const firmwareGen2 = '1.4.2-gc2639da';

  beforeAll(async () => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // consoleLogSpy.mockRestore();
    shelly.setLogLevel(LogLevel.DEBUG, true, true, true);
    await wait(2000);
  });

  beforeEach(async () => {
    await wait(1000);
  });

  afterEach(async () => {
    if (device) {
      shelly.removeDevice(device);
      device.destroy();
      device = undefined;
    }
    await wait(1000);
  });

  afterAll(async () => {
    shelly.destroy();
    await wait(2000);
  });

  test('Create AnsiLogger and Shelly', () => {
    expect(log).toBeDefined();
    expect(shelly).toBeDefined();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
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

  describe('create real gen 2 shellyplus1pm 217', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;
    test('create a gen 2 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
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
      // console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const response = await ShellyDevice.fetch(shelly, log, '192.168.1.217', 'relay/0', { 'turn': 'toggle' });
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
      expect(response).not.toBeUndefined();
      await device.fetchUpdate();
      device.destroy();
    });

    test('send legacy command relay to a gen 2 shellyplus1pm device', async () => {
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

    test('execute On() Off() Toggle() for a gen 2 shellyplus1pm device', async () => {
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

    test('execute Open() Close() Stop() for a gen 2 device', async () => {
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
      expect(device?.firmware).toBe(firmwareGen2);
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
      // console.log(`state: ${state} output: ${output}`);
      expect(state === output).toBeTruthy();
      const res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/1', { 'turn': 'toggle' });
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
      const device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;
      // console.log('send wrong command to a gen 2 device and update');
      let res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/5', { 'turn': 'toggle' });
      expect(res).toBeNull();
      // console.log('send wrong command to a gen 2 device and update');
      res = await ShellyDevice.fetch(shelly, log, '192.168.1.218', 'relay/0', { 'turn': 'toggle' });
      expect(res).toBeNull();
      device.destroy();
    });
  });
*/

  describe('test real gen 2 shellyplus1pm 217 with auth', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;

    test('create a gen 2 shellyplus1pm 217 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.217');
      expect(device).not.toBeUndefined();
      if (!device) return;
      shelly.addDevice(device);
      (device as any).wsClient?.start();

      expect(device.gen).toBe(2);
      expect(device.host).toBe('192.168.1.217');
      expect(device.model).toBe('SNSW-001P16EU');
      expect(device.mac).toBe('441793D69718');
      expect(device.id).toBe('shellyplus1pm-441793D69718');
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);

      await device.fetchUpdate();

      await device.saveDevicePayloads('temp');

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();

      // prettier-ignore
      if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

      shelly.removeDevice(device);
      device.destroy();
    }, 20000);
  });

  describe('test real gen 2 shellyplus2pm 218 with auth', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;

    test('create a gen 2 shellyplus2pm 218 cover device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.218');
      expect(device).not.toBeUndefined();
      if (!device) return;
      shelly.addDevice(device);
      (device as any).wsClient?.start();

      expect(device.gen).toBe(2);
      expect(device.host).toBe('192.168.1.218');
      expect(device.model).toBe('SNSW-102P16EU');
      expect(device.mac).toBe('5443B23D81F8');
      expect(device.id).toBe('shellyplus2pm-5443B23D81F8');
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(false);

      await device.fetchUpdate();

      await device.saveDevicePayloads('temp');

      const cover = device.getComponent('cover:0');
      expect(cover).not.toBeUndefined();

      // prettier-ignore
      if (isCoverComponent(cover)) {
        cover.Open();
        await waiter('Open()', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
        await waiter('Open() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'open'; }, true, 30000);
        expect(cover.getValue('source')).toMatch(/^(limit_switch|timeout)$/); // 'limit_switch' if not stopped for timeout
        expect(cover.getValue('state')).toMatch(/^(open|stopped)$/); // 'open' if not stopped for timeout
        expect(cover.getValue('last_direction')).toBe('open');
        expect(cover.getValue('current_pos')).toBe(100);

        cover.Close();
        await wait(2000);
        cover.Stop();
        await waiter('Stop()', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
        expect(cover.getValue('state')).toBe('stopped');
        expect(cover.getValue('last_direction')).toBe('open');
        expect(cover.getValue('current_pos')).toBe(100);

        cover.Close();
        await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
        await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
        expect(cover.getValue('source')).toMatch(/^(HTTP_in|timeout)$/); // 'HTTP_in' if not stopped for timeout
        expect(cover.getValue('state')).toMatch(/^(closed|stopped)$/); // 'closed' if not stopped for timeout
        expect(cover.getValue('last_direction')).toBe('close');
        expect(cover.getValue('current_pos')).toBe(0);

        cover.GoToPosition(10);
        await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'opening'; }, true, 30000);
        await waiter('GoToPosition(10)', () => { return cover.getValue('state') === 'stopped'; }, true, 30000);
        expect(cover.getValue('source')).toBe('timeout');
        expect(cover.getValue('state')).toBe('stopped');
        expect(cover.getValue('last_direction')).toBe('open');
        expect(cover.getValue('current_pos')).toBe(10);

        cover.Close();
        await waiter('Close()', () => { return cover.getValue('state') === 'closing'; }, true, 30000);
        await waiter('Close() II', () => { return cover.getValue('state') === 'stopped' || cover.getValue('state') === 'closed'; }, true, 30000);
        expect(cover.getValue('source')).toMatch(/^(HTTP_in|timeout)$/); // 'HTTP_in' if not stopped for timeout
        expect(cover.getValue('state')).toMatch(/^(closed|stopped)$/); // 'closed' if not stopped for timeout
        expect(cover.getValue('last_direction')).toBe('close');
        expect(cover.getValue('current_pos')).toBe(0);
      }

      shelly.removeDevice(device);
      device.destroy();
    }, 120000);
  });

  describe('test real gen 3 shelly1minig3 221 with auth', () => {
    if (getMacAddress() !== '30:f6:ef:69:2b:c5') return;

    test('create a gen 3 shelly1minig3 device and update', async () => {
      const device = await ShellyDevice.create(shelly, log, '192.168.1.221');
      expect(device).not.toBeUndefined();
      if (!device) return;
      shelly.addDevice(device);
      (device as any).wsClient?.start();

      expect(device.gen).toBe(3);
      expect(device.host).toBe('192.168.1.221');
      expect(device.model).toBe('S3SW-001X8EU');
      expect(device.mac).toBe('543204547478');
      expect(device.id).toBe('shelly1minig3-543204547478');
      expect(device.firmware).toBe(firmwareGen2);
      expect(device.auth).toBe(true);

      await device.fetchUpdate();

      await device.saveDevicePayloads('temp');

      const component = device.getComponent('switch:0');
      expect(component).not.toBeUndefined();

      // prettier-ignore
      if (isSwitchComponent(component)) {
        component.On();
        await waiter('On', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);

        component.Toggle();
        await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

        component.Off();
        await waiter('Off', () => { return component.getValue('state') === false; }, true);
      }

      shelly.removeDevice(device);
      device.destroy();
    }, 30000);
  });
});
