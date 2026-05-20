// src/auth.test.ts

const MATTER_PORT = 0;
const NAME = 'Auth';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { setupTest } from 'matterbridge/jestutils';

import {
  createBasicShellyAuth,
  createDigestShellyAuth,
  generateNonce,
  getGen1BodyOptions,
  getGen2BodyOptions,
  parseBasicAuthenticateHeader,
  parseDigestAuthenticateHeader,
} from './auth.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Authentication utility test', () => {
  beforeAll(() => {});

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(() => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('parseBasicAuthenticateHeader', () => {
    expect(parseBasicAuthenticateHeader('Basic realm="Shelly')).toStrictEqual({
      realm: 'Shelly',
    });
    // A param without '=' is silently skipped (eqIdx === -1 early-return branch)
    expect(parseBasicAuthenticateHeader('Basic realm="Shelly", broken')).toStrictEqual({
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
    // A param without '=' is silently skipped (eqIdx === -1 early-return branch)
    expect(parseDigestAuthenticateHeader('Digest qop="auth", realm="shellytest", broken, nonce="1", algorithm=SHA-256')).toStrictEqual({
      algorithm: 'SHA-256',
      qop: 'auth',
      realm: 'shellytest',
      nonce: '1',
    });
  });

  test('should parse Digest header with firmware 2.0.0 base64 nonce (no padding)', () => {
    // Nonce observed in real firmware 2.0.0-beta1 traffic (48 bytes, no = padding)
    const nonce = 'AAAAAGoN/xPwAe9+Z7jqowwiKxph4+yZCVXgmYJuPoPfFwln5X5M9f4kpm8taEuM';
    expect(parseDigestAuthenticateHeader(`Digest qop="auth", realm="shellyemminig4-d885acef41a8", nonce="${nonce}", algorithm=SHA-256`)).toStrictEqual({
      algorithm: 'SHA-256',
      qop: 'auth',
      realm: 'shellyemminig4-d885acef41a8',
      nonce,
    });
  });

  test('should preserve = padding when parsing Digest header with padded base64 nonce', () => {
    // Nonces whose byte length is not a multiple of 3 get base64 padding (= or ==).
    // The indexOf-based parser preserves the padding; the old split('=')[1] approach truncated it.
    expect(parseDigestAuthenticateHeader('Digest qop="auth", realm="shelly1minig3-543204547478", nonce="AAAAAABn==", algorithm=SHA-256')).toStrictEqual({
      algorithm: 'SHA-256',
      qop: 'auth',
      realm: 'shelly1minig3-543204547478',
      nonce: 'AAAAAABn==',
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
      nc: '00000001',
      nonce: 1716556501,
      realm: 'shelly1minig3-543204547478',
      response: '2f8dc4010b210741a55e99e1de92a87187623cc0fefdff23a4702caf77c526dc',
      username: 'admin',
    });
  });

  test('should create digest auth with firmware 2.0.0 string nonce', () => {
    // Firmware 2.0.0+ sends a base64 string nonce instead of a numeric nonce
    const nonce = 'AAAAAGoN/xPwAe9+Z7jqowwiKxph4+yZCVXgmYJuPoPfFwln5X5M9f4kpm8taEuM';
    const result = createDigestShellyAuth('admin', 'tango', nonce, 5678, 'shellyemminig4-d885acef41a8');
    expect(result).toStrictEqual({
      algorithm: 'SHA-256',
      cnonce: 5678,
      nc: '00000001',
      nonce,
      realm: 'shellyemminig4-d885acef41a8',
      response: '101406dbc3dafc02380bc4b23a78e15840933a65c63d915b62b34b6334c72cfc',
      username: 'admin',
    });
  });

  test('should format nc as 8-digit hex when nc=2', () => {
    const result = createDigestShellyAuth('admin', 'tango', 1716556501, 1234, 'shelly1minig3-543204547478', 2);
    expect(result.nc).toBe('00000002');
    expect(result.response).toBe('7feb1c362ed16efdcbc13857a3abaa64f9afbedcb4223c6aa704fe0a613c24e8');
  });

  // Passwords with special characters
  // The SHA-256 hash in createDigestShellyAuth and the base64 encoding in createBasicShellyAuth
  // both operate on raw bytes and are not affected by special characters in the password.
  // The table below documents the expected output so any regression is immediately visible.
  test('should handle passwords with special characters in digest auth', () => {
    const realm = 'shelly1minig3-543204547478';
    const nonce = 1716556501;
    const cnonce = 1234;

    // @ and ! — commonly used in passwords
    expect(createDigestShellyAuth('admin', 'p@ss!w0rd', nonce, cnonce, realm).response).toBe('a1bbfd7025c716f41a35270760a788d8efb5e586029bf8d21bdd3109d3631d5f');

    // Colons in the password — the ha1 string is "admin:<realm>:<password>",
    // so extra colons in the password do NOT break the hash (they are part of the password field).
    expect(createDigestShellyAuth('admin', 'p:a:s:s', nonce, cnonce, realm).response).toBe('950aa5fa61c3045f1bdf76a9ff4250bfda216481e97c936e34aacb8408cc4bbd');

    // URL-special characters = and & — safe inside the SHA-256 hash
    expect(createDigestShellyAuth('admin', 'p=ass&ok', nonce, cnonce, realm).response).toBe('a51cb35b336bec454e148eef018fbe5ee35c74bba708c5375a07216999127646');

    // Double-quotes — safe in the hash but would need escaping if placed literally in a header value
    expect(createDigestShellyAuth('admin', 'p"ass"', nonce, cnonce, realm).response).toBe('9c458c8c305b0d75c34a872a8c6130d0e681792549b6a1c6a6b96bc5247483c4');

    // Multibyte UTF-8 characters — SHA-256 hashes the UTF-8 byte sequence, producing a stable result
    expect(createDigestShellyAuth('admin', 'pàsswörld', nonce, cnonce, realm).response).toBe('e16cf4ac97e6d6a804fb031dec474b7da083573a174f22e2b53ee9d25386d7bf');
  });

  test('should handle passwords with special characters in basic auth', () => {
    // Buffer.from("admin:<password>").toString("base64") handles any byte sequence.
    // RFC 7617 defines the first ':' as the user/password separator on decode side,
    // so a ':' inside the password is preserved correctly.
    expect(createBasicShellyAuth('admin', 'p@ss!w0rd')).toBe('YWRtaW46cEBzcyF3MHJk');
    expect(createBasicShellyAuth('admin', 'p:a:s:s')).toBe('YWRtaW46cDphOnM6cw==');
    expect(createBasicShellyAuth('admin', 'p=ass&ok')).toBe('YWRtaW46cD1hc3Mmb2s=');
    expect(createBasicShellyAuth('admin', 'p"ass"')).toBe('YWRtaW46cCJhc3Mi');
    expect(createBasicShellyAuth('admin', 'pàsswörld')).toBe('YWRtaW46cMOgc3N3w7ZybGQ=');
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
          nc: '00000001',
          nonce: 1716556501,
          realm: 'shelly1minig3-543204547478',
          response: '2f8dc4010b210741a55e99e1de92a87187623cc0fefdff23a4702caf77c526dc',
          username: 'admin',
        },
      ),
    ).toBe(
      '{"jsonrpc":"2.0","id":10,"src":"Matterbridge","method":"Switch.Set","params":{"id":"tango"},"auth":{"algorithm":"SHA-256","cnonce":1234,"nc":"00000001","nonce":1716556501,"realm":"shelly1minig3-543204547478","response":"2f8dc4010b210741a55e99e1de92a87187623cc0fefdff23a4702caf77c526dc","username":"admin"}}',
    );
    // Without params (false branch for if (params))
    expect(getGen2BodyOptions('2.0', 10, 'Matterbridge', 'Shelly.GetStatus')).toBe('{"jsonrpc":"2.0","id":10,"src":"Matterbridge","method":"Shelly.GetStatus"}');
    // Without auth (false branch for if (auth))
    expect(getGen2BodyOptions('2.0', 10, 'Matterbridge', 'Shelly.GetStatus', { id: 0 })).toBe(
      '{"jsonrpc":"2.0","id":10,"src":"Matterbridge","method":"Shelly.GetStatus","params":{"id":0}}',
    );
  });
});
