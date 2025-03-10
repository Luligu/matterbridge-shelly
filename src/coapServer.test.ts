/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import { CoapServer } from './coapServer';
import { AnsiLogger, CYAN, db, hk, LogLevel, nf, zb } from 'matterbridge/logger';
import { IncomingMessage, parameters } from 'coap';

// jest.useFakeTimers();

describe('Coap scanner', () => {
  const coapServer = new CoapServer(LogLevel.DEBUG);

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

  const parseShellyMessageSpy = jest.spyOn(CoapServer.prototype as any, 'parseShellyMessage');

  beforeAll(() => {
    // Set the CoAP parameters to minimum values
    parameters.maxRetransmit = 1;
    parameters.maxLatency = 1;
    if (parameters.refreshTiming) parameters.refreshTiming();
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Create the coapServer', () => {
    expect(coapServer).not.toBeUndefined();
    expect(coapServer).toBeInstanceOf(CoapServer);
  });

  test('Not starting to listen', () => {
    expect(coapServer.isListening).toBeFalsy();
  });

  test('Parse status message', async () => {
    msg.payload = JSON.stringify(msg.payload) as any;
    (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.219${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceId: ${CYAN}undefined${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceModel: ${CYAN}SHDM-2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceMac: ${CYAN}98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`protocolRevision: ${CYAN}2${db}`));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`No coap description found for ${hk}SHDM-2${nf} host ${zb}192.168.1.219${nf} fetching it...`));
  }, 30000);

  test('Getting device description', async () => {
    await coapServer.getDeviceDescription('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');
    expect(coapServer.isListening).toBeFalsy();
  }, 30000);

  test('Getting device status', async () => {
    await coapServer.getDeviceStatus('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');
    expect(coapServer?.isListening).toBeFalsy();
  }, 30000);

  test('Getting multicast device status', async () => {
    await coapServer.getMulticastDeviceStatus(10);
    expect(coapServer.isListening).toBeFalsy();
  }, 30000);

  test('Start scanner', async () => {
    coapServer.start();
    await new Promise((resolve) => setTimeout(() => resolve(true), 500).unref());
    expect(coapServer.isListening).toBeTruthy();
    expect(coapServer.isReady).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Starting CoIoT (coap) server for shelly devices...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Started CoIoT (coap) server for shelly devices.');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('CoIoT (coap) server is listening ...'));
  }, 5000);

  test('Start receving', async () => {
    expect(coapServer.isListening).toBeTruthy();

    await new Promise((resolve) => {
      coapServer.getDeviceDescription('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');
      coapServer.getDeviceStatus('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');

      setInterval(() => {
        if (parseShellyMessageSpy.mock.calls.length > 0) {
          resolve(true);
        }
      }, 1000).unref();
      setTimeout(() => {
        resolve(true);
      }, 10000).unref();
    });
  }, 30000);

  test('Stop scanner', async () => {
    coapServer.stop();
    await new Promise((resolve) => setTimeout(() => resolve(true), 500).unref());
    expect(coapServer.isListening).toBeFalsy();
    expect(coapServer.isReady).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopping CoIoT (coap) server for shelly devices...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopped CoIoT (coap) server for shelly devices.');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('CoIoT (coap) server closed'));
  }, 30000);
});

const msg = {
  payload: {
    'G': [
      [0, 9103, 0],
      [0, 1101, 0],
      [0, 5101, 100],
      [0, 2101, 0],
      [0, 2102, ''],
      [0, 2103, 0],
      [0, 2201, 0],
      [0, 2202, ''],
      [0, 2203, 0],
      [0, 4101, 0],
      [0, 4103, 0],
      [0, 6102, 0],
      [0, 6109, 0],
      [0, 6104, 0],
      [0, 3104, 47.48],
      [0, 3105, 117.46],
      [0, 6101, 0],
      [0, 9101, 'white'],
    ],
  },
  options: [
    { name: 'Uri-Path', value: '' },
    { name: 'Uri-Path', value: '' },
    { name: '3332', value: 'SHDM-2#98CDAC0D01BB#2' },
    { name: '3412', value: 38400 },
    { name: '3420', value: 46377 },
  ],
  code: '2.05',
  method: undefined,
  headers: { '3332': 'SHDM-2#98CDAC0D01BB#2', '3412': 38400, '3420': 46377 },
  url: '/cit/s',
  rsinfo: { address: '192.168.1.219', family: 'IPv4', port: 5683, size: 281 },
  outSocket: { address: '0.0.0.0', family: 'IPv4', port: 63375 },
};
