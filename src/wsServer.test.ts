// src/wsServer.test.ts

import { jest } from '@jest/globals';
import { wait, waiter } from 'matterbridge/utils';
import { WebSocket } from 'ws';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';

import { WsServer } from './wsServer.ts';
import { ShellyData } from './shellyTypes.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

describe('ShellyWsServer', () => {
  let wsServer: WsServer;

  beforeAll(async () => {
    //
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(async () => {
    // Stop the WebSocket client
    wsServer.stop();
    // prettier-ignore
    await waiter('wsServer not listening', () => { return !(wsServer as any)._isListening; }, true);

    // Restore all mocks
    jest.restoreAllMocks();
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
});
