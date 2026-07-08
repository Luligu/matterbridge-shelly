/**
 * @file vitest/wsServer.test.ts
 * @description This file contains the tests for the WsServer class.
 * @author Luca Liguori
 */

const NAME = 'WsServer';

import EventEmitter from 'node:events';

import { LogLevel } from 'matterbridge/logger';
import { wait, waiter } from 'matterbridge/utils';
import { flushAsync, loggerLogSpy, setupTest } from 'matterbridge/vitest-utils';
import { WebSocket } from 'ws';

import type { ShellyData } from '../src/shellyTypes.js';
import { WsServer } from '../src/wsServer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('ShellyWsServer', () => {
  let wsServer: WsServer;

  beforeAll(async () => {});

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    // Stop the WebSocket client
    wsServer.stop();
    // prettier-ignore
    await waiter('wsServer not listening', () => { return !(wsServer as any)._isListening; }, true);

    // Wait a bit to ensure all async operations are done
    await flushAsync();

    // Restore all mocks
    vi.restoreAllMocks();
  }, 360000);

  test('Should emit events on start and stop', async () => {
    const wsServer = new WsServer(LogLevel.DEBUG);
    await new Promise<void>((resolve) => {
      wsServer.on('started', () => {
        resolve();
      });
      wsServer.start(5050);
    });
    expect(wsServer.isListening).toBeTruthy();

    await new Promise<void>((resolve) => {
      wsServer.on('stopped', () => {
        resolve();
      });
      wsServer.stop();
    });
    expect(wsServer.isListening).toBeFalsy();
  });

  test('Create the wsServer', () => {
    wsServer = new WsServer(LogLevel.DEBUG);
    expect(wsServer).not.toBeUndefined();
    expect(wsServer).toBeInstanceOf(WsServer);
    expect((wsServer as any).httpServer).toBeUndefined();
    expect((wsServer as any).wsServer).toBeUndefined();
    expect(wsServer.isListening).toBeFalsy();
  });

  test('Should receive wsupdate event', () => {
    let fired = false;
    wsServer.once('wssupdate', (shellyId: string, params: ShellyData) => {
      fired = true;
      // console.error(`Received wssupdate once from ${shellyId}:`, params);
    });
    wsServer.emit('wssupdate', 'shellyId', { temp: 25.0, hum: 50.0 });
    expect(fired).toBeTruthy();
  });

  test('Should receive wsevent event', () => {
    let fired = false;
    wsServer.once('wssevent', (shellyId: string, params: ShellyData) => {
      fired = true;
      // console.error(`Received wssupdate once from ${shellyId}:`, params);
    });
    wsServer.emit('wssevent', 'shellyId', { event: 'on' });
    expect(fired).toBeTruthy();
  });

  test('Start the wsServer', async () => {
    await new Promise<void>((resolve) => {
      wsServer.on('started', () => {
        resolve();
      });
      wsServer.start();
    });
    expect((wsServer as any).httpServer).toBeDefined();
    expect((wsServer as any).wsServer).toBeDefined();
    expect(wsServer.isListening).toBeTruthy();
  });

  test('Should fail to create the wsServer since the port is in use', async () => {
    const wsServer = new WsServer(LogLevel.DEBUG);
    await new Promise<void>((resolve) => {
      wsServer.on('error', (error) => {
        expect(error.message).toContain('EADDRINUSE');
        resolve();
      });
      wsServer.start();
    });
    expect((wsServer as any).httpServer).toBeDefined();
    expect((wsServer as any).wsServer).toBeDefined();
    expect(wsServer.isListening).toBeFalsy();
    (wsServer as any).wsServer.emit('error', new Error('Test error'));
    (wsServer as any).wsServer.emit('close');
    await new Promise<void>((resolve) => {
      wsServer.on('stopped', () => {
        resolve();
      });
      wsServer.stop();
    });
  });

  test('Stop the wsServer', async () => {
    await new Promise<void>((resolve) => {
      wsServer.on('stopped', () => {
        resolve();
      });
      wsServer.stop();
    });
    // prettier-ignore
    await waiter('wsServer closed', () => { return (wsServer as any).wsServer === undefined }, true, 5000, 100);
    // prettier-ignore
    await waiter('httpServer closed', () => { return (wsServer as any).httpServer === undefined }, true, 5000, 100);
    expect((wsServer as any).httpServer).toBeUndefined();
    expect((wsServer as any).wsServer).toBeUndefined();
    expect(wsServer.isListening).toBeFalsy();
  });

  test('Client should connect to the wsServer', async () => {
    // setDebug(true);
    (wsServer as any).pingPeriod = 500;
    (wsServer as any).pongPeriod = 600;
    wsServer.start(8989);
    // prettier-ignore
    await waiter('wsServer listening', () => { return wsServer.isListening; }, true);
    expect((wsServer as any).httpServer).toBeDefined();
    expect((wsServer as any).wsServer).toBeDefined();
    expect(wsServer.isListening).toBeTruthy();

    wsServer.start(8989);

    return new Promise<void>((resolve, reject) => {
      const client = new WebSocket('ws://localhost:8989');
      let pongCount = 0;

      // oxlint-disable-next-line typescript/no-misused-promises -- errors are caught and routed to reject() below
      client.on('open', async () => {
        try {
          expect(client.readyState).toBe(WebSocket.OPEN);
          client.send(JSON.stringify({ src: 'shellyhtg3-3030F9EC8468', dst: 'ws', method: 'NotifyStatus', params: { state: true } }));
          client.send(JSON.stringify({ src: 'shellyhtg3-3030F9EC8468', dst: 'ws', method: 'NotifyFullStatus', params: { state: true } }));
          client.send(JSON.stringify({ src: 'shellyhtg3-3030F9EC8468', dst: 'ws', method: 'NotifyEvent', params: { state: true } }));
          client.send(JSON.stringify({ src: 'shellyhtg3-3030F9EC8468', dst: 'ws' }));
          client.send('This is not a JSON message');
          client.ping();
          await wait(3000);
          client.close();
          wsServer.stop();
          await wait(1000);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      client.on('close', () => {
        // console.log('Connection closed');
      });

      client.on('ping', (error) => {
        // console.log('Ping received');
        if (pongCount++ < 3) {
          // console.log('Sending pong');
          client.pong();
        }
      });

      client.on('error', (error) => {
        reject(error);
      });
    });
  }, 10000);

  test('Should skip ping and log a non-empty close reason when the client is not open', async () => {
    const localWsServer = new WsServer(LogLevel.DEBUG);
    (localWsServer as any).pingPeriod = 1000;
    await new Promise<void>((resolve) => {
      localWsServer.on('started', () => resolve());
      localWsServer.start(8990);
    });

    vi.useFakeTimers();
    const fakeWs = Object.assign(new EventEmitter(), {
      readyState: WebSocket.CLOSED,
      ping: vi.fn(),
      pong: vi.fn(),
    });
    const fakeReq = { socket: { remoteAddress: '127.0.0.1' } } as any;
    (localWsServer as any).wsServer.emit('connection', fakeWs, fakeReq);

    // The ping interval should skip pinging since the client is not open
    fakeWs.ping.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakeWs.ping).not.toHaveBeenCalled();
    vi.useRealTimers();

    // Close with a non-empty reason
    fakeWs.emit('close', 1000, Buffer.from('Test close reason', 'utf-8'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('reason Test close reason'));

    await new Promise<void>((resolve) => {
      localWsServer.on('stopped', () => resolve());
      localWsServer.stop();
    });
  });

  test('Should log an error when a pong is not received in time', async () => {
    const localWsServer = new WsServer(LogLevel.DEBUG);
    (localWsServer as any).pingPeriod = 1000;
    (localWsServer as any).pongPeriod = 1000;
    await new Promise<void>((resolve) => {
      localWsServer.on('started', () => resolve());
      localWsServer.start(8993);
    });

    vi.useFakeTimers();
    const fakeWs = Object.assign(new EventEmitter(), {
      readyState: WebSocket.OPEN,
      ping: vi.fn(),
      pong: vi.fn(),
    });
    const fakeReq = { socket: { remoteAddress: '127.0.0.1' } } as any;
    (localWsServer as any).wsServer.emit('connection', fakeWs, fakeReq);

    // The ping interval fires and schedules a pong timeout
    await vi.advanceTimersByTimeAsync(1000);
    expect(fakeWs.ping).toHaveBeenCalled();
    // The pong timeout elapses without a pong response
    await vi.advanceTimersByTimeAsync(1000);
    vi.useRealTimers();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('WebSocketServer pong not received.'));

    await new Promise<void>((resolve) => {
      localWsServer.on('stopped', () => resolve());
      localWsServer.stop();
    });
  });

  test('Should log an error when the client socket emits an error', async () => {
    const localWsServer = new WsServer(LogLevel.DEBUG);
    await new Promise<void>((resolve) => {
      localWsServer.on('started', () => resolve());
      localWsServer.start(8994);
    });

    const fakeWs = Object.assign(new EventEmitter(), {
      readyState: WebSocket.OPEN,
      ping: vi.fn(),
      pong: vi.fn(),
    });
    const fakeReq = { socket: { remoteAddress: '127.0.0.1' } } as any;
    (localWsServer as any).wsServer.emit('connection', fakeWs, fakeReq);

    fakeWs.emit('error', new Error('Test client error'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('WebSocketServer client error: Test client error'));

    await new Promise<void>((resolve) => {
      localWsServer.on('stopped', () => resolve());
      localWsServer.stop();
    });
  });

  test('Should handle a non-Error httpServer error', async () => {
    const localWsServer = new WsServer(LogLevel.DEBUG);
    localWsServer.on('error', () => {
      // Prevent unhandled 'error' event exception
    });
    await new Promise<void>((resolve) => {
      localWsServer.on('started', () => resolve());
      localWsServer.start(8991);
    });

    (localWsServer as any).httpServer.emit('error', 'A plain string error');
    expect(localWsServer.isListening).toBeFalsy();

    await new Promise<void>((resolve) => {
      localWsServer.on('stopped', () => resolve());
      localWsServer.stop();
    });
  });

  test('Should log an error when closing the wsServer fails', async () => {
    const localWsServer = new WsServer(LogLevel.DEBUG);
    await new Promise<void>((resolve) => {
      localWsServer.on('started', () => resolve());
      localWsServer.start(8992);
    });

    const closeSpy = vi.spyOn((localWsServer as any).wsServer, 'close').mockImplementationOnce((cb: any) => {
      cb(new Error('Test close error'));
    });

    await new Promise<void>((resolve) => {
      localWsServer.on('stopped', () => resolve());
      localWsServer.stop();
    });
    expect(closeSpy).toHaveBeenCalled();
  });
});
