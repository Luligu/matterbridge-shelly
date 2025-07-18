// src/coapServer.test.ts

const NAME = 'Coap';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import { readFileSync, promises as fs, rmSync } from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger, CYAN, db, hk, LogLevel, nf, zb } from 'matterbridge/logger';
import { IncomingMessage, parameters } from 'coap';

import { CoapServer } from './coapServer.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logs

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

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

// Cleanup the test environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Coap scanner', () => {
  const coapServer = new CoapServer({ username: 'admin', password: 'tango' } as any, LogLevel.DEBUG);

  function loadResponse(shellyId: string, uri: 'citd' | 'cits') {
    (coapServer as any).deviceDescription.clear();
    (coapServer as any).deviceSerial.clear();
    (coapServer as any).deviceValidityTimeout.clear();
    (coapServer as any).deviceId.clear();
    (coapServer as any).deviceId.set('192.168.1.100', shellyId);
    msg.rsinfo.address = '192.168.1.100';
    msg.url = uri === 'citd' ? '/cit/d' : '/cit/s';
    const responseFile = path.join('src', 'mock', `${shellyId}.coap.${uri}.json`);
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

  test('Data path', async () => {
    expect((coapServer as any)._dataPath).toBe('temp');
    coapServer.dataPath = HOMEDIR;
    expect((coapServer as any)._dataPath).toBe(HOMEDIR);
    try {
      await fs.mkdir((coapServer as any)._dataPath, { recursive: true });
    } catch (err) {
      //
    }
  });

  test('saveResponse', async () => {
    await expect((coapServer as any).saveResponse('test.json', {})).resolves.toBeUndefined();
    jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    await expect((coapServer as any).saveResponse('test.json', {})).rejects.toThrow();
  });

  test('Parse status message', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = JSON.stringify(msg.payloadS) as any;
    msg.url = '/cit/s';
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toEqual({});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.68.68${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceId: ${CYAN}shellydimmer2-98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceModel: ${CYAN}SHDM-2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceMac: ${CYAN}98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`protocolRevision: ${CYAN}2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`No coap description found for ${hk}SHDM-2${nf} id ${hk}shellydimmer2-98CDAC0D01BB${nf} host ${zb}192.168.68.68${nf} fetching it...`),
    );
  });

  test('Parse status message serial not changed', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = JSON.stringify(msg.payloadS) as any;
    msg.url = '/cit/s';
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`No updates (serial not changed) for device ${hk}shellydimmer2-98CDAC0D01BB${db} host ${zb}192.168.68.68${db}`),
    );
  });

  test('Parse status message serial changed', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.headers[3420] = 123456789;
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = 'not a json';
    msg.url = '/cit/s';
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.INFO,
      expect.stringContaining(`No coap description found for ${hk}SHDM-2${nf} id ${hk}shellydimmer2-98CDAC0D01BB${nf} host ${zb}192.168.68.68${nf} fetching it...`),
    );
  });

  test('Parse wrong description message', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = 'not a json';
    msg.url = '/cit/d';
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toEqual([]);
  });

  test('Parse description message', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = JSON.stringify(msg.payloadD) as any;
    msg.url = '/cit/d';
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toEqual([
      { id: 1101, component: 'light:0', property: 'state', range: '0/1' },
      { id: 5101, component: 'light:0', property: 'brightness', range: '1/100' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/230', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 6102, component: 'light:0', property: 'overpower', range: ['0/1', '-1'] },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 2201, component: 'input:1', property: 'input', range: '0/1' },
      { id: 2202, component: 'input:1', property: 'event', range: ['S/L', ''] },
      { id: 2203, component: 'input:1', property: 'event_cnt', range: 'U16' },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 3104, component: 'sys', property: 'temperature', range: ['-40/300', '999'] },
      { id: 6101, component: 'sys', property: 'overtemperature', range: ['0/1', '-1'] },
      { id: 9101, component: 'sys', property: 'profile', range: 'color/white' },
    ]);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/d${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.68.68${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceId: ${CYAN}shellydimmer2-98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceModel: ${CYAN}SHDM-2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceMac: ${CYAN}98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`protocolRevision: ${CYAN}2${db}`));
  });

  test('Parse status message after description', async () => {
    (coapServer as any).deviceId.set('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    msg.rsinfo.address = '192.168.68.68';
    msg.payload = JSON.stringify(msg.payloadS) as any;
    msg.url = '/cit/s';
    msg.headers = { '3332': 'SHDM-2#98CDAC0D01BB#2', '3412': 123, '3420': 456 };
    const data = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(data).toEqual({
      'sys': {
        cfg_rev: 0,
        temperature: 47.48,
        overtemperature: false,
        profile: 'white',
      },
      'light:0': { state: false, brightness: 100, overpower: false },
      'input:0': { input: 0, event: '', event_cnt: 0 },
      'input:1': { input: 0, event: '', event_cnt: 0 },
      'meter:0': { power: 0, total: 0 },
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.68.68${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceId: ${CYAN}shellydimmer2-98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceModel: ${CYAN}SHDM-2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`deviceMac: ${CYAN}98CDAC0D01BB${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`protocolRevision: ${CYAN}2${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Update status for device`), expect.anything());
  });

  test('Parse status shellydw2', async () => {
    msg.payload = JSON.stringify(loadResponse('shellydw2-483FDA825476', 'cits')) as any;
    msg.headers[3332] = 'SHDW-1#483FDA825476#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 99,
      },
      lux: {
        illumination: 'twilight',
        value: 172,
      },
      sensor: {
        contact_open: true,
      },
      sys: {
        act_reasons: ['sensor'],
        cfg_rev: 0,
        sensor_error: false,
      },
      temperature: {
        tC: 22.8,
        tF: 73.04,
      },
      vibration: {
        tilt: -1,
        vibration: false,
      },
    });
  });

  test('Parse status shellybutton1', async () => {
    msg.payload = JSON.stringify(loadResponse('shellybutton1-485519F31EA3', 'cits')) as any;
    msg.headers[3332] = 'SHBTN-2#485519F31EA3#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      'battery': {
        charging: false,
        level: 80,
      },
      'input:0': {
        event: 'S',
        event_cnt: 335,
      },
      'sys': {
        act_reasons: ['button'],
        cfg_rev: 0,
        sensor_error: false,
      },
    });
  });

  test('Parse status shellymotionsensor', async () => {
    msg.payload = JSON.stringify(loadResponse('shellymotionsensor-60A42386E566', 'cits')) as any;
    msg.headers[3332] = 'SHMOS-01#60A42386E566#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 100,
      },
      lux: {
        value: 19,
      },
      sensor: {
        motion: false,
      },
      vibration: {
        vibration: false,
      },
      sys: {
        cfg_rev: 4,
      },
    });
  });

  test('Parse status shellymotion2', async () => {
    msg.payload = JSON.stringify(loadResponse('shellymotion2-8CF68108A6F5', 'cits')) as any;
    msg.headers[3332] = 'SHMOS-02#8CF68108A6F5#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 100,
      },
      lux: {
        value: 7,
      },
      sensor: {
        motion: true,
      },
      temperature: {
        tC: 19.8,
        tF: 67.7,
      },
      vibration: {
        vibration: false,
      },
      sys: {
        cfg_rev: 4,
      },
    });
  });

  test('Parse status shellyflood', async () => {
    msg.payload = JSON.stringify(loadResponse('shellyflood-EC64C9C1DA9A', 'cits')) as any;
    msg.headers[3332] = 'SHWT-1#EC64C9C1DA9A#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 86,
      },
      flood: {
        flood: false,
      },
      sys: {
        cfg_rev: 0,
        act_reasons: ['sensor'],
        sensor_error: false,
      },
      temperature: {
        tC: 21.25,
        tF: 70.25,
      },
    });
  });

  test('Parse status shellyht', async () => {
    msg.payload = JSON.stringify(loadResponse('shellyht-703523', 'cits')) as any;
    msg.headers[3332] = 'SHHT-1#703523#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 100,
      },
      humidity: {
        value: 62.5,
      },
      sys: {
        cfg_rev: 0,
        act_reasons: ['sensor'],
        sensor_error: false,
      },
      temperature: {
        tC: 21.75,
        tF: 71.15,
      },
    });
  });

  test('Parse status shellytrv', async () => {
    msg.payload = JSON.stringify(loadResponse('shellytrv-60A423D0E032', 'cits')) as any;
    msg.headers[3332] = 'SHTRV-01#60A423D0E032#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      'battery': {
        level: 53,
      },
      'sys': {
        cfg_rev: 7,
        profile: 1,
      },
      'thermostat:0': {
        target_t: {
          value: 5,
        },
        tmp: {
          value: 14.4,
        },
      },
    });
  });

  test('Parse status shellysmoke', async () => {
    msg.payload = JSON.stringify(loadResponse('shellysmoke-XXXXXXXX', 'cits')) as any;
    msg.headers[3332] = 'SHSM-01#XXXXXXXX#2';
    expect(msg.payload).not.toBeUndefined();
    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      battery: {
        level: 75,
      },
      sys: {
        cfg_rev: 0,
        act_reasons: ['unknown'],
        sensor_error: false,
      },
      smoke: {
        alarm: false,
      },
      temperature: {
        tC: 21.75,
        tF: 71.15,
      },
    });
  });

  test('Parse status shellygas', async () => {
    const citd = loadResponse('shellygas-7C87CEBCECE4', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { component: 'gas', id: 3113, property: 'sensor_state', range: ['warmup/normal/fault', 'unknown'] },
      { component: 'gas', id: 6108, property: 'alarm_state', range: ['none/mild/heavy/test', 'unknown'] },
      { component: 'gas', id: 3107, property: 'ppm', range: ['U16', '-1'] },
      { component: 'sys', id: 9103, property: 'cfg_rev', range: 'U16' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellygas-7C87CEBCECE4', 'cits')) as any;
    msg.headers[3332] = 'SHGS-1#7C87CEBCECE4#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      sys: {
        cfg_rev: 1,
      },
      gas: {
        alarm_state: 'none',
        ppm: 0,
        sensor_state: 'normal',
      },
    });
  });

  test('Parse status shelly1', async () => {
    const citd = loadResponse('shelly1-34945472A643', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'relay:0', property: 'state', range: '0/1' },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 3101, component: 'temperature', property: 'tC', range: ['-55/125', '999'] },
      { id: 3102, component: 'temperature', property: 'tF', range: ['-67/257', '999'] },
      { id: 3103, component: 'humidity', property: 'value', range: ['0/100', '999'] },
      { id: 3201, component: 'temperature', property: 'tC', range: ['-55/125', '999'] },
      { id: 3202, component: 'temperature', property: 'tF', range: ['-67/257', '999'] },
      { id: 3301, component: 'temperature', property: 'tC', range: ['-55/125', '999'] },
      { id: 3302, component: 'temperature', property: 'tF', range: ['-67/257', '999'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shelly1-34945472A643', 'cits')) as any;
    msg.headers[3332] = 'SHSW-1#34945472A643#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    expect(data_cits).toEqual({
      'sys': {
        cfg_rev: 0,
      },
      'relay:0': {
        state: true,
      },
      'input:0': {
        event: '',
        event_cnt: 0,
        input: 0,
      },
    });
  });

  test('Parse status shelly1l', async () => {
    const citd = loadResponse('shelly1l-E8DB84AAD781', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'relay:0', property: 'state', range: '0/1' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/3500', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 2201, component: 'input:1', property: 'input', range: '0/1' },
      { id: 2202, component: 'input:1', property: 'event', range: ['S/L', ''] },
      { id: 2203, component: 'input:1', property: 'event_cnt', range: 'U16' },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 3104, component: 'sys', property: 'temperature', range: ['-40/300', '999'] },
      { id: 6101, component: 'sys', property: 'overtemperature', range: ['0/1', '-1'] },
    ]);

    msg.payload = JSON.stringify(loadResponse('shelly1l-E8DB84AAD781', 'cits')) as any;
    msg.headers[3332] = 'SHSW-L#E8DB84AAD781#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': { cfg_rev: 0, temperature: 59.11, overtemperature: false },
      'relay:0': { state: true },
      'input:0': { input: 0, event: '', event_cnt: 0 },
      'input:1': { input: 0, event: '', event_cnt: 0 },
    });
  });

  test('Parse status shellybulbduo', async () => {
    const citd = loadResponse('shellybulbduo-34945479CFA4', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'light:0', property: 'state', range: '0/1' },
      { id: 5101, component: 'light:0', property: 'brightness', range: '0/100' },
      { id: 5103, component: 'light:0', property: 'temp', range: '2700/6500' },
      { id: 5104, component: 'light:0', property: 'white', range: '0/100' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/9', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellybulbduo-34945479CFA4', 'cits')) as any;
    msg.headers[3332] = 'SHBDUO-1#34945479CFA4#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': { cfg_rev: 0 },
      'light:0': { state: false, brightness: 100, temp: 6500, white: 100 },
      'meter:0': { power: 0, total: 1186 },
    });
  });

  test('Parse status shellycolorbulb', async () => {
    const citd = loadResponse('shellycolorbulb-485519EE12A7', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'light:0', property: 'state', range: '0/1' },
      { id: 5105, component: 'light:0', property: 'red', range: '0/255' },
      { id: 5106, component: 'light:0', property: 'green', range: '0/255' },
      { id: 5107, component: 'light:0', property: 'blue', range: '0/255' },
      { id: 5108, component: 'light:0', property: 'white', range: '0/255' },
      { id: 5102, component: 'light:0', property: 'gain', range: '0/100' },
      { id: 5101, component: 'light:0', property: 'brightness', range: '0/100' },
      { id: 5103, component: 'light:0', property: 'temp', range: '3000/6500' },
      { id: 9101, component: 'light:0', property: 'mode', range: 'color/white' },
      { id: 5109, component: 'light:0', property: 'effect', range: '0/3' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/9', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellycolorbulb-485519EE12A7', 'cits')) as any;
    msg.headers[3332] = 'SHCB-1#485519EE12A7#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': { cfg_rev: 25 },
      'light:0': {
        state: false,
        red: 0,
        green: 213,
        blue: 255,
        white: 0,
        gain: 1,
        brightness: 1,
        temp: 6465,
        mode: 'color',
        effect: 0,
      },
      'meter:0': { power: 0, total: 143 },
    });
  });

  test('Parse status shellyswitch25 mode relay', async () => {
    const citd = loadResponse('shellyswitch25-3494547BF36C', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'relay:0', property: 'state', range: '0/1' },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/2300', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 6102, component: 'relay:0', property: 'overpower', range: ['0/1', '-1'] },
      { id: 1201, component: 'relay:1', property: 'state', range: '0/1' },
      { id: 2201, component: 'input:1', property: 'input', range: '0/1' },
      { id: 2202, component: 'input:1', property: 'event', range: ['S/L', ''] },
      { id: 2203, component: 'input:1', property: 'event_cnt', range: 'U16' },
      { id: 4201, component: 'meter:1', property: 'power', range: ['0/2300', '-1'] },
      { id: 4203, component: 'meter:1', property: 'total', range: ['U32', '-1'] },
      { id: 6202, component: 'relay:1', property: 'overpower', range: ['0/1', '-1'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 3104, component: 'sys', property: 'temperature', range: ['-40/300', '999'] },
      { id: 6101, component: 'sys', property: 'overtemperature', range: ['0/1', '-1'] },
      { id: 9101, component: 'sys', property: 'profile', range: 'relay/roller' },
      { id: 4108, component: 'sys', property: 'voltage', range: undefined },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellyswitch25-3494547BF36C', 'cits')) as any;
    msg.headers[3332] = 'SHSW-25#3494547BF36C#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': {
        cfg_rev: 0,
        temperature: 51.52,
        overtemperature: false,
        profile: 'relay',
        voltage: 238.07,
      },
      'relay:0': { state: false, overpower: false },
      'relay:1': { state: false, overpower: false },
      'input:0': { input: 0, event: '', event_cnt: 0 },
      'input:1': { input: 0, event: '', event_cnt: 0 },
      'meter:0': { power: 0, total: 0 },
      'meter:1': { power: 0, total: 0 },
    });
  });

  test('Parse status shellyswitch25 mode roller', async () => {
    const citd = loadResponse('shellyswitch25-3494546BBF7E', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 2201, component: 'input:1', property: 'input', range: '0/1' },
      { id: 2202, component: 'input:1', property: 'event', range: ['S/L', ''] },
      { id: 2203, component: 'input:1', property: 'event_cnt', range: 'U16' },
      { id: 1102, component: 'roller:0', property: 'state', range: 'open/close/stop' },
      { id: 1103, component: 'roller:0', property: 'current_pos', range: ['0/100', '-1'] },
      { id: 4102, component: 'meter:0', property: 'power', range: ['0/2300', '-1'] },
      { id: 4104, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 6103, component: 'roller:0', property: 'stop_reason', range: 'normal/safety_switch/obstacle/overpower' },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 3104, component: 'sys', property: 'temperature', range: ['-40/300', '999'] },
      { id: 6101, component: 'sys', property: 'overtemperature', range: ['0/1', '-1'] },
      { id: 9101, component: 'sys', property: 'profile', range: 'relay/roller' },
      { id: 4108, component: 'sys', property: 'voltage', range: undefined },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellyswitch25-3494546BBF7E', 'cits')) as any;
    msg.headers[3332] = 'SHSW-25#3494546BBF7E#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': {
        cfg_rev: 0,
        temperature: 47.11,
        overtemperature: false,
        profile: 'roller',
        voltage: 240.7,
      },
      'roller:0': { state: 'stop', current_pos: 100, stop_reason: 'normal' },
      'input:0': { input: 0, event: '', event_cnt: 0 },
      'input:1': { input: 0, event: '', event_cnt: 0 },
      'meter:0': { power: 0, total: 0 },
    });
  });

  test('Parse status shellyrgbw2 mode white', async () => {
    const citd = loadResponse('shellyrgbw2-EC64C9D199AD', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'light:0', property: 'state', range: '0/1' },
      { id: 5101, component: 'light:0', property: 'brightness', range: '0/100' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/288', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 1201, component: 'light:1', property: 'state', range: '0/1' },
      { id: 5201, component: 'light:1', property: 'brightness', range: '0/100' },
      { id: 4201, component: 'meter:1', property: 'power', range: ['0/288', '-1'] },
      { id: 4203, component: 'meter:1', property: 'total', range: ['U32', '-1'] },
      { id: 1301, component: 'light:2', property: 'state', range: '0/1' },
      { id: 5301, component: 'light:2', property: 'brightness', range: '0/100' },
      { id: 4301, component: 'meter:2', property: 'power', range: ['0/288', '-1'] },
      { id: 4303, component: 'meter:2', property: 'total', range: ['U32', '-1'] },
      { id: 1401, component: 'light:3', property: 'state', range: '0/1' },
      { id: 5401, component: 'light:3', property: 'brightness', range: '0/100' },
      { id: 4401, component: 'meter:3', property: 'power', range: ['0/288', '-1'] },
      { id: 4403, component: 'meter:3', property: 'total', range: ['U32', '-1'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 6102, component: 'sys', property: 'overpower', range: ['0/1', '-1'] },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 9101, component: 'sys', property: 'profile', range: 'color/white' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellyrgbw2-EC64C9D199AD', 'cits')) as any;
    msg.headers[3332] = 'SHRGBW2#EC64C9D199AD#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': { cfg_rev: 0, overpower: false, profile: 'white' },
      'light:0': { state: false, brightness: 1 },
      'light:1': { state: false, brightness: 100 },
      'light:2': { state: false, brightness: 100 },
      'light:3': { state: false, brightness: 100 },
      'meter:0': { power: 0, total: 170 },
      'meter:1': { power: 0, total: 0 },
      'meter:2': { power: 0, total: 0 },
      'meter:3': { power: 0, total: 0 },
      'input:0': { input: 0, event: '', event_cnt: 0 },
    });
  });

  test('Parse status shellyrgbw2 mode color', async () => {
    const citd = loadResponse('shellyrgbw2-EC64C9D3FFEF', 'citd');
    expect(citd).not.toBeUndefined();
    const desc = coapServer.parseDescription(citd);
    expect(desc).toEqual([
      { id: 1101, component: 'light:0', property: 'state', range: '0/1' },
      { id: 5105, component: 'light:0', property: 'red', range: '0/255' },
      { id: 5106, component: 'light:0', property: 'green', range: '0/255' },
      { id: 5107, component: 'light:0', property: 'blue', range: '0/255' },
      { id: 5108, component: 'light:0', property: 'white', range: '0/255' },
      { id: 5102, component: 'light:0', property: 'gain', range: '0/100' },
      { id: 5109, component: 'light:0', property: 'effect', range: '0/3' },
      { id: 4101, component: 'meter:0', property: 'power', range: ['0/288', '-1'] },
      { id: 4103, component: 'meter:0', property: 'total', range: ['U32', '-1'] },
      { id: 6102, component: 'light:0', property: 'overpower', range: ['0/1', '-1'] },
      { id: 9103, component: 'sys', property: 'cfg_rev', range: 'U16' },
      { id: 2101, component: 'input:0', property: 'input', range: '0/1' },
      { id: 2102, component: 'input:0', property: 'event', range: ['S/L', ''] },
      { id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' },
      { id: 9101, component: 'sys', property: 'profile', range: 'color/white' },
    ]);

    msg.payload = JSON.stringify(loadResponse('shellyrgbw2-EC64C9D3FFEF', 'cits')) as any;
    msg.headers[3332] = 'SHRGBW2#EC64C9D3FFEF#2';
    expect(msg.payload).not.toBeUndefined();

    (coapServer as any).deviceDescription.set('192.168.1.100', desc);

    const data_cits = (coapServer as any).parseShellyMessage(msg as unknown as IncomingMessage);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Parsing CoIoT (coap) response from device'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`url: ${CYAN}/cit/s${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`code: ${CYAN}2.05${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`host: ${CYAN}192.168.1.100${db}`));
    // console.error('data_cits:', data_cits);
    expect(data_cits).toEqual({
      'sys': { cfg_rev: 0, profile: 'color' },
      'light:0': {
        state: true,
        red: 38,
        green: 45,
        blue: 255,
        white: 0,
        gain: 100,
        effect: 0,
        overpower: false,
      },
      'meter:0': { power: 1.6, total: 106 },
      'input:0': { input: 0, event: '', event_cnt: 0 },
    });
  });

  test('Getting device description', async () => {
    await coapServer.getDeviceDescription('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    expect(coapServer.isListening).toBeFalsy();
  }, 30000);

  test('Getting device status', async () => {
    await coapServer.getDeviceStatus('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
    expect(coapServer?.isListening).toBeFalsy();
  }, 30000);

  test('Getting multicast device status', async () => {
    await coapServer.getMulticastDeviceStatus(10);
    expect(coapServer.isListening).toBeFalsy();
  }, 30000);

  test('Start server', async () => {
    await new Promise((resolve) => {
      coapServer.on('started', () => {
        resolve(true);
      });
      coapServer.start();
    });

    expect(coapServer.isListening).toBeTruthy();
    expect(coapServer.isReady).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Starting CoIoT (coap) server for shelly devices...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Started CoIoT (coap) server for shelly devices.');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('CoIoT (coap) server is listening on port'));
  }, 5000);

  test('Log error, warning and request', () => {
    (coapServer as any).coapServer.emit('error', new Error('Test error'));
    (coapServer as any).coapServer.emit('warning', new Error('Test warning'));
    (coapServer as any).coapServer.emit('request', msg as any, {} as any);
    (coapServer as any).coapServer.emit('request', { ...(msg as any), code: '0.30', url: '/cit/s' }, {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Test error'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('Test warning'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Coap server got a wrong messagge code'));
  });

  test('Start receiving', async () => {
    expect(coapServer.isListening).toBeTruthy();

    await new Promise((resolve) => {
      const desc = coapServer.getDeviceDescription('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');
      const status = coapServer.getDeviceStatus('192.168.68.68', 'shellydimmer2-98CDAC0D01BB');

      Promise.all([desc, status])
        .then(() => {
          clearTimeout(timeout);
          resolve(true);
          return;
        })
        .catch((err) => {
          clearTimeout(timeout);
          resolve(true);
        });
      // Not on network, so no response
      const timeout = setTimeout(() => {
        // clearInterval(interval);
        resolve(true);
      }, 10000).unref();
    });
  }, 30000);

  test('Stop server', async () => {
    // setDebug(true);
    await new Promise((resolve) => {
      coapServer.on('stopped', (err) => {
        expect(err).toBeUndefined();
        resolve(true);
      });
      coapServer.stop();
    });
    // If the tests run together, the global agent is not stopped
    /*
    await new Promise((resolve) => {
      coapServer.on('agent_stopped', (err) => {
        expect(err).toBeUndefined();
        resolve(true);
      });
    });
    */
    expect(coapServer.isListening).toBeFalsy();
    expect(coapServer.isReady).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopping CoIoT (coap) server for shelly devices...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Stopped CoIoT (coap) server for shelly devices.');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('CoIoT (coap) server closed'));
  }, 30000);
});

const msg = {
  payloadD: {
    blk: [
      { I: 1, D: 'light_0' },
      { I: 2, D: 'input_0' },
      { I: 3, D: 'input_1' },
      { I: 4, D: 'device' },
    ],
    sen: [
      { I: 9103, T: 'EVC', D: 'cfgChanged', R: 'U16', L: 4 },
      { I: 1101, T: 'S', D: 'output', R: '0/1', L: 1 },
      { I: 5101, T: 'S', D: 'brightness', R: '1/100', L: 1 },
      { I: 2101, T: 'S', D: 'input', R: '0/1', L: 2 },
      { I: 2102, T: 'EV', D: 'inputEvent', R: ['S/L', ''], L: 2 },
      { I: 2103, T: 'EVC', D: 'inputEventCnt', R: 'U16', L: 2 },
      { I: 2201, T: 'S', D: 'input', R: '0/1', L: 3 },
      { I: 2202, T: 'EV', D: 'inputEvent', R: ['S/L', ''], L: 3 },
      { I: 2203, T: 'EVC', D: 'inputEventCnt', R: 'U16', L: 3 },
      { I: 4101, T: 'P', D: 'power', U: 'W', R: ['0/230', '-1'], L: 1 },
      { I: 4103, T: 'E', D: 'energy', U: 'Wmin', R: ['U32', '-1'], L: 1 },
      { I: 6102, T: 'A', D: 'overpower', R: ['0/1', '-1'], L: 1 },
      { I: 6109, T: 'P', D: 'overpowerValue', U: 'W', R: ['U32', '-1'], L: 1 },
      { I: 6104, T: 'A', D: 'loadError', R: '0/1', L: 1 },
      { I: 3104, T: 'T', D: 'deviceTemp', U: 'C', R: ['-40/300', '999'], L: 4 },
      { I: 3105, T: 'T', D: 'deviceTemp', U: 'F', R: ['-40/572', '999'], L: 4 },
      { I: 6101, T: 'A', D: 'overtemp', R: ['0/1', '-1'], L: 4 },
      { I: 9101, T: 'S', D: 'mode', R: 'color/white', L: 4 },
    ],
  },
  payloadS: {
    G: [
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
  payload: {},
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
