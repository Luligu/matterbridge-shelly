/* eslint-disable jest/no-done-callback */
import { MdnsScanner, DiscoveredDeviceListener, DiscoveredDevice } from './mdnsScanner';

describe('Shellies test', () => {
  const mdns = new MdnsScanner();

  const discoveredDeviceListener: DiscoveredDeviceListener = async (device: DiscoveredDevice) => {
    // eslint-disable-next-line no-console
    console.log(`Discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
  };

  beforeAll(() => {
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
    mdns.start(undefined, 60, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      mdns.stop();
      done();
      expect(mdns.isScanning).toBeFalsy();
    }, 65000);
  }, 70000);

  test('Log discovered', () => {
    const size = mdns.logPeripheral();
    expect(size).toBeGreaterThanOrEqual(0);
    expect(mdns.isScanning).toBeFalsy();
  });
});
