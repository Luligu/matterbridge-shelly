/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { wait, waiter } from 'matterbridge/utils';
import { WsClient } from './wsClient';
import { WebSocket, WebSocketServer } from 'ws';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';

describe('ShellyWsClient with server', () => {
  let wsClient: WsClient;
  let server: WebSocketServer;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    // Create a WebSocket server and await its listening state
    await new Promise<void>((resolve) => {
      server = new WebSocketServer({ port: 80 }, () => {
        const port = (server.address() as { port: number }).port;
        // console.log('Jest ws server is up and listening on port:', port);
        resolve();
      });
    });

    server.on('connection', (ws) => {
      // console.error(`New client connected: ${ws.url}`);

      ws.on('close', () => {
        // console.error('Client disconnected');
      });
      ws.on('error', (error) => {
        // console.error(`Error: ${error}`);
      });
      ws.on('message', (message) => {
        // console.error(`Received message: ${message}`);
      });
      ws.on('ping', () => {
        // console.error('Ping received');
        ws.pong();
      });
      ws.on('open', () => {
        // console.error('Connection open');
      });

      // ws.send('Hello Client');
    });

    server.on('error', (error) => {
      // console.error(`Server error: ${error}`);
    });

    server.on('close', () => {
      // console.error('Server closed');
    });
  }, 360000);

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

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
  }, 360000);

  test('Create the wsClient', () => {
    wsClient = new WsClient('Jest', 'localhost');
    wsClient.setHost('localhost');
    expect((wsClient as any).wsHost).toBe('localhost');
    expect((wsClient as any).wsUrl).toBe(`ws://localhost/rpc`);
    expect(wsClient).not.toBeUndefined();
    expect(wsClient).toBeInstanceOf(WsClient);
    wsClient.sendRequest('Shelly.GetStatus');
    wsClient.stop();
  });

  test('should connect to the server and start ping pong', async () => {
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        // console.log('Server received connection');

        // Listen for messages from the client
        ws.once('message', async (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          // console.log('Server received a message:\n', msg);
          resolve(ws);
        });
      });
    });

    // Create a WebSocket client and connect to the server and await its connection
    wsClient = new WsClient('Jest', 'localhost');
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(wsClient.isConnecting).toBeTruthy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient isConnected timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();
    (wsClient as any).stopPingPong();
    (wsClient as any).startPingPong(500);
    // prettier-ignore
    await waiter('WsClient pong timeout', () => { return (wsClient as any).pongTimeout; }, true);
    await wait(1000);
    (wsClient as any).stopPingPong();
    (wsClient as any).wsClient?.emit('error', new Error('Test error'));
    (wsClient as any).wsClient?.emit('close');
    wsClient.stop();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
    // prettier-ignore
    await waiter('WsClient close isConnecting timeout', () => { return !wsClient.isConnecting; }, true);
    // prettier-ignore
    await waiter('WsClient close isConnected timeout', () => { return !wsClient.isConnected; }, true);
  }, 60000);

  test('should connect to the server without auth', async () => {
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        // console.log('Server received connection');

        // Listen for messages from the client
        ws.once('message', async (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          // console.log('Server received a message:\n', msg);
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
    expect(wsClient.isConnecting).toBeTruthy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();
    wsClient.sendRequest('Shelly.GetStatus');
    wsClient.stop();
    // prettier-ignore
    await waiter('WsClient close timeout', () => { return !wsClient.isConnected; }, true);
  }, 60000);

  test('should connect to the server with auth', async () => {
    // Await connection to the server
    const connectPromise = new Promise<WebSocket>((resolve) => {
      server.once('connection', (ws: WebSocket) => {
        // The server has received a connection
        // console.log('Server received connection');

        // Listen for messages from the client
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          // console.log('Server received message:\n', msg);

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
        ws.once('message', (message) => {
          // The server has received a message
          const msg = JSON.parse(message.toString());
          // console.log('Server received auth message:\n', msg);
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
    wsClient = new WsClient('Jest', 'localhost', 'password');
    wsClient.log.logLevel = LogLevel.DEBUG;
    wsClient.start();
    expect(wsClient.isConnecting).toBeTruthy();
    const ws = await connectPromise;
    // prettier-ignore
    await waiter('WsClient connection timeout', () => { return wsClient.isConnected; }, true);
    expect((wsClient as any).auth).toBeTruthy();
    expect(wsClient.isConnected).toBeTruthy();
    wsClient.sendRequest('Shelly.GetStatus');
    wsClient.stop();
    // prettier-ignore
    await waiter('WsClient close timeout', () => { return !wsClient.isConnected; }, true);
  }, 60000);
});
