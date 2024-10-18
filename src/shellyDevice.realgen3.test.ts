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

  const firmwareGen2 = '1.4.4-g6d2a586';
  const address = '30:f6:ef:69:2b:c5';

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

  test('create a gen 3 shelly1minig3 device and update', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.221');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.221');
    expect(device.model).toBe('S3SW-001X8EU');
    expect(device.mac).toBe('543204547478');
    expect(device.id).toBe('shelly1minig3-543204547478');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(true);
    expect(device.name).toBe('1mini Gen3');

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

  test('create a gen 3 shelly1g3 device and update', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.157');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.157');
    expect(device.model).toBe('S3SW-001X16EU');
    expect(device.mac).toBe('34B7DACAC830');
    expect(device.id).toBe('shelly1g3-34B7DACAC830');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('1 Gen3');

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

  test('create a gen 3 shelly1pmminig3 device and update', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.225');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.225');
    expect(device.model).toBe('S3SW-001P8EU');
    expect(device.mac).toBe('543204519264');
    expect(device.id).toBe('shelly1pmminig3-543204519264');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe(firmwareGen2);
    expect(device.auth).toBe(false);
    expect(device.name).toBe('1PMmini Gen3');

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

  test('create a gen 3 shelly2pmg3 device and update', async () => {
    if (getMacAddress() !== address) return;
    device = await ShellyDevice.create(shelly, log, '192.168.1.166');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.166');
    expect(device.model).toBe('S3SW-002P16EU');
    expect(device.mac).toBe('34CDB0770C4C');
    expect(device.id).toBe('shelly2pmg3-34CDB0770C4C');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.99-2pmg3prod0-ge3db05c'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('2PM Gen3');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeDevices.size).toBe(1);
    expect(device.bthomeDevices.has('7c:c6:b6:58:b9:a0')).toBe(true);
    expect(device.bthomeDevices.get('7c:c6:b6:58:b9:a0')?.model).toBe('Shelly BLU RC Button 4');

    expect(device.bthomeSensors.size).toBe(5);
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(1);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(2);

    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('7c:c6:b6:58:b9:a0');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(3);
    expect(device.bthomeTrvs.size).toBe(0);

    const component = device.getComponent('switch:0');
    expect(component).not.toBeUndefined();
    expect(component?.getValue('voltage')).toBeGreaterThan(200);
    expect(component?.hasProperty('apower')).toBe(true);
    expect(component?.hasProperty('current')).toBe(true);
    expect(component?.hasProperty('aenergy')).toBe(true);
    expect(component?.hasProperty('freq')).toBe(true);

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

    const component1 = device.getComponent('switch:1');
    expect(component1).not.toBeUndefined();
    expect(component1?.getValue('voltage')).toBeGreaterThan(200);
    expect(component1?.hasProperty('apower')).toBe(true);
    expect(component1?.hasProperty('current')).toBe(true);
    expect(component1?.hasProperty('aenergy')).toBe(true);
    expect(component1?.hasProperty('freq')).toBe(true);

    // prettier-ignore
    if (isSwitchComponent(component1)) {
      component1.On();
      await waiter('On', () => { return component1.getValue('state') === true; }, true);

      component1.Off();
      await waiter('Off', () => { return component1.getValue('state') === false; }, true);

      component1.Toggle();
      await waiter('Toggle', () => { return component1.getValue('state') === true; }, true);

      component1.Off();
      await waiter('Off', () => { return component1.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);

  test('Create a gen 3 shellyddimmerg3 device and update', async () => {
    device = await ShellyDevice.create(shelly, log, '192.168.1.242');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.host).toBe('192.168.1.242');
    expect(device.mac).toBe('84FCE636832C');
    expect(device.profile).toBe(undefined);
    expect(device.model).toBe('S3DM-0A1WW');
    expect(device.id).toBe('shellyddimmerg3-84FCE636832C');
    expect(device.firmware).toBe('g55db545'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.gen).toBe(3);
    expect(device.hasUpdate).toBe(false);
    expect(device.username).toBe('admin');
    expect(device.password).toBe('tango');
    expect(device.name).toBe('DALI Dimmer Gen3');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    const component = device.getComponent('light:0');
    expect(component).not.toBeUndefined();

    // prettier-ignore
    if (isLightComponent(component)) {
      component.On();
      await waiter('On', () => { return component.getValue('state') === true; }, true);

      component.Level(100);
      await waiter('Level(100)', () => { return component.getValue('brightness') === 100; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);

      component.Level(50);
      await waiter('Level(50)', () => { return component.getValue('brightness') === 50; }, true); 

      component.Toggle();
      await waiter('Toggle', () => { return component.getValue('state') === true; }, true);

      component.Level(1);
      await waiter('Level(1)', () => { return component.getValue('brightness') === 1; }, true);

      component.Off();
      await waiter('Off', () => { return component.getValue('state') === false; }, true);
    }

    shelly.removeDevice(device);
    device.destroy();
  }, 20000);

  test('create a gen 3 shellyblugwg3 device and update', async () => {
    if (getMacAddress() !== address) return;
    // consoleLogSpy.mockRestore();

    device = await ShellyDevice.create(shelly, log, '192.168.1.164');
    expect(device).not.toBeUndefined();
    if (!device) return;
    shelly.addDevice(device);
    expect((device as any).wsClient).not.toBeUndefined();
    (device as any).wsClient?.start();

    expect(device.gen).toBe(3);
    expect(device.host).toBe('192.168.1.164');
    expect(device.model).toBe('S3GW-1DBT001');
    expect(device.mac).toBe('34CDB077BCD4');
    expect(device.id).toBe('shellyblugwg3-34CDB077BCD4');
    expect(device.hasUpdate).toBe(false);
    expect(device.firmware).toBe('1.4.99-blugwg3prod2-g689f175'); // firmwareGen2
    expect(device.auth).toBe(false);
    expect(device.name).toBe('BLU Gateway Gen3');

    await device.fetchUpdate();

    await device.saveDevicePayloads('temp');

    expect(device.bthomeTrvs.size).toBe(2);
    expect(device.bthomeTrvs.has('28:68:47:fc:9a:6b')).toBe(true);
    expect(device.bthomeTrvs.get('28:68:47:fc:9a:6b')?.id).toBe(200);
    expect(device.bthomeTrvs.get('28:68:47:fc:9a:6b')?.bthomedevice).toBe('bthomedevice:200');
    expect(device.bthomeTrvs.has('28:db:a7:b5:d1:ca')).toBe(true);
    expect(device.bthomeTrvs.get('28:db:a7:b5:d1:ca')?.id).toBe(201);
    expect(device.bthomeTrvs.get('28:db:a7:b5:d1:ca')?.bthomedevice).toBe('bthomedevice:203');

    expect(device.bthomeDevices.size).toBe(5);
    expect(device.bthomeDevices.has('28:68:47:fc:9a:6b')).toBe(true);
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.model).toBe('Shelly BLU Trv');
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.id).toBe(200);
    expect(device.bthomeDevices.get('28:68:47:fc:9a:6b')?.blutrv_id).toBe(200);
    expect(device.bthomeDevices.has('28:db:a7:b5:d1:ca')).toBe(true);
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.model).toBe('Shelly BLU Trv');
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.id).toBe(203);
    expect(device.bthomeDevices.get('28:db:a7:b5:d1:ca')?.blutrv_id).toBe(201);

    // TRV 200
    expect(device.bthomeSensors.size).toBe(20);
    expect(device.bthomeSensors.has('bthomesensor:200')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:200')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:200')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:200')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:201')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:201')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:201')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:201')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:202')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:202')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:202')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:202')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:203')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:203')?.addr).toBe('28:68:47:fc:9a:6b');
    expect(device.bthomeSensors.get('bthomesensor:203')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:203')?.sensorIdx).toBe(1);

    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:204')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:204')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:204')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:204')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:205')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:205')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:205')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:205')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:206')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:206')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:206')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:206')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:207')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:207')?.addr).toBe('7c:c6:b6:65:2d:87');
    expect(device.bthomeSensors.get('bthomesensor:207')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:207')?.sensorIdx).toBe(0);

    // BLU DoorWindow
    expect(device.bthomeSensors.has('bthomesensor:208')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:208')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:208')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:208')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:209')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:209')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:209')?.name).toBe('Illuminance');
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorId).toBe(5);
    expect(device.bthomeSensors.get('bthomesensor:209')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:210')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:210')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:210')?.name).toBe('Contact');
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorId).toBe(45);
    expect(device.bthomeSensors.get('bthomesensor:210')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:211')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:211')?.addr).toBe('0c:ef:f6:f1:d7:7b');
    expect(device.bthomeSensors.get('bthomesensor:211')?.name).toBe('Rotation');
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorId).toBe(63);
    expect(device.bthomeSensors.get('bthomesensor:211')?.sensorIdx).toBe(0);

    // TRV 201
    expect(device.bthomeSensors.has('bthomesensor:212')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:212')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:212')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:212')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:213')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:213')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:213')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:213')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:214')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:214')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:214')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:214')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:215')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:215')?.addr).toBe('28:db:a7:b5:d1:ca');
    expect(device.bthomeSensors.get('bthomesensor:215')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:215')?.sensorIdx).toBe(1);

    // BLU HT
    expect(device.bthomeSensors.has('bthomesensor:216')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:216')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:216')?.name).toBe('Battery');
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorId).toBe(1);
    expect(device.bthomeSensors.get('bthomesensor:216')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:217')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:217')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:217')?.name).toBe('Humidity');
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorId).toBe(46);
    expect(device.bthomeSensors.get('bthomesensor:217')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:218')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:218')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:218')?.name).toBe('Button');
    expect(device.bthomeSensors.get('bthomesensor:218')?.sensorId).toBe(58);
    expect(device.bthomeSensors.get('bthomesensor:218')?.sensorIdx).toBe(0);

    expect(device.bthomeSensors.has('bthomesensor:219')).toBe(true);
    expect(device.bthomeSensors.get('bthomesensor:219')?.addr).toBe('7c:c6:b6:bd:7a:9a');
    expect(device.bthomeSensors.get('bthomesensor:219')?.name).toBe('Temperature');
    expect(device.bthomeSensors.get('bthomesensor:219')?.sensorId).toBe(69);
    expect(device.bthomeSensors.get('bthomesensor:219')?.sensorIdx).toBe(0);

    shelly.removeDevice(device);
    device.destroy();
  }, 30000);
});
