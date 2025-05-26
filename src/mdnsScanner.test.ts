/* eslint-disable jest/no-done-callback */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { LogLevel, AnsiLogger, ign, db, hk, CYAN, rs } from 'matterbridge/logger';
import { MdnsScanner, DiscoveredDeviceListener, DiscoveredDevice } from './mdnsScanner';
import { jest } from '@jest/globals';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { RemoteInfo } from 'node:dgram';
import { ResponsePacket } from 'multicast-dns';

function loadResponse(shellyId: string) {
  const responseFile = path.join('src', 'mock', `${shellyId}.mdns.json`);
  try {
    const response = readFileSync(responseFile, 'utf8');
    // console.log(`Loaded response file ${responseFile}`);
    const data = JSON.parse(response);

    // console.log(`Loaded response file ${responseFile}:`, data);
    return data;
  } catch (err) {
    // console.error(`Error loading response file ${responseFile}: ${err}`);
    return undefined;
  }
}

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

if (!debug) {
  // Spy on and mock AnsiLogger.log
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
    //
  });
  // Spy on and mock console.log
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.debug
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.info
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.warn
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.error
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    //
  });
} else {
  // Spy on AnsiLogger.log
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  // Spy on console.log
  consoleLogSpy = jest.spyOn(console, 'log');
  // Spy on console.debug
  consoleDebugSpy = jest.spyOn(console, 'debug');
  // Spy on console.info
  consoleInfoSpy = jest.spyOn(console, 'info');
  // Spy on console.warn
  consoleWarnSpy = jest.spyOn(console, 'warn');
  // Spy on console.error
  consoleErrorSpy = jest.spyOn(console, 'error');
}

describe('Shellies MdnsScanner test', () => {
  const mdns = new MdnsScanner(LogLevel.DEBUG);

  const sendQuerySpy = jest.spyOn(MdnsScanner.prototype, 'sendQuery').mockImplementation(() => {
    //
  });

  const saveResponseSpy = jest.spyOn(MdnsScanner.prototype, 'saveResponse').mockImplementation(async () => {
    //
  });

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(async () => {
    // Stop the mdns scanner
    mdns.stop();
    mdns.removeAllListeners();

    // Restore all mocks
    jest.restoreAllMocks();
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

  test('NormalizeId', () => {
    expect(mdns.normalizeShellyId('ShellySwitch25-3494546bbF7E.local')).toBe('shellyswitch25-3494546BBF7E');
    expect(mdns.normalizeShellyId('shellyPlug-S-C38Eab.local')).toBe('shellyplug-s-C38EAB');
    expect(mdns.normalizeShellyId('shellyPlugC38Eab.local')).toBe(undefined);
  });

  test('Start discover', (done) => {
    mdns.start(3000, 0, undefined, undefined, true);
    expect(mdns.isScanning).toBeTruthy();
    expect(sendQuerySpy).toHaveBeenCalled();
    setTimeout(() => {
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();
      done();
    }, 1000);
  }, 10000);

  test('Start discover with interface', (done) => {
    mdns.start(3000, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(sendQuerySpy).toHaveBeenCalled();
    setTimeout(() => {
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();
      done();
    }, 1000);
  }, 10000);

  test('Generic response', async () => {
    // Start the mdns scanner
    mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );

    // Set up a promise that resolves when the listener is invoked.
    const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
      discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });
    mdns.once('discovered', discoveredDeviceListener);

    // Emit the response packet
    (mdns as any).scanner.emit('response', generic_ResponsePacket, generic_RemoteInfo);

    // Wait for the discovered event to be processed.
    expect(await discoveredPromise).toEqual({ id: 'shellyswitch25-3494546BBF7E', host: '192.168.1.1', port: 80, gen: 1 });

    // Stop the mdns scanner
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Generic query', async () => {
    // Start the mdns scanner
    mdns.start(undefined, 10, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Started MdnsScanner for shelly devices.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopped MdnsScanner query service for shelly devices.`);

    // Set up a promise that resolves when the listener is invoked.
    const queryDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const queryPromise = new Promise<DiscoveredDevice>((resolve) => {
      queryDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });
    mdns.once('query', queryDeviceListener);

    // Emit the response packet
    (mdns as any).scanner.emit('query', generic_QueryPacket, generic_RemoteInfo);

    // Wait for the discovered event to be processed.
    expect(await queryPromise).toEqual({ 'class': 'IN', 'name': '_http._tcp.local', 'type': 'PTR' });

    // Stop the mdns scanner
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopping MdnsScanner for shelly devices...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopped MdnsScanner for shelly devices.`);
  }, 10000);

  test('Shelly gen 1', async () => {
    // Start the mdns scanner
    mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );

    // Set up a promise that resolves when the listener is invoked.
    const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
      discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });
    mdns.once('discovered', discoveredDeviceListener);

    // Emit the response packet
    (mdns as any).scanner.emit('response', gen1_ResponsePacket, gen1_RemoteInfo);

    // Wait for the discovered event to be processed.
    expect(await discoveredPromise).toEqual({ id: 'shellyswitch25-3494546BBF7E', host: '192.168.1.222', port: 80, gen: 1 });

    // Stop the mdns scanner
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly gen 2', async () => {
    // Start the mdns scanner
    mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );

    // Set up a promise that resolves when the listener is invoked.
    const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
      discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });
    mdns.once('discovered', discoveredDeviceListener);

    // Emit the response packet
    (mdns as any).scanner.emit('response', gen2_ResponsePacket, gen2_RemoteInfo);

    // Wait for the discovered event to be processed.
    expect(await discoveredPromise).toEqual({ id: 'shellyplus2pm-30C92286CB68', host: '192.168.1.228', port: 80, gen: 2 });

    // Stop the mdns scanner
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly gen 3', async () => {
    // Start the mdns scanner
    mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );

    // Set up a promise that resolves when the listener is invoked.
    const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
      discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });
    mdns.once('discovered', discoveredDeviceListener);

    // Emit the response packet
    (mdns as any).scanner.emit('response', gen3_ResponsePacket, gen3_RemoteInfo);

    // Wait for the discovered event to be processed.
    expect(await discoveredPromise).toEqual({ id: 'shellypmminig3-84FCE63957F4', host: '192.168.1.220', port: 80, gen: 3 });

    // Stop the mdns scanner
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();
  }, 10000);

  test('Shelly shelly1minig4', async () => {
    const deviceId = 'shelly1minig4-7C2C67643858';
    const deviceIp = '10.101.7.248';
    const devicePort = 80;
    const deviceGen = 4;
    const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

    // Set up a promise that resolves when the listener is invoked.
    const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
    const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
      discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
        console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
        resolve(device);
      });
    });

    mdns.once('discovered', discoveredDeviceListener);
    mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
    expect(mdns.isScanning).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
    );
    const responsePacket: ResponsePacket = loadResponse(deviceId);
    expect(responsePacket).not.toBeUndefined();
    if (!responsePacket) return;
    (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
    mdns.stop();
    expect(mdns.isScanning).toBeFalsy();

    // Wait for the discovered event to be processed.
    expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

    expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
    expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
    expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
    expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
    expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
  }, 5000);

  test('Clear discovered', async () => {
    (mdns as any).devices.clear();
    (mdns as any).discoveredDevices.clear();
    expect((mdns as any).devices.size).toBe(0);
    expect((mdns as any).discoveredDevices.size).toBe(0);
  }, 5000);

  test('Run multiple test gen 1', async () => {
    const tests = [
      { id: 'shelly1-34945472A643', host: '192.168.1.240', port: 80, gen: 1 },
      { id: 'shelly1l-E8DB84AAD781', host: '192.168.1.241', port: 80, gen: 1 },
      { id: 'shellybulbduo-34945479CFA4', host: '192.168.1.154', port: 80, gen: 1 },
      { id: 'shellybutton1-485519F31EA3', host: '192.168.1.233', port: 80, gen: 1 },
      { id: 'shellycolorbulb-485519EE12A7', host: '192.168.1.155', port: 80, gen: 1 },
      { id: 'shellydimmer2-98CDAC0D01BB', host: '192.168.1.184', port: 80, gen: 1 },
      { id: 'shellydw2-483FDA825476', host: '192.168.1.247', port: 80, gen: 1 },
      { id: 'shellyem3-485519D732F4', host: '192.168.1.249', port: 80, gen: 1 },
      { id: 'shellyflood-EC64C9C1DA9A', host: '192.168.1.248', port: 80, gen: 1 },
      { id: 'shellygas-7C87CEBCECE4', host: '192.168.68.165', port: 80, gen: 1 },
      { id: 'shellyht-703523', host: '192.168.1.176', port: 80, gen: 1 },
      { id: 'shellymotion2-8CF68108A6F5', host: '192.168.1.246', port: 80, gen: 1 },
      { id: 'shellymotionsensor-60A42386E566', host: '192.168.1.245', port: 80, gen: 1 },
      { id: 'shellyplug-s-C38EAB', host: '192.168.68.75', port: 80, gen: 1 },
      { id: 'shellyrgbw2-EC64C9D199AD', host: '192.168.1.152', port: 80, gen: 1 },
      { id: 'shellyrgbw2-EC64C9D3FFEF', host: '192.168.1.226', port: 80, gen: 1 },
      { id: 'shellyswitch25-3494546BBF7E', host: '192.168.1.222', port: 80, gen: 1 },
      { id: 'shellyswitch25-3494547BF36C', host: '192.168.1.236', port: 80, gen: 1 },
      { id: 'shellytrv-60A423D0E032', host: '192.168.24.122', port: 80, gen: 1 },
    ];

    for (const test of tests) {
      console.log(`Shellies MdnsScanner running test for ${test.id} at ${test.host} port ${test.port} gen ${test.gen}`);
      jest.clearAllMocks();

      const deviceId = test.id;
      const deviceIp = test.host;
      const devicePort = test.port;
      const deviceGen = test.gen;
      const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

      // Set up a promise that resolves when the listener is invoked.
      const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
      const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
        discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
          console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
          resolve(device);
        });
      });

      mdns.once('discovered', discoveredDeviceListener);
      mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
      expect(mdns.isScanning).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
      );
      const responsePacket: ResponsePacket = loadResponse(deviceId);
      expect(responsePacket).not.toBeUndefined();
      if (!responsePacket) return;
      (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();

      // Wait for the discovered event to be processed.
      expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

      expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
      expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
      expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
      expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    }
  }, 5000);

  test('Run multiple test gen 2 plus', async () => {
    const tests = [
      { id: 'shelly1mini-348518E0E804', host: '192.168.1.238', port: 80, gen: 2 },
      { id: 'shelly1pmmini-348518E04D44', host: '192.168.1.239', port: 80, gen: 2 },
      { id: 'shellyblugw-B0B21CFAAD18', host: '192.168.1.168', port: 80, gen: 2 },
      { id: 'shellywalldisplay-00082261E102', host: '192.168.1.167', port: 80, gen: 2 },

      { id: 'shellyplus010v-80646FE1FAC4', host: '192.168.1.160', port: 80, gen: 2 },
      { id: 'shellyplus1-E465B8F3028C', host: '192.168.1.237', port: 80, gen: 2 },
      { id: 'shellyplus1pm-441793D69718', host: '192.168.1.217', port: 80, gen: 2 },
      { id: 'shellyplus2pm-30C922810DA0', host: '192.168.1.85', port: 80, gen: 2 },
      { id: 'shellyplus2pm-30C92286CB68', host: '192.168.1.86', port: 80, gen: 2 },
      { id: 'shellyplus2pm-5443B23D81F8', host: '192.168.1.218', port: 80, gen: 2 },
      { id: 'shellyplus2pm-C4D8D5517C68', host: '192.168.1.163', port: 80, gen: 2 },
      { id: 'shellyplusi4-CC7B5C8AEA2C', host: '192.168.1.224', port: 80, gen: 2 },
      { id: 'shellyplusi4-D48AFC41B6F4', host: '192.168.1.161', port: 80, gen: 2 },
      { id: 'shellyplusplugs-E86BEAEAA000', host: '192.168.1.153', port: 80, gen: 2 },
      { id: 'shellyplusrgbwpm-A0A3B35C7024', host: '192.168.1.180', port: 80, gen: 2 },
      { id: 'shellyplusrgbwpm-ECC9FF4CEAF0', host: '192.168.1.171', port: 80, gen: 2 },
      { id: 'shellyplussmoke-A0A3B3B8AE48', host: '192.168.68.164', port: 80, gen: 2 },
    ];

    for (const test of tests) {
      console.log(`Shellies MdnsScanner running test for ${test.id} at ${test.host} port ${test.port} gen ${test.gen}`);
      jest.clearAllMocks();

      const deviceId = test.id;
      const deviceIp = test.host;
      const devicePort = test.port;
      const deviceGen = test.gen;
      const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

      // Set up a promise that resolves when the listener is invoked.
      const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
      const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
        discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
          console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
          resolve(device);
        });
      });

      mdns.once('discovered', discoveredDeviceListener);
      mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
      expect(mdns.isScanning).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
      );
      const responsePacket: ResponsePacket = loadResponse(deviceId);
      expect(responsePacket).not.toBeUndefined();
      if (!responsePacket) return;
      (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();

      // Wait for the discovered event to be processed.
      expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

      expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
      expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
      expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
      expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    }
  }, 5000);

  test('Run multiple test gen 2 pro', async () => {
    const tests = [
      { id: 'shellypro1pm-EC6260927F7C', host: '192.168.1.151', port: 80, gen: 2 },
      { id: 'shellypro2cover-0CB815FC11B4', host: '192.168.68.104', port: 80, gen: 2 },
      { id: 'shellypro2pm-EC62608C9C00', host: '192.168.1.235', port: 80, gen: 2 },
      { id: 'shellypro3em-A0DD6CA0C27C', host: '192.168.1.80', port: 80, gen: 2 },
      { id: 'shellypro4pm-34987A67D7D0', host: '192.168.1.234', port: 80, gen: 2 },
      { id: 'shellyprodm1pm-34987A4957C4', host: '192.168.1.156', port: 80, gen: 2 },
      { id: 'shellyproem50-A0DD6CA09158', host: '192.168.1.81', port: 80, gen: 2 },
    ];

    for (const test of tests) {
      console.log(`Shellies MdnsScanner running test for ${test.id} at ${test.host} port ${test.port} gen ${test.gen}`);
      jest.clearAllMocks();

      const deviceId = test.id;
      const deviceIp = test.host;
      const devicePort = test.port;
      const deviceGen = test.gen;
      const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

      // Set up a promise that resolves when the listener is invoked.
      const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
      const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
        discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
          console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
          resolve(device);
        });
      });

      mdns.once('discovered', discoveredDeviceListener);
      mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
      expect(mdns.isScanning).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
      );
      const responsePacket: ResponsePacket = loadResponse(deviceId);
      expect(responsePacket).not.toBeUndefined();
      if (!responsePacket) return;
      (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();

      // Wait for the discovered event to be processed.
      expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

      expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
      expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
      expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
      expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    }
  }, 5000);

  test('Run multiple test gen 3', async () => {
    const tests = [
      { id: 'shelly1g3-34B7DACAC830', host: '192.168.1.157', port: 80, gen: 3 },
      { id: 'shelly1minig3-543204547478', host: '192.168.1.221', port: 80, gen: 3 },
      { id: 'shelly1pmg3-34B7DAC68344', host: '192.168.1.158', port: 80, gen: 3 },
      { id: 'shelly1pmminig3-543204519264', host: '192.168.1.225', port: 80, gen: 3 },
      { id: 'shelly2pmg3-34CDB0770C4C', host: '192.168.1.166', port: 80, gen: 3 },
      { id: 'shellyblugwg3-34CDB077BCD4', host: '192.168.1.164', port: 80, gen: 3 },
      { id: 'shellyddimmerg3-84FCE636832C', host: '192.168.1.242', port: 80, gen: 3 },
      { id: 'shellyemg3-84FCE636582C', host: '192.168.1.243', port: 80, gen: 3 },
      { id: 'shellyhtg3-3030F9EC8468', host: '192.168.1.100', port: 80, gen: 3 },
      { id: 'shellyi4g3-5432045661B4', host: '192.168.1.159', port: 80, gen: 3 },
      { id: 'shellyplugsg3-5432045CE094', host: '192.168.1.165', port: 80, gen: 3 },
      { id: 'shellypmminig3-84FCE63957F4', host: '192.168.1.220', port: 80, gen: 3 },
    ];

    for (const test of tests) {
      console.log(`Shellies MdnsScanner running test for ${test.id} at ${test.host} port ${test.port} gen ${test.gen}`);
      jest.clearAllMocks();

      const deviceId = test.id;
      const deviceIp = test.host;
      const devicePort = test.port;
      const deviceGen = test.gen;
      const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

      // Set up a promise that resolves when the listener is invoked.
      const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
      const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
        discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
          console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
          resolve(device);
        });
      });

      mdns.once('discovered', discoveredDeviceListener);
      mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
      expect(mdns.isScanning).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
      );
      const responsePacket: ResponsePacket = loadResponse(deviceId);
      expect(responsePacket).not.toBeUndefined();
      if (!responsePacket) return;
      (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();

      // Wait for the discovered event to be processed.
      expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

      expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
      expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
      expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
      expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    }
  }, 5000);

  test('Run multiple test gen 4', async () => {
    const tests = [
      // On site
      { id: 'shelly1g4-A085E3BCA4C8', host: '192.168.70.1', port: 80, gen: 4 },
      { id: 'shelly1pmg4-A085E3BD0544', host: '192.168.70.3', port: 80, gen: 4 },
      { id: 'shelly1minig4-A085E3BB944C', host: '192.168.70.2', port: 80, gen: 4 },
      { id: 'shelly1pmminig4-CCBA97C64580', host: '192.168.70.4', port: 80, gen: 4 },
      // Shelly HQ
      { id: 'shelly2pmg4-7C2C677A0110', host: '10.101.4.150', port: 80, gen: 4 },
      { id: 'shellyemminig4-7C2C6763F75C', host: '10.101.10.89', port: 80, gen: 4 },
      { id: 'shellyi4g4-F0F5BD287ACC', host: '10.101.5.95', port: 80, gen: 4 },
      { id: 'shellyplugusg4-7C2C67642A88', host: '10.101.6.97', port: 80, gen: 4 },
      { id: 'shellypstripg4-7C2C6763F7B0', host: '10.101.10.172', port: 80, gen: 4 },
    ];

    for (const test of tests) {
      console.log(`Shellies MdnsScanner running test for ${test.id} at ${test.host} port ${test.port} gen ${test.gen}`);
      jest.clearAllMocks();

      const deviceId = test.id;
      const deviceIp = test.host;
      const devicePort = test.port;
      const deviceGen = test.gen;
      const remoteInfo: RemoteInfo = { address: deviceIp, family: 'IPv4', port: 5353, size: 0 };

      // Set up a promise that resolves when the listener is invoked.
      const discoveredDeviceListener: jest.MockedFunction<DiscoveredDeviceListener> = jest.fn();
      const discoveredPromise = new Promise<DiscoveredDevice>((resolve) => {
        discoveredDeviceListener.mockImplementationOnce((device: DiscoveredDevice) => {
          console.log(`Shellies MdnsScanner Jest Test: discovered shelly device: ${device.id} at ${device.host} port ${device.port} gen ${device.gen}`);
          resolve(device);
        });
      });

      mdns.once('discovered', discoveredDeviceListener);
      mdns.start(undefined, 0, '127.0.0.1', 'udp4', true);
      expect(mdns.isScanning).toBeTruthy();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        `Starting MdnsScanner for shelly devices (interface 127.0.0.1 bind 127.0.0.1 type udp4 ip 224.0.0.251) for shelly devices...`,
      );
      const responsePacket: ResponsePacket = loadResponse(deviceId);
      expect(responsePacket).not.toBeUndefined();
      if (!responsePacket) return;
      (mdns as any).scanner.emit('response', responsePacket, remoteInfo);
      mdns.stop();
      expect(mdns.isScanning).toBeFalsy();

      // Wait for the discovered event to be processed.
      expect(await discoveredPromise).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });

      expect((mdns as any).devices.has(deviceIp)).toBeTruthy();
      expect((mdns as any).devices.get(deviceIp)).toBe(deviceIp);
      expect((mdns as any).discoveredDevices.has(deviceId)).toBeTruthy();
      expect((mdns as any).discoveredDevices.get(deviceId)).toEqual({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.DEBUG,
        expect.stringContaining(`Mdns response from ${ign} ${remoteInfo.address} family ${remoteInfo.family} port ${remoteInfo.port} ${rs}${db}`),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.answers[${responsePacket.answers.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- response.additionals[${responsePacket.additionals.length}] ---`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `--- end ---\n`);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
      expect(discoveredDeviceListener).toHaveBeenCalledWith({ id: deviceId, host: deviceIp, port: devicePort, gen: deviceGen });
    }
  }, 5000);

  test('Log discovered', () => {
    expect((mdns as any).devices.size).toBeGreaterThanOrEqual(58);
    expect((mdns as any).discoveredDevices.size).toBeGreaterThanOrEqual(58);
    const size = mdns.logPeripheral();
    expect(size).toBeGreaterThanOrEqual(61);
  });

  test('Send query', async () => {
    sendQuerySpy.mockRestore();
    const sendQuerySpyII = jest.spyOn(MdnsScanner.prototype, 'sendQuery');

    jest.useFakeTimers({ legacyFakeTimers: false });

    console.log(`Shellies MdnsScanner Jest Test: starting...`);
    mdns.start(120000, 0, undefined, undefined, true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting MdnsScanner for shelly devices...`);
    expect(sendQuerySpyII).toHaveBeenCalled();

    console.log(`Shellies MdnsScanner Jest Test: testing error...`);
    (mdns as any).scanner.emit('error', new Error('Jest test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error in mDNS query service: Jest test`);

    console.log(`Shellies MdnsScanner Jest Test: testing warning...`);
    (mdns as any).scanner.emit('warning', new Error('Jest test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Warning in mDNS query service: Jest test`);

    jest.advanceTimersByTime(65 * 1000);
    expect(sendQuerySpyII).toHaveBeenCalledTimes(2);

    console.log(`Shellies MdnsScanner Jest Test: stopping...`);
    jest.advanceTimersByTime(65 * 1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopped MdnsScanner for shelly devices.`);

    jest.useRealTimers();
  });

  test('Save response', async () => {
    expect(mdns).not.toBeUndefined();
    expect(mdns.isScanning).toBeFalsy();
    saveResponseSpy.mockRestore();
    await (mdns as any).saveResponse('shellyswitch25-3494546BBF7E', gen1_ResponsePacket);
    await (mdns as any).saveResponse('shellyplus2pm-30C92286CB68', gen2_ResponsePacket);
    await (mdns as any).saveResponse('shellypmminig3-84FCE63957F4', gen3_ResponsePacket);
    await expect((mdns as any).saveResponse('\\ / : * ? " < > |-84FCE63957F4', gen3_ResponsePacket)).rejects.toThrow();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Successfully created directory temp`);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `Saved shellyId ${hk}shellyswitch25-3494546BBF7E${db} response file ${CYAN}${path.join((mdns as any)._dataPath, `shellyswitch25-3494546BBF7E.mdns.json`)}${db}`,
    );
  });
});

const generic_QueryPacket = {
  id: 0,
  type: 'query',
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
  questions: [{ name: '_http._tcp.local', type: 'PTR', class: 'IN' }],
  answers: [],
  authorities: [],
  additionals: [],
};

const generic_ResponsePacket = {
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
  questions: [{ name: '_http._tcp.local', type: 'PTR', class: 'IN' }],
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
      data: '192.168.1.1',
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
const generic_RemoteInfo = { address: '192.168.1.1', family: 'IPv4', port: 5353, size: 501 };

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
    {
      name: '_http._tcp.local',
      type: 'PTR',
      ttl: 120,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c92286cb68._http._tcp.local',
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
