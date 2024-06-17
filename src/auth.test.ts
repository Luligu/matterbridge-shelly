import { parseBasicAuthenticateHeader, parseDigestAuthenticateHeader, createBasicShellyAuth, createDigestShellyAuth, getGen1BodyOptions, getGen2BodyOptions } from './auth';

describe('Authenticathe utility test', () => {
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
      'algorithm': 'SHA-256',
      'cnonce': 1234,
      'nonce': 1716556501,
      'realm': 'shelly1minig3-543204547478',
      'response': '3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6',
      'username': 'admin',
    });
  });

  test('getGen1BodyOptions', () => {
    expect(getGen1BodyOptions({ id: 'tango' })).toBe('id=tango');
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
          'algorithm': 'SHA-256',
          'cnonce': 1234,
          'nonce': 1716556501,
          'realm': 'shelly1minig3-543204547478',
          'response': '3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6',
          'username': 'admin',
        },
      ),
    ).toBe(
      '{"jsonrpc":"2.0","id":10,"src":"Matterbridge","method":"Switch.Set","params":{"id":"tango"},"auth":{"algorithm":"SHA-256","cnonce":1234,"nonce":1716556501,"realm":"shelly1minig3-543204547478","response":"3e07b0fe38c419b01b1d79400d89e43bf5247a04631dc250e5275ee98a5e86f6","username":"admin"}}',
    );
  });
});
