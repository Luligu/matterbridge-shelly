/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { getMacAddress, wait, waiter } from 'matterbridge/utils';
import { WsServer } from './wsServer';
import { WebSocket, WebSocketServer } from 'ws';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { ShellyData } from './shellyTypes';

describe('ShellyWsServer', () => {
  let wsServer: WsServer;
  const address = '30:f6:ef:69:2b:c5';

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });

    wsServer = new WsServer(LogLevel.DEBUG);

    wsServer.on('wssupdate', (shellyId: string, params: ShellyData) => {
      // console.error(`Received wssupdate from ${shellyId}:`, params);
    });

    wsServer.on('wssevent', (shellyId: string, params: ShellyData) => {
      // console.error(`Received wssevent from ${shellyId}:`, params);
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
    wsServer.stop();
    // prettier-ignore
    await waiter('wsServer not listening', () => { return !(wsServer as any)._isListening; }, true);
  }, 360000);

  test('Create the wsServer', () => {
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
    wsServer.start();
    // prettier-ignore
    await waiter('wsServer listening', () => { return wsServer.isListening; }, true);
    expect((wsServer as any).httpServer).toBeDefined();
    expect((wsServer as any).wsServer).toBeDefined();
    expect(wsServer.isListening).toBeTruthy();
  });

  test('Should fail to crete the wsServer', async () => {
    const wsServer = new WsServer(LogLevel.DEBUG);
    wsServer.start();
    // prettier-ignore
    await wait(1000);
    expect((wsServer as any).httpServer).toBeDefined();
    expect((wsServer as any).wsServer).toBeDefined();
    expect(wsServer.isListening).toBeFalsy();
    (wsServer as any).wsServer.emit('error', new Error('Test error'));
    (wsServer as any).wsServer.emit('close');
    wsServer.stop();
    await wait(1000);
  });

  test('Stop the wsServer', async () => {
    wsServer.stop();
    // prettier-ignore
    await waiter('wsServer not listening', () => { return !wsServer.isListening; }, true);
    expect((wsServer as any).httpServer).toBeUndefined();
    expect((wsServer as any).wsServer).toBeUndefined();
    expect(wsServer.isListening).toBeFalsy();
  });

  test('Client should connect to the wsServer', async () => {
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
  });
});
