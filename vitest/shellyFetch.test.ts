/**
 * @file vitest/shellyFetch.test.ts
 * @description This file contains the tests for the shellyFetch function.
 * @author Luca Liguori
 */

const NAME = 'ShellyFetch';

import { EventEmitter } from 'node:events';
import { promises as fs } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { request } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { loggerLogSpy, setupTest } from 'matterbridge/vitest-utils';

import type { Shelly } from '../src/shelly.js';
import { shellyFetch } from '../src/shellyFetch.js';

// Setup the test environment
await setupTest(NAME, false);

vi.mock('node:https', { spy: true });

describe('shellyFetch', () => {
  let shelly: Shelly;
  let log: AnsiLogger;
  let server: Server;
  let serverPort: number;
  let testFilePath: string;
  let requestHandler: (req: IncomingMessage, res: ServerResponse) => void;

  test('should use device TLS settings for HTTPS RPC and discovery', async () => {
    shelly.caBundlePath = testFilePath;
    shelly.rejectUnauthorized = false;
    await fs.writeFile(testFilePath, 'test CA bundle');
    const end = vi.fn();
    const req = new EventEmitter();
    Object.assign(req, { end });
    const requestSpy = vi.mocked(request).mockImplementation(((_url, _options, callback) => {
      const res = new EventEmitter();
      Object.assign(res, { statusCode: 200, statusMessage: 'OK', rawHeaders: ['Content-Type', 'application/json'] });
      queueMicrotask(() => {
        callback?.(res as IncomingMessage);
        res.emit('data', Buffer.from(JSON.stringify({ result: { connected: true }, gen: 3 })));
        res.emit('end');
      });
      return req;
    }) as typeof request);
    try {
      expect(await shellyFetch(shelly, log, '192.168.68.60', 443, 'Ws.GetStatus')).toEqual({ connected: true });
      expect(requestSpy).toHaveBeenLastCalledWith(
        'https://192.168.68.60:443/rpc',
        expect.objectContaining({
          method: 'POST',
          ca: Buffer.from('test CA bundle'),
          rejectUnauthorized: false,
        }),
        expect.any(Function),
      );
      expect(await shellyFetch(shelly, log, '192.168.68.60', 443, 'shelly')).toMatchObject({ gen: 3 });
      expect(requestSpy).toHaveBeenLastCalledWith(
        'https://192.168.68.60:443/shelly',
        expect.objectContaining({
          rejectUnauthorized: false,
        }),
        expect.any(Function),
      );
    } finally {
      requestSpy.mockRestore();
    }
  });

  test('should return null when the HTTPS CA file cannot be read', async () => {
    shelly.caBundlePath = testFilePath + '.missing';
    shelly.rejectUnauthorized = true;
    expect(await shellyFetch(shelly, log, '192.168.68.60', 443, 'Ws.GetStatus')).toBeNull();
  });

  test.each([204, 205, 304])('should return null for an HTTP response without JSON (status %i)', async (status) => {
    requestHandler = (_req, res): void => {
      res.statusCode = status;
      res.end();
    };
    expect(await shellyFetch(shelly, log, 'localhost', serverPort, 'status')).toBeNull();
  });

  beforeAll(() => {});

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock instances
    shelly = {
      username: 'testuser',
      password: 'testpass',
    } as Shelly;

    log = new AnsiLogger({ logName: 'test', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

    // Create temporary file for testing
    testFilePath = path.join(tmpdir(), `test-device-${Date.now()}.json`);

    // Create HTTP server
    server = createServer((req, res) => {
      if (requestHandler) {
        requestHandler(req, res);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    // Start server on random port
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === 'object') {
          serverPort = address.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    vi.clearAllMocks();

    // Clean up server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('File-based fetch', () => {
    it('should read WiFi configuration and status from fixtures', async () => {
      const fixture = path.join('src', 'mock', 'shellypstripg4-D885ACE52518.json');
      const payload = JSON.parse(await fs.readFile(fixture, 'utf8'));
      expect(await shellyFetch(shelly, log, fixture, 80, 'Wifi.GetConfig')).toEqual(payload.settings.wifi);
      expect(await shellyFetch(shelly, log, fixture, 80, 'Wifi.GetStatus')).toEqual(payload.status.wifi);
      for (const data of [{}, { settings: {}, status: {} }]) {
        await fs.writeFile(testFilePath, JSON.stringify(data));
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Wifi.GetConfig')).toBeNull();
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Wifi.GetStatus')).toBeNull();
      }
    });

    it('should read Matter fixture configuration and status', async () => {
      const fixture = path.join('src', 'mock', 'shelly1g3-34B7DACAC830.json');
      const payload = JSON.parse(await fs.readFile(fixture, 'utf8'));
      expect(await shellyFetch(shelly, log, fixture, 80, 'Matter.GetConfig')).toEqual(payload.settings.matter);
      expect(await shellyFetch(shelly, log, fixture, 80, 'Matter.GetStatus')).toEqual(payload.status.matter);
      for (const data of [{}, { settings: {}, status: {} }]) {
        await fs.writeFile(testFilePath, JSON.stringify(data));
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Matter.GetConfig')).toBeNull();
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Matter.GetStatus')).toBeNull();
      }
    });

    it('should read Ws fixture data including missing Wall Display fields', async () => {
      const fixture = path.join('src', 'mock', 'shellyplussmoke-E08CFE8BD798.json');
      expect(await shellyFetch(shelly, log, fixture, 80, 'Ws.GetConfig')).toEqual({ enable: true, server: 'ws://192.168.69.100:8485', ssl_ca: 'ca.pem' });
      expect(await shellyFetch(shelly, log, fixture, 80, 'Ws.GetStatus')).toEqual({ connected: true });
      const wallDisplay = path.join('src', 'mock', 'shellywalldisplay-00082261E102.json');
      expect(await shellyFetch(shelly, log, wallDisplay, 80, 'Ws.GetConfig')).toEqual({ enable: false, ssl_ca: 'ca.pem' });
      expect(await shellyFetch(shelly, log, wallDisplay, 80, 'Ws.GetStatus')).toBeNull();
      await fs.writeFile(testFilePath, '{}');
      expect(await shellyFetch(shelly, log, testFilePath, 80, 'Ws.GetConfig')).toBeNull();
      expect(await shellyFetch(shelly, log, testFilePath, 80, 'Ws.GetStatus')).toBeNull();
    });

    it('should fetch Sys data when using a Gen 2 fixture', async () => {
      const fixture = path.join('src', 'mock', 'shellyplussmoke-E08CFE8BD798.json');
      expect(await shellyFetch(shelly, log, fixture, 80, 'Sys.GetConfig')).toMatchObject({ rpc_udp: { dst_addr: null, listen_port: null } });
      expect(await shellyFetch(shelly, log, fixture, 80, 'Sys.GetStatus')).toMatchObject({ restart_required: false, uptime: 15 });
    });

    it('should return null when Sys data is missing', async () => {
      for (const data of [{}, { settings: {}, status: {} }]) {
        await fs.writeFile(testFilePath, JSON.stringify(data));
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Sys.GetConfig')).toBeNull();
        expect(await shellyFetch(shelly, log, testFilePath, 80, 'Sys.GetStatus')).toBeNull();
      }
    });

    it('should fetch cloud configuration and status when using device fixtures', async () => {
      const gen1Path = path.join('src', 'mock', 'shellydimmer2-98CDAC0D01BB.json');
      const gen2Path = path.join('src', 'mock', 'shellyplussmoke-E08CFE8BD798.json');

      expect(await shellyFetch(shelly, log, gen1Path, 80, 'settings/cloud')).toEqual({ enabled: true, connected: true });
      expect(await shellyFetch(shelly, log, gen2Path, 80, 'Cloud.GetConfig')).toEqual({
        enable: true,
        server: 'shelly-103-eu.shelly.cloud:6022/jrpc',
      });
      expect(await shellyFetch(shelly, log, gen2Path, 80, 'Cloud.GetStatus')).toEqual({ connected: true });
    });

    it('should return null when cloud data is missing from a JSON file', async () => {
      for (const data of [{}, { settings: {}, status: {} }]) {
        await fs.writeFile(testFilePath, JSON.stringify(data));
        for (const service of ['settings/cloud', 'Cloud.GetConfig', 'Cloud.GetStatus']) {
          expect(await shellyFetch(shelly, log, testFilePath, 80, service)).toBeNull();
        }
      }
    });

    it('should fetch shelly data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'shelly');

      expect(result).toEqual(mockFileData.shelly);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Fetching device payloads from file ${testFilePath}: service shelly`));
    });

    it('should fetch status data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'status');

      expect(result).toEqual(mockFileData.status);
    });

    it('should fetch settings data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'settings');

      expect(result).toEqual(mockFileData.settings);
    });

    it('should fetch Gen2+ status data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 2 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'Shelly.GetStatus');

      expect(result).toEqual(mockFileData.status);
    });

    it('should fetch Gen2+ config data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 2 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'Shelly.GetConfig');

      expect(result).toEqual(mockFileData.settings);
    });

    it('should fetch components data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 2 },
        status: { online: true },
        settings: { name: 'test' },
        components: [{ id: 1, type: 'switch' }],
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'Shelly.GetComponents');

      expect(result).toEqual(mockFileData);
    });

    it('should log error for unknown service in JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'unknown');

      expect(result).toBeNull(); // Method continues to HTTP fetch which fails
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error fetching device payloads from file ${testFilePath}: no service unknown found`));
    });

    it('should handle file read error', async () => {
      const nonExistentFile = path.join(tmpdir(), 'non-existent-file.json');

      const result = await shellyFetch(shelly, log, nonExistentFile, 80, 'shelly');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.ERROR,
        expect.stringContaining(`Error reading device payloads from file ${nonExistentFile}:`),
        expect.stringContaining('ENOENT'),
      );
    });

    it('should handle JSON parse error', async () => {
      await fs.writeFile(testFilePath, 'invalid json');

      const result = await shellyFetch(shelly, log, testFilePath, 80, 'shelly');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading device payloads from file ${testFilePath}:`), expect.any(String));
    });

    it('should fetch shelly data from a real device mock file', async () => {
      const result = await shellyFetch(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'), 80, 'shelly');

      expect(result).toBeDefined();
      expect(result).toHaveProperty('name');
    });

    it('should handle non-existent mock file', async () => {
      const result = await shellyFetch(shelly, log, 'non-existent-file.json', 80, 'shelly');

      expect(result).toBeNull();
    });

    it('should handle unknown service on a real device mock file', async () => {
      const result = await shellyFetch(shelly, log, path.join('src', 'mock', 'shelly2pmg3-34CDB0770C4C.json'), 80, 'non-existent-service');

      expect(result).toBeNull();
    });
  });

  describe('HTTP-based fetch', () => {
    describe('Gen 1 devices', () => {
      it('should successfully fetch from Gen 1 device without auth (GET request)', async () => {
        const mockResponse = { id: 'test', gen: 1 };

        requestHandler = (req, res): void => {
          expect(req.method).toBe('GET');
          expect(req.url).toBe('/shelly');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(mockResponse));
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'shelly');

        expect(result).toEqual(mockResponse);
      });

      it('should successfully fetch from Gen 1 device without auth (POST request)', async () => {
        const mockResponse = { online: true, temperature: 25 };

        requestHandler = (req, res): void => {
          expect(req.method).toBe('POST');
          expect(req.url).toBe('/status');
          expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');

          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            expect(body).toBe('param1=value1');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          });
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status', { param1: 'value1' });

        expect(result).toEqual(mockResponse);
      });

      it('should handle Gen 1 basic authentication', async () => {
        const mockResponse = { online: true };
        let authAttempts = 0;

        requestHandler = (req, res): void => {
          authAttempts++;

          if (authAttempts === 1) {
            // First request - no auth
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
            res.end('Unauthorized');
          } else {
            // Second request - with auth
            // oxlint-disable-next-line vitest/no-conditional-expect -- only the second (authenticated) request carries the header to assert on
            expect(req.headers.authorization).toBeTruthy();
            // oxlint-disable-next-line vitest/no-conditional-expect -- only the second (authenticated) request carries the header to assert on
            expect(req.headers.authorization).toMatch(/^Basic /);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          }
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status');

        expect(result).toEqual(mockResponse);
        expect(authAttempts).toBe(2);
      });

      it('should handle missing credentials for basic auth', async () => {
        const shellyNoAuth = { username: '', password: '' } as Shelly;

        requestHandler = (req, res): void => {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
          res.end('Unauthorized');
        };

        const result = await shellyFetch(shellyNoAuth, log, 'localhost', serverPort, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('requires authentication but no username has been provided'));
      });
    });

    describe('Gen 2+ devices', () => {
      it('should successfully fetch from Gen 2+ device without auth', async () => {
        const mockResponse = { result: { online: true, temperature: 25 } };

        requestHandler = (req, res): void => {
          expect(req.method).toBe('POST');
          expect(req.url).toBe('/rpc');
          expect(req.headers['content-type']).toBe('application/json');

          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            const parsed = JSON.parse(body);
            expect(parsed.method).toBe('Shelly.GetStatus');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          });
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'Shelly.GetStatus', { id: 0 });

        expect(result).toEqual(mockResponse.result);
      });

      it('should handle Gen 2+ digest authentication', async () => {
        const mockResponse = { result: { online: true } };
        let authAttempts = 0;

        requestHandler = (req, res): void => {
          authAttempts++;

          if (authAttempts === 1) {
            // First request - no auth
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Digest realm="shelly", nonce="12345"');
            res.end('Unauthorized');
          } else {
            // Second request - with auth
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              const parsed = JSON.parse(body);
              // oxlint-disable-next-line vitest/no-conditional-expect -- only the second (authenticated) request carries auth to assert on
              expect(parsed.auth).toBeDefined();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(mockResponse));
            });
          }
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'Shelly.GetStatus');

        expect(result).toEqual(mockResponse.result);
        expect(authAttempts).toBe(2);
      });

      it('should handle Gen 2+ digest authentication with a firmware 2.0.0+ base64 nonce and no password', async () => {
        const mockResponse = { result: { online: true } };
        const shellyNoPassword = { username: 'testuser', password: undefined } as unknown as Shelly;
        let authAttempts = 0;

        requestHandler = (req, res): void => {
          authAttempts++;

          if (authAttempts === 1) {
            // First request - no auth. The nonce is a base64 string, as used by firmware 2.0.0+ (not purely numeric)
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Digest realm="shelly", nonce="Tm9uY2VTdHJpbmc="');
            res.end('Unauthorized');
          } else {
            // Second request - with auth
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              const parsed = JSON.parse(body);
              // oxlint-disable-next-line vitest/no-conditional-expect -- only the second (authenticated) request carries auth to assert on
              expect(parsed.auth).toBeDefined();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(mockResponse));
            });
          }
        };

        const result = await shellyFetch(shellyNoPassword, log, 'localhost', serverPort, 'Shelly.GetStatus');

        expect(result).toEqual(mockResponse.result);
        expect(authAttempts).toBe(2);
      });
    });

    describe('Error handling', () => {
      it('should handle HTTP 500 error', async () => {
        requestHandler = (req, res): void => {
          res.statusCode = 500;
          res.statusMessage = 'Internal Server Error';
          res.end('Server Error');
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Response error fetching shelly'));
      });

      it('should handle falsy params in the request and error logging', async () => {
        requestHandler = (req, res): void => {
          res.statusCode = 500;
          res.statusMessage = 'Internal Server Error';
          res.end('Server Error');
        };

        // The default parameter only applies to undefined, so passing null explicitly keeps params falsy at runtime
        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status', null as unknown as Record<string, string>);

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Response error fetching shelly gen 1 host'));
      });

      it('should handle falsy params in the catch block logging', async () => {
        // Use a port that nothing is listening on to reach the catch block
        const unavailablePort = 12346;

        const result = await shellyFetch(shelly, log, 'localhost', unavailablePort, 'status', null as unknown as Record<string, string>);

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error fetching shelly gen 1 host'));
      });

      it('should handle network timeout', async () => {
        // Use fake timers to speed up the timeout test
        vi.useFakeTimers();

        // Create a server that never responds
        const timeoutServer = createServer((req, res) => {
          // Never respond to simulate timeout
        });

        const timeoutPort = await new Promise<number>((resolve) => {
          timeoutServer.listen(0, () => {
            const address = timeoutServer.address();
            if (address && typeof address === 'object') {
              resolve(address.port);
            }
          });
        });

        // Start the fetch request (this will not await)
        const fetchPromise = shellyFetch(shelly, log, 'localhost', timeoutPort, 'status');

        // Fast-forward time by 20 seconds to trigger the timeout
        vi.advanceTimersByTime(20000);

        // Now await the result
        const result = await fetchPromise;

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Aborting fetch device'));

        timeoutServer.close();
        vi.useRealTimers();
      });

      it('should handle connection refused', async () => {
        // Use a port that nothing is listening on
        const unavailablePort = 12345;

        const result = await shellyFetch(shelly, log, 'localhost', unavailablePort, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error fetching shelly'));
      });

      it('should handle invalid JSON response', async () => {
        requestHandler = (req, res): void => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end('invalid json');
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error fetching shelly'));
      });
    });

    describe('Parameter handling', () => {
      it('should handle empty parameters', async () => {
        const mockResponse = { online: true };

        requestHandler = (req, res): void => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              // oxlint-disable-next-line vitest/no-conditional-expect -- only relevant for the POST branch being exercised
              expect(body).toBe(''); // No parameters should result in empty body
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(mockResponse));
            });
          } else {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          }
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status');

        expect(result).toEqual(mockResponse);
      });

      it('should handle complex parameters for Gen2+', async () => {
        const mockResponse = { result: { online: true } };
        const complexParams = {
          id: 0,
          enabled: true,
          timeout: 5000,
          config: { setting1: 'value1', setting2: 2 },
        };

        requestHandler = (req, res): void => {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            const parsed = JSON.parse(body);
            expect(parsed.params).toEqual(complexParams);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          });
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'Shelly.GetStatus', complexParams);

        expect(result).toEqual(mockResponse.result);
      });
    });

    describe('Generation detection', () => {
      it('should detect Gen 1 service (lowercase)', async () => {
        const mockResponse = { name: 'test' };

        requestHandler = (req, res): void => {
          expect(req.url).toBe('/settings'); // Gen 1 uses direct endpoint
          expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(mockResponse));
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'settings');

        expect(result).toEqual(mockResponse);
      });

      it('should detect Gen 2+ service (mixed case)', async () => {
        const mockResponse = { result: { name: 'test' } };

        requestHandler = (req, res): void => {
          expect(req.url).toBe('/rpc'); // Gen 2+ uses RPC endpoint
          expect(req.headers['content-type']).toBe('application/json');

          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            const parsed = JSON.parse(body);
            expect(parsed.method).toBe('Shelly.GetConfig');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          });
        };

        const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'Shelly.GetConfig');

        expect(result).toEqual(mockResponse.result);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined username and password', async () => {
      const shellyUndefined = { username: undefined, password: undefined } as Shelly;

      requestHandler = (req, res): void => {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
        res.end('Unauthorized');
      };

      const result = await shellyFetch(shellyUndefined, log, 'localhost', serverPort, 'status');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('requires authentication but no username has been provided'));
    });

    it('should handle empty service name', async () => {
      const mockResponse = { online: true };

      requestHandler = (req, res): void => {
        expect(req.url).toBe('/'); // Empty service should result in root path
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockResponse));
      };

      const result = await shellyFetch(shelly, log, 'localhost', serverPort, '');

      expect(result).toEqual(mockResponse);
    });

    it('should handle malformed WWW-Authenticate header', async () => {
      requestHandler = (req, res): void => {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'malformed header');
        res.end('Unauthorized');
      };

      const result = await shellyFetch(shelly, log, 'localhost', serverPort, 'status');

      expect(result).toBeNull();
    });
  });
});
