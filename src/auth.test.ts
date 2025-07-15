// src/auth.test.ts

import { jest } from '@jest/globals';
import { AnsiLogger } from 'matterbridge/logger';

import {
  parseBasicAuthenticateHeader,
  parseDigestAuthenticateHeader,
  createBasicShellyAuth,
  createDigestShellyAuth,
  getGen1BodyOptions,
  getGen2BodyOptions,
  generateNonce,
} from './auth.ts';

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

describe('Authentication utility test', () => {
  beforeAll(() => {
    //
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('parseBasicAuthenticateHeader', () => {
    expect(parseBasicAuthenticateHeader('Basic realm="Shelly')).toStrictEqual({
      realm: 'Shelly',
    });
  });

  test('parseDigestAuthenticateHeader', () => {
    expect(parseDigestAuthenticateHeader('Digest qop="auth", realm="shelly1minig3-543204547478", nonce="1716556501", algorithm=SHA-256')).toStrictEqual({
      algorithm: 'SHA-256',
      qop: 'auth',
      realm: 'shelly1minig3-543204547478',
      nonce: '1716556501',
    });
  });

  test('createBasicShellyAuth', () => {
    expect(createBasicShellyAuth('admin', 'tango')).toStrictEqual('YWRtaW46dGFuZ28=');
  });

  test('createDigestShellyAuth', () => {
    const authParams = parseDigestAuthenticateHeader('Digest qop="auth", realm="shelly1minig3-543204547478", nonce="1716556501", algorithm=SHA-256');
    expect(createDigestShellyAuth('admin', 'tango', parseInt(authParams.nonce), 1234, authParams.realm)).toStrictEqual({
      algorithm: 'SHA-256',
      cnonce: 1234,
      nonce: 1716556501,
      realm: 'shelly1minig3-543204547478',
      response: '3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6',
      username: 'admin',
    });
  });

  test('getGen1BodyOptions', () => {
    expect(getGen1BodyOptions({ id: 'tango' })).toBe('id=tango');
  });

  test('generateNonce', () => {
    expect(generateNonce(1000, 9999)).toBeGreaterThanOrEqual(1000);
    expect(generateNonce(1000, 9999)).toBeLessThanOrEqual(9999);
  });

  test('getGen2BodyOptions', () => {
    expect(
      getGen2BodyOptions(
        '2.0',
        10,
        'Matterbridge',
        'Switch.Set',
        { id: 'tango' },
        {
          algorithm: 'SHA-256',
          cnonce: 1234,
          nonce: 1716556501,
          realm: 'shelly1minig3-543204547478',
          response: '3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6',
          username: 'admin',
        },
      ),
    ).toBe(
      '{"jsonrpc":"2.0","id":10,"src":"Matterbridge","method":"Switch.Set","params":{"id":"tango"},"auth":{"algorithm":"SHA-256","cnonce":1234,"nonce":1716556501,"realm":"shelly1minig3-543204547478","response":"3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6","username":"admin"}}',
    );
  });
});
