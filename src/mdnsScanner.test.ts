/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jest/no-done-callback */
import { LogLevel } from 'matterbridge/logger';
import { MdnsScanner, DiscoveredDeviceListener, DiscoveredDevice } from './mdnsScanner';
import { jest } from '@jest/globals';
import path from 'path';
import { readFileSync } from 'fs';
import { ResponsePacket } from 'multicast-dns';
import { getIpv4InterfaceAddress } from 'matterbridge/utils';

function loadResponse(shellyId: string) {
  const responseFile = path.join('src', 'mock', `${shellyId}.mdns.json`);
  try {
    const response = readFileSync(responseFile, 'utf8');
    // console.log(`Loaded response file ${responseFile}`);
    const data = JSON.parse(response);
    // eslint-disable-next-line no-console
    console.log(`Loaded response file ${responseFile}:`, data);
    return data;
  } catch (err) {
    // console.error(`Error loading response file ${responseFile}: ${err}`);
    return undefined;
  }
}

describe('Shellies MdnsScanner test', () => {
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  const mdns = new MdnsScanner(LogLevel.DEBUG);

  // Convert discoveredDeviceListener to a mock function with the correct type
  const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn((device: DiscoveredDevice) => {
    // console.error(`Shellies MdnsScanner test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
  });

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((message?: any, ...optionalParams: any[]) => {
      // console.error(`Mocked console.log: ${message}`, optionalParams);
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
    consoleLogSpy.mockRestore();
  });

  test('Constructor', () => {
    expect(mdns).not.toBeUndefined();
    expect(mdns.isScanning).toBeFalsy();
  });

  test('dataPath', () => {
    expect(mdns.dataPath).toBeUndefined();
    mdns.dataPath = 'data';
    expect((mdns as any)._dataPath).toBe('data');
    mdns.dataPath = 'temp';
    expect((mdns as any)._dataPath).toBe('temp');
  });

  test('debug', () => {
    expect(mdns.debug).toBeUndefined();
    mdns.debug = true;
    expect((mdns as any)._debug).toBe(true);
    mdns.debug = false;
    expect((mdns as any)._debug).toBe(false);
  });

  test('NormalizeId', () => {
    expect(mdns.normalizeShellyId('ShellySwitch25-3494546bbF7E.local')).toBe('shellyswitch25-3494546BBF7E');
    expect(mdns.normalizeShellyId('shellyPlug-S-C38Eab.local')).toBe('shellyplug-s-C38EAB');
    expect(mdns.normalizeShellyId('shellyPlugC38Eab.local')).toBe(undefined);
  });

  test('Save response', async () => {
    expect(mdns).not.toBeUndefined();
    expect(mdns.isScanning).toBeFalsy();
    await (mdns as any).saveResponse('shellyswitch25-3494546BBF7E', gen1_ResponsePacket);
  });

  test('Start discover', (done) => {
    mdns.start(3000, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();
      done();
    }, 1000);
  }, 10000);

  test('Start discover with interface', (done) => {
    mdns.start(3000, getIpv4InterfaceAddress(), 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();
      done();
    }, 1000);
  }, 10000);

  test('Shelly gen 1', (done) => {
    discoveredDeviceListener.mockClear();
    mdns.on('discovered', discoveredDeviceListener);
    mdns.start(3000, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: 'shellyswitch25-3494546BBF7E', host: '192.168.1.222', port: 80, gen: 1 });
      expect((mdns as any).discoveredDevices.has('shellyswitch25-3494546BBF7E')).toBeTruthy();
      done();
    }, 2000);
    (mdns as any).discoveredDevices.clear();
    (mdns as any).scanner.emit('response', gen1_ResponsePacket, gen1_RemoteInfo);
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly gen 2', (done) => {
    discoveredDeviceListener.mockClear();
    mdns.on('discovered', discoveredDeviceListener);
    mdns.start(3000, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: 'shellyplus2pm-30C92286CB68', host: '192.168.1.228', port: 80, gen: 2 });
      expect((mdns as any).discoveredDevices.has('shellyplus2pm-30C92286CB68')).toBeTruthy();
      done();
    }, 2000);
    (mdns as any).discoveredDevices.clear();
    (mdns as any).scanner.emit('response', gen2_ResponsePacket, gen2_RemoteInfo);
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly gen 3', (done) => {
    discoveredDeviceListener.mockClear();
    mdns.on('discovered', discoveredDeviceListener);
    mdns.start(3000, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: 'shellypmminig3-84FCE63957F4', host: '192.168.1.220', port: 80, gen: 3 });
      expect((mdns as any).discoveredDevices.has('shellypmminig3-84FCE63957F4')).toBeTruthy();
      done();
    }, 2000);
    (mdns as any).discoveredDevices.clear();
    (mdns as any).scanner.emit('response', gen3_ResponsePacket, gen3_RemoteInfo);
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly plug-s', (done) => {
    discoveredDeviceListener.mockClear();
    mdns.on('discovered', discoveredDeviceListener);
    mdns.start(undefined, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    setTimeout(() => {
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: 'shellyplug-s-C38EAB', host: '192.168.68.75', port: 80, gen: 1 });
      expect((mdns as any).discoveredDevices.has('shellyplug-s-C38EAB')).toBeTruthy();
      done();
    }, 2000);
    (mdns as any).discoveredDevices.clear();
    const data = loadResponse('shellyplug-s-C38EAB');
    expect(data).not.toBeUndefined();
    if (!data) return;
    (mdns as any).scanner.emit('response', data, { address: '192.168.68.75', family: 'IPv4', port: 5353, size: 501 });
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Log discovered', () => {
    const size = mdns.logPeripheral();
    expect(size).toBeGreaterThanOrEqual(0);
    expect(mdns.isScanning).toBeFalsy();
  });
});

const gen1_ResponsePacket = {
  id: 0,
  type: 'response',
  flags: 1024,
  flag_qr: true,
  opcode: 'QUERY',
  flag_aa: true,
  flag_tc: false,
  flag_rd: false,
  flag_ra: false,
  flag_z: false,
  flag_ad: false,
  flag_cd: false,
  rcode: 'NOERROR',
  questions: [],
  answers: [
    {
      name: '_http._tcp.local',
      type: 'PTR',
      ttl: 4500,
      class: 'IN',
      flush: false,
      data: 'shellyswitch25-3494546BBF7E._http._tcp.local',
    },
    {
      name: 'shellyswitch25-3494546BBF7E._http._tcp.local',
      type: 'SRV',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: {
        priority: 0,
        weight: 0,
        port: 80,
        target: 'shellyswitch25-3494546BBF7E.local',
      },
    },
    {
      name: 'shellyswitch25-3494546BBF7E._http._tcp.local',
      type: 'TXT',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: [],
    },
    {
      name: 'shellyswitch25-3494546BBF7E.local',
      type: 'A',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: '192.168.1.222',
    },
    {
      name: 'shellyswitch25-3494546BBF7E.local',
      type: 'NSEC',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: { nextDomain: 'shellyswitch25-3494546BBF7E.local', rrtypes: ['A'] },
    },
  ],
  authorities: [],
  additionals: [],
};
const gen1_RemoteInfo = { address: '192.168.1.222', family: 'IPv4', port: 5353, size: 501 };

const gen2_ResponsePacket = {
  id: 0,
  type: 'response',
  flags: 1024,
  flag_qr: true,
  opcode: 'QUERY',
  flag_aa: true,
  flag_tc: false,
  flag_rd: false,
  flag_ra: false,
  flag_z: false,
  flag_ad: false,
  flag_cd: false,
  rcode: 'NOERROR',
  questions: [],
  answers: [
    {
      name: '_http._tcp.local',
      type: 'PTR',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c92286cb68._http._tcp.local',
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c92286cb68._shelly._tcp.local',
    },
  ],
  authorities: [],
  additionals: [
    {
      name: 'shellyplus2pm-30c92286cb68._http._tcp.local',
      type: 'SRV',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: {
        priority: 0,
        weight: 0,
        port: 80,
        target: 'ShellyPlus2PM-30C92286CB68.local',
      },
    },
    {
      name: 'shellyplus2pm-30c92286cb68._http._tcp.local',
      type: 'TXT',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: [],
    },
    {
      name: 'ShellyPlus2PM-30C92286CB68.local',
      type: 'A',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: '192.168.1.228',
    },
    {
      name: 'shellyplus2pm-30c92286cb68._shelly._tcp.local',
      type: 'SRV',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: {
        priority: 0,
        weight: 0,
        port: 80,
        target: 'ShellyPlus2PM-30C92286CB68.local',
      },
    },
    {
      name: 'shellyplus2pm-30c92286cb68._shelly._tcp.local',
      type: 'TXT',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: ['gen=2', 'app=Plus2PM', 'ver=1.3.3'],
    },
    {
      name: 'ShellyPlus2PM-30C92286CB68.local',
      type: 'A',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: '192.168.1.228',
    },
  ],
};

const gen2_RemoteInfo = { address: '192.168.1.228', family: 'IPv4', port: 5353, size: 275 };

const gen3_ResponsePacket = {
  id: 0,
  type: 'response',
  flags: 1024,
  flag_qr: true,
  opcode: 'QUERY',
  flag_aa: true,
  flag_tc: false,
  flag_rd: false,
  flag_ra: false,
  flag_z: false,
  flag_ad: false,
  flag_cd: false,
  rcode: 'NOERROR',
  questions: [],
  answers: [
    {
      name: '_http._tcp.local',
      type: 'PTR',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: 'shellypmminig3-84fce63957f4._http._tcp.local',
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: 'shellypmminig3-84fce63957f4._shelly._tcp.local',
    },
  ],
  authorities: [],
  additionals: [
    {
      name: 'shellypmminig3-84fce63957f4._http._tcp.local',
      type: 'SRV',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: {
        priority: 0,
        weight: 0,
        port: 80,
        target: 'Shelly1MiniG3-543204547478.local',
      },
    },
    {
      name: 'shellypmminig3-84fce63957f4._http._tcp.local',
      type: 'TXT',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: [],
    },
    {
      name: 'ShellyPMMiniG3-84FCE63957F4.local',
      type: 'A',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: '192.168.1.220',
    },
    {
      name: 'shellypmminig3-84fce63957f4._shelly._tcp.local',
      type: 'SRV',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: {
        priority: 0,
        weight: 0,
        port: 80,
        target: 'Shelly1MiniG3-543204547478.local',
      },
    },
    {
      name: 'shellypmminig3-84fce63957f4._shelly._tcp.local',
      type: 'TXT',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: ['gen=3', 'app=MiniPMG3', 'ver=1.4.0'],
    },
    {
      name: 'ShellyPMMiniG3-84FCE63957F4.local',
      type: 'A',
      ttl: 120,
      class: 'IN',
      flush: true,
      data: '192.168.1.220',
    },
  ],
};

const gen3_RemoteInfo = { address: '192.168.1.220', family: 'IPv4', port: 5353, size: 279 };
