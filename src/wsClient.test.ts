/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { jest } from '@jest/globals';
import { waiter } from 'matterbridge/utils/utils';
import { WsClient } from './wsClient';
import WebSocket from 'ws';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';

jest.useFakeTimers();

describe('WS client', () => {
  let wsClient: WsClient;

  beforeAll(() => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(WebSocket.prototype, 'ping').mockImplementation(() => {
      // console.log(`Mocked ping`);
    });
    jest.spyOn(WebSocket.prototype, 'send').mockImplementation(() => {
      // console.log(`Mocked send`);
    });
    wsClient = new WsClient('192.168.58.96');
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    // wsClient.stop();
    // Restore the mocked AnsiLogger.log method
    // (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  });

  test('Create the wsClient', () => {
    expect(wsClient).not.toBeUndefined();
  });

  test('Not starting to be connected', () => {
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
  });

  test('Simulate connection timeout', async () => {
    wsClient?.start(true);
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();

    // Fast-forward until all timers have been executed
    jest.runAllTimers();

    // Check the state after the timeout
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();

    jest.useRealTimers();

    // console.log('Waiting for connection timeout', wsClient.isConnecting, wsClient.isConnected);
    await waiter(
      'WsClient connection timeout',
      () => {
        return !wsClient.isConnecting;
      },
      false,
      300000,
      500,
      true,
    );
    // console.log('Waiting for connection timeout done', wsClient.isConnecting, wsClient.isConnected);
    expect(wsClient.isConnecting).toBeFalsy();

    // console.log('Waiting for connection timeout', wsClient.isConnecting, wsClient.isConnected);
    await waiter(
      'WsClient connection timeout',
      () => {
        return !wsClient.isConnected;
      },
      false,
      300000,
      500,
      true,
    );
    // console.log('Waiting for connection timeout done', wsClient.isConnecting, wsClient.isConnected);
    expect(wsClient.isConnected).toBeFalsy();
  }, 300000);

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('Start listening', () => {
    wsClient?.start(true);

    expect((wsClient as any).wsClient).toBeDefined();
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
  });
  */

  test('sendRequest', () => {
    wsClient.sendRequest('Shelly.GetNone');
    expect((wsClient as any).requestFrame.method).toBe('Shelly.GetStatus');
    (wsClient as any)._isConnected = true;
    wsClient.sendRequest('Shelly.GetNone');
    expect((wsClient as any).requestFrame.method).toBe('Shelly.GetNone');
    (wsClient as any)._isConnected = false;
  });

  test('startPingPong', async () => {
    (wsClient as any).startPingPong(100);
    expect((wsClient as any).pingInterval).toBeDefined();
    await waiter(
      'WsClient connection timeout',
      () => {
        return false;
      },
      false,
      1000,
      500,
      false,
    );
    (wsClient as any).stopPingPong();
    // console.log('PingPong readyState:', (wsClient as any).wsClient.readyState);
    (wsClient as any).wsClient._readyState = WebSocket.OPEN;
    (wsClient as any).startPingPong(100);
    await waiter(
      'WsClient connection timeout',
      () => {
        return false;
      },
      false,
      1000,
      500,
      false,
    );
    (wsClient as any)._isConnected = false;
    (wsClient as any).wsClient._readyState = WebSocket.CLOSED;
    (wsClient as any).stopPingPong();
    (wsClient as any).stopPingPong();
    (wsClient as any).stopPingPong();
  }, 60000);

  test('stopPingPong', () => {
    (wsClient as any).stopPingPong();
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  });

  test('emit open', () => {
    (wsClient as any).wsClient?.emit('open');
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();
    (wsClient as any)._isConnecting = true;
    (wsClient as any)._isConnected = false;
    expect((wsClient as any).pingInterval).toBeDefined();
    (wsClient as any).wsClient?.emit('pong');
    (wsClient as any).pongTimeout = setTimeout(() => {
      //
    });
    (wsClient as any).stopPingPong();
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
  });

  test('emit error', () => {
    (wsClient as any).wsClient?.emit('error', new Error('Test error'));
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message auth with no password', () => {
    const message = { error: { code: 401 }, dst: 'Matterbridge', result: { state: true }, id: (wsClient as any).requestId };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).password = undefined;
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message auth with password', () => {
    const message = {
      error: { code: 401, message: '{"message":"emit message auth with password"}' },
      dst: 'Matterbridge',
      result: { state: true },
      id: (wsClient as any).requestId,
    };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).password = 'password';
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message result', () => {
    const message = { dst: 'Matterbridge', result: { state: true }, id: (wsClient as any).requestId };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message NotifyStatus', () => {
    const message = { src: 'device', dst: 'Matterbridge', method: 'NotifyStatus', result: { state: true }, error: undefined };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message NotifyFullStatus', () => {
    const message = { src: 'device', dst: 'Matterbridge', method: 'NotifyFullStatus', result: { state: true }, error: undefined };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message NotifyEvent', () => {
    const message = { src: 'device', dst: 'Matterbridge', method: 'NotifyEvent', params: { events: { state: true } }, error: undefined };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message unknown', () => {
    const message = { nodata: 'nodata' };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit message error', () => {
    const message = { error: { code: 3232 }, id: (wsClient as any).requestId, dst: 'Matterbridge' };
    const buffer = Buffer.from(JSON.stringify(message));
    (wsClient as any).wsClient?.emit('message', buffer);
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit close', () => {
    (wsClient as any).wsClient?.emit('close', new Error('Test error'));
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('Stop listening', async () => {
    wsClient.stop(true);
    expect((wsClient as any).wsClient).toBeDefined();
    expect((wsClient as any).pingInterval).toBeUndefined();
    expect((wsClient as any).pongTimeout).toBeUndefined();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();

    (wsClient as any)._isConnecting = true;
    jest.useFakeTimers();
    wsClient.stop(true);
    jest.runAllTimers();
    jest.useRealTimers();
  }, 60000);
});
