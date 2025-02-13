/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';

import { WebSocket, WebSocketServer } from 'ws';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { WsClient } from './wsClient';
import { AnsiLogger, db, er, hk, LogLevel, nf, zb } from 'matterbridge/logger';

describe('ShellyWsClient', () => {
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;

  let wsClient: WsClient;
  let server: WebSocketServer;

  let sendPong = true;

  const address = 'c4:cb:76:b3:cd:1f';

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

  beforeAll(async () => {
    if (getMacAddress() !== address) return; // Only run these tests on the correct machine

    // Create a WebSocket server and await its listening state
    await new Promise<void>((resolve) => {
      server = new WebSocketServer({ port: 80 }, () => {
        const address = server.address() as { address: string; family: string; port: number };
        console.log('Jest ws server is up and listening on port:', address.port, 'address:', address.address, 'family:', address.family);
        resolve();
      });
    });

    server.on('connection', (ws) => {
      console.info(`New client connected: ${ws.url}`);

      ws.on('close', () => {
        console.info('Client disconnected');
      });
      ws.on('error', (error) => {
        console.error(`Error: ${error}`);
      });
      ws.on('message', (message) => {
        console.debug(`Received message: ${message}`);
      });
      ws.on('ping', () => {
        console.debug('Ping received');
        if (sendPong) {
          console.debug('Sending pong');
          ws.pong();
        }
      });
      ws.on('open', () => {
        console.debug('Connection open');
      });
    });

    server.on('error', (error) => {
      console.error(`Server error: ${error}`);
    });

    server.on('close', () => {
      console.info('Server closed');
    });
  }, 360000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(async () => {
    if (getMacAddress() !== address) return;

    console.log('Closing Jest test ws server');

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

    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('should fail with wrong address', async () => {
    if (!server) return;
    wsClient = new WsClient('Jest', 'xxxxxx');
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WsClient);
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();

    // Await connection to the server
    const connectPromise = new Promise<WebSocket | undefined>((resolve) => {
      wsClient.start();
      server.once('connection', (ws: WebSocket) => {
        console.info('Server received connection');
        resolve(ws);
      });
      const interval = setInterval(() => {
        console.info('Waiting for server to receive connection');
        if (wsClient.isConnecting === false && wsClient.isConnected === false) {
          console.info('Server did not receive connection');
          clearInterval(interval);
          resolve(undefined);
        }
      }, 1000);
    });
    await connectPromise;

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}xxxxxx${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}xxxxxx${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`WebSocket error with Shelly device ${hk}Jest${er} host ${zb}xxxxxx${er}`));
    wsClient.stop();
  }, 10000);

  test('should terminate before connected', async () => {
    if (!server) return;
    wsClient = new WsClient('Jest', 'localhost');
    wsClient.start();
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Terminated ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 2000);
    });
  }, 10000);

  test('create the wsClient', () => {
    if (!server) return;
    wsClient = new WsClient('Jest', 'localhost');
    expect(wsClient).toBeDefined();
    expect(wsClient).toBeInstanceOf(WsClient);

    wsClient.setHost('localhost');
    expect((wsClient as any).wsHost).toBe('localhost');
    expect((wsClient as any).wsUrl).toBe(`ws://localhost/rpc`);

    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
  });

  test('should log error if not connected', () => {
    if (!server) return;
    wsClient.sendRequest('Shelly.GetStatus');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `SendRequest error: WebSocket client is not connected to device ${hk}Jest${er} host ${zb}localhost${er}`);
  });

  test('should connect to the server', async () => {
    if (!server) return;
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        console.info('Server received connection');

        // Listen for messages from the client
        ws.once('message', async (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          console.info('Server received a message:\n', msg);
          expect(msg).toBeDefined();
          expect(msg.method).toBe('Shelly.GetStatus');
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost');
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
    if (!server) return;
    (wsClient as any).startPingPong(500);
    expect((wsClient as any).pingInterval).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Start PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    // prettier-ignore
    await waiter('WsClient pong timeout', () => { return (wsClient as any).pongTimeout; }, true);
    expect((wsClient as any).pongTimeout).toBeDefined();
    await wait(1000);
    expect(consoleDebugSpy).toHaveBeenCalledWith('Ping received');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Pong received from device ${hk}Jest${db} host ${zb}localhost${db}, connection is alive.`);

    (wsClient as any).stopPingPong();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stop PingPong with device ${hk}Jest${db} host ${zb}localhost${db}.`);
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  }, 10000);

  test('should respond to error event', async () => {
    if (!server) return;
    (wsClient as any).wsClient?.emit('error', new Error('Test error'));
    expect(wsClient.isConnecting).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`WebSocket error with Shelly device ${hk}Jest${er} host ${zb}localhost${er}`));
  }, 10000);

  test('should respond to close event', async () => {
    if (!server) return;
    (wsClient as any).wsClient?.emit('close');
    expect(wsClient.isConnected).toBeFalsy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `WebSocket connection closed with Shelly device ${hk}Jest${nf} host ${zb}localhost${nf}`);
    (wsClient as any)._isConnected = true;
  }, 10000);

  test('should be connected', async () => {
    if (!server) return;
    expect((wsClient as any).wsClient?.readyState).toBe(WebSocket.OPEN);
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  }, 10000);

  test('should react to ping pong error', async () => {
    if (!server) return;
    console.log('PingPong error test');
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Pong not received from device ${hk}Jest${er} host ${zb}localhost${er}, closing connection.`);
    sendPong = true;
  }, 10000);

  test('should close the connection', async () => {
    if (!server) return;
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
    if (!server) return;
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        console.info('Server received connection');

        // Listen for messages from the client
        ws.once('message', async (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          console.info('Server received a message:\n', msg);
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
    wsClient = new WsClient('Jest', 'localhost');
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
    if (!server) return;
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        console.info('Server received connection');

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          console.info('Server received a message:\n', msg);
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
          console.info('Server received auth message:\n', msg);
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost');
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeTruthy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Authentication required for Jest but the password is not set. Exiting...`);

    // Send a request from the client to the server
    wsClient.sendRequest('Shelly.GetStatus');

    // Stop the WebSocket client
    (wsClient as any).wsDeviceId = 'Jest';
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);

  test('should connect to the server with auth', async () => {
    if (!server) return;
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        console.info('Server received connection');

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          expect(msg).toBeDefined();
          console.info('Server received a message:\n', msg);
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
          console.info('Server received auth message:\n', msg);
          if (
            msg.method === 'Shelly.GetStatus' &&
            msg.auth &&
            msg.auth.realm === 'device_id shelly1minig3-543204547478' &&
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
    wsClient = new WsClient('Jest', 'localhost', 'password');
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Started ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeTruthy();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();

    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, `Authentication required for Jest but the password is not set. Exiting...`);

    // Send a request from the client to the server
    wsClient.sendRequest('Shelly.GetStatus');

    // Stop the WebSocket client
    (wsClient as any).wsDeviceId = 'Jest';
    wsClient.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Stopping ws client for Shelly device ${hk}Jest${db} host ${zb}localhost${db}`));
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true);
    expect(wsClient.isConnecting).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true);
    expect(wsClient.isConnected).toBeFalsy();
  }, 10000);
});
