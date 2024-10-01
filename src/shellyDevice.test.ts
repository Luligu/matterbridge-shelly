/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { ShellyDevice } from './shellyDevice.js';
import { AnsiLogger, TimestampFormat, LogLevel } from 'matterbridge/logger';
import { Shelly } from './shelly.js';
import { ShellyComponent } from './shellyComponent.js';
import path from 'path';
import { jest } from '@jest/globals';
import { ShellyData } from './shellyTypes.js';
import { wait } from 'matterbridge/utils';

// shellyDevice.ts    |   76.51 |    65.16 |   84.37 |    78.5 | ...5,633-635,638-639,645-656,675-691,705-721,726-736,759-761,794-798,802-804,807,882-885,889-892,896-899,903-905,908-910,965-968,1101-1106

describe('Shelly devices test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const log = new AnsiLogger({ logName: 'shellyDeviceTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
  const shelly = new Shelly(log, 'admin', 'tango');
  const device: ShellyDevice | undefined = undefined;

  const firmwareGen1 = 'v1.14.0-gcb84623';
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

  afterAll(async () => {
    shelly.destroy();
    await wait(2000);
  });

  test('ShellyDevice.normalizeId', async () => {
    expect(ShellyDevice.normalizeId('Shelly1-34945472A643').id).toBe('shelly1-34945472A643');
    expect(ShellyDevice.normalizeId('shelly1-34945472a643').type).toBe('shelly1');
    expect(ShellyDevice.normalizeId('Shelly1-34945472a643').mac).toBe('34945472A643');

    expect(ShellyDevice.normalizeId('shellyPlug-S-C38Eab').id).toBe('shellyplug-s-C38EAB');
    expect(ShellyDevice.normalizeId('shellyPlug-S-C38Eab').type).toBe('shellyplug-s');
    expect(ShellyDevice.normalizeId('ShellyPlug-S-C38Eab').mac).toBe('C38EAB');
  });
});
