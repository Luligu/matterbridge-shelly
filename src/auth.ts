import crypto from 'crypto';
import fetch from 'node-fetch';

export interface AuthParams {
  realm: string; // device_id
  username: string; // admin
  nonce: number; // generated by device
  cnonce: number; // random number
  response: string; // hash <<user>:<realm>:<password>> + ":" + <nonce> + ":" + <nc> + ":" + <cnonce> + ":" + "auth" + ":" + <dummy_method:dummy_uri>
  algorithm: string; // SHA-256
}

export function parseAuthenticateHeader(authHeader: string): Record<string, string> {
  // 'Digest qop="auth", realm="shelly1minig3-543204547478", nonce="1716556501", algorithm=SHA-256'
  authHeader = authHeader.replace('Digest ', '');
  const authParams: Record<string, string> = {};
  authHeader.split(', ').forEach((param) => {
    const [key, value] = param.split('=');
    authParams[key.trim()] = value.replace(/"/g, '');
  });
  return authParams;
}

export function createShellyAuth(password: string, nonce: number, cnonce: number, realm: string, nc = 1): AuthParams {
  const auth: AuthParams = { realm, username: 'admin', nonce, cnonce, response: '', algorithm: 'SHA-256' };
  const ha1 = crypto.createHash('sha256').update(`admin:${auth.realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('sha256').update('dummy_method:dummy_uri').digest('hex');
  auth.response = crypto.createHash('sha256').update(`${ha1}:${auth.nonce}:${nc}:${cnonce}:auth:${ha2}`).digest('hex');
  return auth;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function makeRpcCall(url: string, method: string, params: object) {
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '',
  };

  const payload = {
    id: 0,
    method, // 'Switch.Toggle',
    params, // { id: 0 },
  };

  options.body = JSON.stringify(payload);

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    // eslint-disable-next-line no-console
    console.log('Response:', data);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error:', error);
  }
}

// makeRpcCall('http://192.168.1.217/rpc', 'Switch.Toggle', { id: 0 });