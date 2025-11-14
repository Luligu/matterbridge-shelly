// src/shellyDevice.fetch.test.ts

/* eslint-disable jest/no-conditional-expect */

const MATTER_PORT = 0;
const NAME = 'ShellyDeviceFetch';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createServer, Server, IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { jest } from '@jest/globals';

import { ShellyDevice } from './shellyDevice.js';
import { Shelly } from './shelly.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

describe('ShellyDevice.fetch', () => {
  let shelly: Shelly;
  let log: AnsiLogger;
  let server: Server;
  let serverPort: number;
  let testFilePath: string;
  let requestHandler: (req: IncomingMessage, res: ServerResponse) => void;

  beforeAll(() => {});

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

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
    jest.clearAllMocks();

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
    jest.restoreAllMocks();
  });

  describe('File-based fetch', () => {
    it('should fetch shelly data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'shelly');

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

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'status');

      expect(result).toEqual(mockFileData.status);
    });

    it('should fetch settings data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'settings');

      expect(result).toEqual(mockFileData.settings);
    });

    it('should fetch Gen2+ status data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 2 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'Shelly.GetStatus');

      expect(result).toEqual(mockFileData.status);
    });

    it('should fetch Gen2+ config data from JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 2 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'Shelly.GetConfig');

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

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'Shelly.GetComponents');

      expect(result).toEqual(mockFileData);
    });

    it('should log error for unknown service in JSON file', async () => {
      const mockFileData = {
        shelly: { id: 'test', gen: 1 },
        status: { online: true },
        settings: { name: 'test' },
      };

      await fs.writeFile(testFilePath, JSON.stringify(mockFileData));

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'unknown');

      expect(result).toBeNull(); // Method continues to HTTP fetch which fails
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error fetching device payloads from file ${testFilePath}: no service unknown found`));
    });

    it('should handle file read error', async () => {
      const nonExistentFile = path.join(tmpdir(), 'non-existent-file.json');

      const result = await ShellyDevice.fetch(shelly, log, nonExistentFile, 'shelly');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.ERROR,
        expect.stringContaining(`Error reading device payloads from file ${nonExistentFile}:`),
        expect.objectContaining({
          message: expect.stringContaining('ENOENT'),
        }),
      );
    });

    it('should handle JSON parse error', async () => {
      await fs.writeFile(testFilePath, 'invalid json');

      const result = await ShellyDevice.fetch(shelly, log, testFilePath, 'shelly');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading device payloads from file ${testFilePath}:`), expect.any(String));
    });
  });

  describe('HTTP-based fetch', () => {
    describe('Gen 1 devices', () => {
      it('should successfully fetch from Gen 1 device without auth (GET request)', async () => {
        const mockResponse = { id: 'test', gen: 1 };

        requestHandler = (req, res) => {
          expect(req.method).toBe('GET');
          expect(req.url).toBe('/shelly');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(mockResponse));
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'shelly');

        expect(result).toEqual(mockResponse);
      });

      it('should successfully fetch from Gen 1 device without auth (POST request)', async () => {
        const mockResponse = { online: true, temperature: 25 };

        requestHandler = (req, res) => {
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

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status', { param1: 'value1' });

        expect(result).toEqual(mockResponse);
      });

      it('should handle Gen 1 basic authentication', async () => {
        const mockResponse = { online: true };
        let authAttempts = 0;

        requestHandler = (req, res) => {
          authAttempts++;

          if (authAttempts === 1) {
            // First request - no auth
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
            res.end('Unauthorized');
          } else {
            // Second request - with auth
            expect(req.headers.authorization).toBeTruthy();
            expect(req.headers.authorization).toMatch(/^Basic /);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(mockResponse));
          }
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status');

        expect(result).toEqual(mockResponse);
        expect(authAttempts).toBe(2);
      });

      it('should handle missing credentials for basic auth', async () => {
        const shellyNoAuth = { username: '', password: '' } as Shelly;

        requestHandler = (req, res) => {
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
          res.end('Unauthorized');
        };

        const result = await ShellyDevice.fetch(shellyNoAuth, log, `localhost:${serverPort}`, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('requires authentication but no username has been provided'));
      });
    });

    describe('Gen 2+ devices', () => {
      it('should successfully fetch from Gen 2+ device without auth', async () => {
        const mockResponse = { result: { online: true, temperature: 25 } };

        requestHandler = (req, res) => {
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

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'Shelly.GetStatus', { id: 0 });

        expect(result).toEqual(mockResponse.result);
      });

      it('should handle Gen 2+ digest authentication', async () => {
        const mockResponse = { result: { online: true } };
        let authAttempts = 0;

        requestHandler = (req, res) => {
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
              expect(parsed.auth).toBeDefined();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(mockResponse));
            });
          }
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'Shelly.GetStatus');

        expect(result).toEqual(mockResponse.result);
        expect(authAttempts).toBe(2);
      });
    });

    describe('Error handling', () => {
      it('should handle HTTP 500 error', async () => {
        requestHandler = (req, res) => {
          res.statusCode = 500;
          res.statusMessage = 'Internal Server Error';
          res.end('Server Error');
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Response error fetching shelly'));
      });

      it('should handle network timeout', async () => {
        // Use fake timers to speed up the timeout test
        jest.useFakeTimers();

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
        const fetchPromise = ShellyDevice.fetch(shelly, log, `localhost:${timeoutPort}`, 'status');

        // Fast-forward time by 20 seconds to trigger the timeout
        jest.advanceTimersByTime(20000);

        // Now await the result
        const result = await fetchPromise;

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Aborting fetch device'));

        timeoutServer.close();
        jest.useRealTimers();
      });

      it('should handle connection refused', async () => {
        // Use a port that nothing is listening on
        const unavailablePort = 12345;

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${unavailablePort}`, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error fetching shelly'));
      });

      it('should handle invalid JSON response', async () => {
        requestHandler = (req, res) => {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end('invalid json');
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status');

        expect(result).toBeNull();
        expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Error fetching shelly'));
      });
    });

    describe('Parameter handling', () => {
      it('should handle empty parameters', async () => {
        const mockResponse = { online: true };

        requestHandler = (req, res) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
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

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status');

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

        requestHandler = (req, res) => {
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

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'Shelly.GetStatus', complexParams);

        expect(result).toEqual(mockResponse.result);
      });
    });

    describe('Generation detection', () => {
      it('should detect Gen 1 service (lowercase)', async () => {
        const mockResponse = { name: 'test' };

        requestHandler = (req, res) => {
          expect(req.url).toBe('/settings'); // Gen 1 uses direct endpoint
          expect(req.headers['content-type']).toBe('application/x-www-form-urlencoded');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(mockResponse));
        };

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'settings');

        expect(result).toEqual(mockResponse);
      });

      it('should detect Gen 2+ service (mixed case)', async () => {
        const mockResponse = { result: { name: 'test' } };

        requestHandler = (req, res) => {
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

        const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'Shelly.GetConfig');

        expect(result).toEqual(mockResponse.result);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined username and password', async () => {
      const shellyUndefined = { username: undefined, password: undefined } as Shelly;

      requestHandler = (req, res) => {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="shelly"');
        res.end('Unauthorized');
      };

      const result = await ShellyDevice.fetch(shellyUndefined, log, `localhost:${serverPort}`, 'status');

      expect(result).toBeNull();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('requires authentication but no username has been provided'));
    });

    it('should handle empty service name', async () => {
      const mockResponse = { online: true };

      requestHandler = (req, res) => {
        expect(req.url).toBe('/'); // Empty service should result in root path
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(mockResponse));
      };

      const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, '');

      expect(result).toEqual(mockResponse);
    });

    it('should handle malformed WWW-Authenticate header', async () => {
      requestHandler = (req, res) => {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'malformed header');
        res.end('Unauthorized');
      };

      const result = await ShellyDevice.fetch(shelly, log, `localhost:${serverPort}`, 'status');

      expect(result).toBeNull();
    });
  });
});
