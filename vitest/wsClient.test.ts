/**
 * @file vitest/wsClient.test.ts
 * @description This file contains the tests for the WsClient class.
 * @author Luca Liguori
 */

/* oxlint-disable typescript/no-base-to-string -- the mock server only ever sends JSON strings, so message is always a Buffer */

const NAME = 'WsClient';

import { db, er, hk, LogLevel, nf, wr, zb } from 'matterbridge/logger';
import { wait, waiter } from 'matterbridge/utils';
import { consoleDebugSpy, flushAsync, loggerLogSpy, setupTest } from 'matterbridge/vitest-utils';
import { WebSocket, WebSocketServer } from 'ws';

import { WsClient } from '../src/wsClient.js';

// Setup the test environment
await setupTest(NAME, false);

describe('ShellyWsClient', () => {
  let wsClient: WsClient;
  let server: WebSocketServer;

  let sendPong = true;

  beforeAll(async () => {
    // Create a WebSocket server and await its listening state
    await new Promise<void>((resolve) => {
      server = new WebSocketServer({ port: 8080 }, () => {
        const address = server.address() as { address: string; family: string; port: number };
        resolve();
      });
    });

    server.on('connection', (ws) => {
      server.emit('client_connected');

      ws.on('close', () => {
        server.emit('client_disconnected');
      });
      ws.on('error', (error) => {});
      ws.on('message', (message) => {});
      ws.on('ping', () => {
        // oxlint-disable-next-line eslint/no-console -- consoleDebugSpy asserts this call below
        console.debug('Ping received');
        if (sendPong) {
          ws.pong();
        }
      });
      ws.on('open', () => {});
    });

    server.on('error', (error) => {});

    server.on('close', () => {});
  });

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    // Stop the WebSocket client
    wsClient.stop();

    // Wait for the WebSocket server to close using a Promise
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    // Wait a bit to ensure all async operations are done
    await flushAsync();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('should fail with wrong address', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'xxxxxx', 8080);
    wsClient.once('error', (error) => {});
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WsClient);
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();

    // Await connection to the server
    await new Promise<void>((resolve) => {
      wsClient.start();
      const interval = setInterval(() => {
        if (!wsClient.isConnecting && !wsClient.isConnected) {
          clearInterval(interval);
          resolve();
        }
      }, 100).unref();
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}xxxxxx${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}xxxxxx${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`WebSocket error with Shelly device ${hk}Jest${er} host ${zb}xxxxxx${er}`));
    wsClient.stop();
  }, 10000);

  test('should not connect when connected', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);

    await new Promise<void>((resolve) => {
      wsClient.once('open', () => {
        resolve();
      });
      wsClient.start();
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`WebSocket connection opened with Shelly device ${hk}Jest${nf} host ${zb}localhost${nf}`));

    vi.clearAllMocks();
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`WebSocket client is already connected`));

    vi.clearAllMocks();
    await new Promise<void>((resolve) => {
      server.once('client_disconnected', () => {
        resolve();
      });
      wsClient.stop();
    });
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Closed ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
  }, 10000);

  test('should terminate before connected', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.start();
    wsClient.stop();
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
    await new Promise<void>((resolve) =>
      setTimeout(() => {
        resolve();
      }, 2000),
    );
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Terminated ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
  }, 10000);

  test('should fail to create', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'invald - host', 8080);
    wsClient.start();
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to create WebSocket connection to ${zb}ws://invald - host:8080/rpc${er}:`));
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
  }, 10000);

  test('create the wsClient', () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WsClient);

    wsClient.setHost('localhost');
    expect((wsClient as any).wsHost).toBe('localhost');
    expect((wsClient as any).wsUrl).toBe(`ws://localhost/rpc`);

    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
  });

  test('should log error if not connected', () => {
    expect(server).toBeDefined();
    wsClient.sendRequest('Shelly.GetStatus');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `SendRequest error: WebSocket client is not connected to device ${hk}Jest${er} host ${zb}localhost${er}`);
  });

  test('should connect to the server', async () => {
    expect(server).toBeDefined();
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          expect(msg.method).toBe('Shelly.GetStatus');
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();

    const ws = await connectPromise;
    expect((wsClient as any).auth).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    (wsClient as any).stopPingPong();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stop PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  }, 10000);

  test('should start ping pong and timeout', async () => {
    expect(server).toBeDefined();
    (wsClient as any).startPingPong(250);
    expect((wsClient as any).pingInterval).toBeDefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Start PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    await wait(500);
    expect(consoleDebugSpy).toHaveBeenCalledWith('Ping received');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Pong received from device ${hk}Jest${db} host ${zb}localhost${db}, connection is alive.`);

    (wsClient as any).stopPingPong();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stop PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  }, 10000);

  test('should respond to error event', async () => {
    expect(server).toBeDefined();
    wsClient.once('error', (error) => {
      // console.error('Error event received:', error);
    });
    (wsClient as any).wsClient?.emit('error', new Error('Test error'));
    expect(wsClient.isConnecting).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`WebSocket error with Shelly device ${hk}Jest${er} host ${zb}localhost${er}`));
  }, 10000);

  test('should respond to close event', async () => {
    expect(server).toBeDefined();
    (wsClient as any).wsClient?.emit('close', 1000, Buffer.from('Test close'));
    expect(wsClient.isConnected).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`WebSocket connection closed with Shelly device ${hk}Jest${nf} host ${zb}localhost${nf}`));
    (wsClient as any)._isConnected = true;
  }, 10000);

  test('should be connected', async () => {
    expect(server).toBeDefined();
    expect((wsClient as any).wsClient?.readyState).toBe(WebSocket.OPEN);
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  }, 10000);

  test('should react to ping pong error', async () => {
    expect(server).toBeDefined();
    sendPong = false;
    (wsClient as any).startPingPong(500);
    (wsClient as any).wsClient.removeAllListeners('pong');
    expect((wsClient as any).pingInterval).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Start PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    // prettier-ignore
    await waiter('WsClient pong timeout', () => { return (wsClient as any).pongTimeout; }, true);
    expect((wsClient as any).pongTimeout).toBeDefined();
    await wait(500);
    expect(consoleDebugSpy).toHaveBeenCalledWith('Ping received');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Pong not received from device ${hk}Jest${wr} host ${zb}localhost${wr}, closing connection.`);
    sendPong = true;
  }, 10000);

  test('should close the connection', async () => {
    expect(server).toBeDefined();
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);

  test('should connect to the server without auth', async () => {
    expect(server).toBeDefined();
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          expect(msg.method).toBe('Shelly.GetStatus');
          ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, result: { state: true } }));
          ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyStatus', params: { state: true } }));
          ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyFullStatus', params: { state: true } }));
          ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyEvent', params: { events: [{ state: true }] } }));
          ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, error: true }));
          ws.send(JSON.stringify({ src: 'Jest' }));
          ws.send('This is not a JSON message');
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.on('response', (response) => {
      //
    });
    wsClient.on('update', (params) => {
      //
    });
    wsClient.on('event', (events) => {
      //
    });
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);

  test('should not connect to the server with auth if no password is provided', async () => {
    expect(server).toBeDefined();

    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          expect(msg.method).toBe('Shelly.GetStatus');

          // Ask for auth
          ws.send(
            JSON.stringify({
              src: 'Jest',
              dst: 'Matterbridge' + msg.id,
              id: msg.id,
              error: {
                code: 401,
                message: JSON.stringify({
                  auth_type: 'digest',
                  nonce: 123456,
                  nc: 123,
                  realm: 'device_id shelly1minig3-543204547478',
                  algorithm: 'SHA-256',
                }),
              },
            }),
          );
        });
        ws.on('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true, 5000, 100);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    await wait(100);
    expect((wsClient as any).auth).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Authentication required for Jest but the password is not set. Exiting...`);

    // Stop the WebSocket client
    (wsClient as any).wsDeviceId = 'Jest';
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true, 5000, 100);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true, 5000, 100);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);

  test('should connect to the server with auth', async () => {
    expect(server).toBeDefined();

    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          expect(msg.method).toBe('Shelly.GetStatus');

          // Ask for auth
          ws.send(
            JSON.stringify({
              src: 'Jest',
              dst: 'Matterbridge' + msg.id,
              id: msg.id,
              error: {
                code: 401,
                message: JSON.stringify({
                  auth_type: 'digest',
                  nonce: 123456,
                  nc: 123,
                  realm: 'device_id shelly1minig3-543204547478',
                  algorithm: 'SHA-256',
                }),
              },
            }),
          );
        });
        ws.on('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          if (
            msg.method === 'Shelly.GetStatus' &&
            msg.auth?.realm === 'device_id shelly1minig3-543204547478' &&
            msg.auth.username === 'admin' &&
            msg.auth.nonce === 123456 &&
            msg.auth.algorithm === 'SHA-256'
          ) {
            ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, result: { state: true } }));
            ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyStatus', params: { state: true } }));
            ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyFullStatus', params: { state: true } }));
            ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, method: 'NotifyEvent', params: { events: [{ state: true }] } }));
            ws.send(JSON.stringify({ src: 'Jest', dst: 'Matterbridge' + msg.id, id: msg.id, error: true }));
            ws.send(JSON.stringify({ src: 'Jest' }));
            ws.send('This is not a JSON message');

            (wsClient as any).wsDeviceId = 'shellywalldisplay';
            ws.send(JSON.stringify({ src: 'Jest', dst: 'user_1', id: msg.id, method: 'NotifyStatus', params: { state: true } }));
            ws.send(JSON.stringify({ src: 'Jest', dst: 'user_1', id: msg.id, method: 'NotifyEvent', params: { events: [] } }));

            resolve(ws);
          }
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost', 8080, 'password');
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true, 5000, 100);
    expect((wsClient as any).auth).toBeTruthy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    await wait(100);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, `Authentication required for Jest but the password is not set. Exiting...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Sending auth request to Shelly device ${hk}Jest${db} host ${zb}localhost${db}`, expect.anything());

    wsClient.sendRequest('Shelly.GetStatus');

    // Stop the WebSocket client
    (wsClient as any).wsDeviceId = 'Jest';
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true, 5000, 100);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true, 5000, 100);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);

  test('should log connecting state when starting while already connecting', () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.start();
    expect(wsClient.isConnecting).toBeTruthy();

    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`WebSocket client is already connecting to device`));

    wsClient.stop();
  });

  test('should skip sending the request if the socket is not open when the open event fires', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    const opened = new Promise<void>((resolve) => {
      wsClient.once('open', () => resolve());
    });
    wsClient.start();

    const realSocket = (wsClient as any).wsClient;
    Object.defineProperty(realSocket, 'readyState', { value: WebSocket.CONNECTING, configurable: true });
    await opened;
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Sending request to Shelly device'));

    delete realSocket.readyState;
    wsClient.stop();
  }, 10000);

  test('should stringify a non-Error value received from the error event', () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.once('error', () => {});
    wsClient.start();

    (wsClient as any).wsClient?.emit('error', 'plain string error');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('plain string error'));

    wsClient.stop();
  });

  test('should not close or terminate the socket if its state changes before the stop timeout fires', async () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.start();

    const realSocket = (wsClient as any).wsClient;
    Object.defineProperty(realSocket, 'readyState', { value: WebSocket.CONNECTING, configurable: true });
    const closeSpy = vi.spyOn(realSocket, 'close');
    const terminateSpy = vi.spyOn(realSocket, 'terminate');

    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Terminated ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);

    // The socket is neither open nor connecting/closing anymore once the deferred timeout fires
    Object.defineProperty(realSocket, 'readyState', { value: WebSocket.CLOSED, configurable: true });
    await wait(1100);
    expect(closeSpy).not.toHaveBeenCalled();
    expect(terminateSpy).not.toHaveBeenCalled();

    // Since the fake ready state skipped the real close()/terminate() calls, clean up the real socket manually.
    delete realSocket.readyState;
    realSocket.on('error', () => {});
    realSocket.terminate();
  }, 10000);

  test('should complete stop cleanly when the socket reports an unknown ready state', () => {
    expect(server).toBeDefined();
    wsClient = new WsClient('Jest', 'localhost', 8080);
    wsClient.start();

    const realSocket = (wsClient as any).wsClient;
    Object.defineProperty(realSocket, 'readyState', { value: -1, configurable: true });

    expect(() => wsClient.stop()).not.toThrow();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();

    // None of the stop() branches matched the fake ready state, so the real socket was never actually
    // closed or terminated: clean it up manually to avoid a dangling connection once the test server closes.
    delete realSocket.readyState;
    realSocket.on('error', () => {});
    realSocket.terminate();
  });
});
