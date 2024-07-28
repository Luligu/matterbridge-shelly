/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/no-done-callback */
import { LogLevel } from 'node-ansi-logger';
import { MdnsScanner, DiscoveredDeviceListener, DiscoveredDevice } from './mdnsScanner';
import { jest } from '@jest/globals';

describe('Shellies MdnsScanner test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const mdns = new MdnsScanner(LogLevel.INFO);

  const discoveredDeviceListener: DiscoveredDeviceListener = async (device: DiscoveredDevice) => {
    // eslint-disable-next-line no-console
    console.log(`Shellies MdnsScanner test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
  };

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(`Mocked console.log: ${args}`);
    });
    mdns.on('discovered', discoveredDeviceListener);
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    mdns.stop();
    mdns.off('discovered', discoveredDeviceListener);
  });

  test('Constructor', () => {
    expect(mdns).not.toBeUndefined();
    expect(mdns.isScanning).toBeFalsy();
  });

  test('On listener', () => {
    expect(mdns.on('discovered', discoveredDeviceListener)).toBe(mdns);
  });

  test('Off listener', () => {
    expect(mdns.off('discovered', discoveredDeviceListener)).toBe(mdns);
  });

  test('Start discover', (done) => {
    mdns.start(3000, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      mdns.stop();
      done();
      expect(mdns.isScanning).toBeFalsy();
    }, 5000);
  }, 10000);

  test('Log discovered', () => {
    const size = mdns.logPeripheral();
    expect(size).toBeGreaterThanOrEqual(0);
    expect(mdns.isScanning).toBeFalsy();
  });
});
