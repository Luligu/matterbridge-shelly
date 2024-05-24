/* eslint-disable jest/no-done-callback */
import { AnsiLogger, TimestampFormat } from 'node-ansi-logger';
import { Shelly } from './shelly.js';
import { ShellyDevice } from './shellyDevice.js';

describe('Shellies test', () => {
  const log = new AnsiLogger({ logName: 'shellyDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  const shellies = new Shelly(log);

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    shellies.destroy();
  });

  test('Constructor', () => {
    expect(shellies).not.toBeUndefined();
  });

  test('Empty shellies', () => {
    expect(shellies.devices.length).toBe(0);
  });

  test('Check has/get device', async () => {
    const device = await ShellyDevice.create(log, 'mock.192.168.1.219');
    if (!device) return;
    expect(shellies.hasDevice(device.id)).toBeFalsy();
    expect(shellies.getDevice(device.id)).toBeUndefined();
    device.destroy();
  });

  test('Check add device gen 1', async () => {
    const device1g = await ShellyDevice.create(log, '192.168.1.219');
    if (!device1g) return;
    expect(shellies.devices.length).toBe(0);
    expect(shellies.addDevice(device1g)).toBe(shellies);
    expect(shellies.hasDevice(device1g.id)).toBeTruthy();
    expect(shellies.getDevice(device1g.id)).toBe(device1g);
    expect(shellies.devices.length).toBe(1);
  });

  test('Check add device gen 2', async () => {
    const device2g = await ShellyDevice.create(log, '192.168.1.217');
    if (!device2g) return;
    expect(shellies.devices.length).toBe(1);
    expect(shellies.hasDevice(device2g.id)).toBeFalsy();
    expect(shellies.getDevice(device2g.id)).toBeUndefined();
    expect(shellies.addDevice(device2g)).toBe(shellies);
    expect(shellies.devices.length).toBe(2);
  });

  test('Check add device gen 3', async () => {
    const device3g = await ShellyDevice.create(log, '192.168.1.220');
    if (!device3g) return;
    expect(shellies.devices.length).toBe(2);
    expect(shellies.hasDevice(device3g.id)).toBeFalsy();
    expect(shellies.getDevice(device3g.id)).toBeUndefined();
    expect(shellies.addDevice(device3g)).toBe(shellies);
    expect(shellies.devices.length).toBe(3);
  });

  test('Log 3 devices', async () => {
    expect(shellies.devices.length).toBe(3);
    shellies.logDevices();
    expect(shellies.devices.length).toBe(3);
  });

  test('Destroy 3 devices', async () => {
    expect(shellies.devices.length).toBe(3);
    for (const [id, device] of shellies) {
      if (device.model === 'SHDM-2') shellies.removeDevice(device.id);
      else shellies.removeDevice(device);
      expect(shellies.hasDevice(id)).toBeFalsy();
      device.destroy();
    }
    expect(shellies.devices.length).toBe(0);
  });

  test('Start discover', (done) => {
    shellies.discover();
    setTimeout(() => {
      shellies.destroy();
      done();
      expect(shellies.devices.length).toBe(0);
    }, 20000);
  }, 25000);
});
