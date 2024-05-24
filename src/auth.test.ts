import { parseAuthenticateHeader, createShellyAuth } from './auth';

describe('Authenticathe utility test', () => {
  test('parseAuthenticateHeader', () => {
    expect(parseAuthenticateHeader('Digest qop="auth", realm="shelly1minig3-543204547478", nonce="1716556501", algorithm=SHA-256')).toStrictEqual({
      algorithm: 'SHA-256',
      qop: 'auth',
      realm: 'shelly1minig3-543204547478',
      nonce: '1716556501',
    });
  });

  test('createShellyAuth', () => {
    const authParams = parseAuthenticateHeader('Digest qop="auth", realm="shelly1minig3-543204547478", nonce="1716556501", algorithm=SHA-256');
    expect(createShellyAuth('tango', parseInt(authParams.nonce), 1234, authParams.realm)).toStrictEqual({
      'algorithm': 'SHA-256',
      'cnonce': 1234,
      'nonce': 1716556501,
      'realm': 'shelly1minig3-543204547478',
      'response': '3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6',
      'username': 'admin',
    });
  });
});
