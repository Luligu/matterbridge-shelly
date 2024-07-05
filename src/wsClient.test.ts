/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';
import { waiter } from 'matterbridge';
import { WsClient } from './wsClient';

jest.mock('ws');

describe('WS client', () => {
  let wsClient: WsClient;

  beforeAll(() => {
    wsClient = new WsClient('192.168.58.96');
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    wsClient?.stop();
  });

  test('Create the wsClient', () => {
    expect(wsClient).not.toBeUndefined();
  });

  test('Not starting to be connected', () => {
    expect(wsClient.isConnected).toBeFalsy();
    expect(wsClient.isConnecting).toBeFalsy();
  });

  test('Start listening', () => {
    wsClient?.start(true);

    expect((wsClient as any).wsClient).toBeDefined();
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit open', () => {
    (wsClient as any).wsClient?.emit('open');
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeTruthy();
    (wsClient as any)._isConnecting = true;
    (wsClient as any)._isConnected = false;
  });

  test('emit error', () => {
    (wsClient as any).wsClient?.emit('error', new Error('Test error'));
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('emit close', () => {
    (wsClient as any).wsClient?.emit('close', new Error('Test error'));
    expect(wsClient.isConnecting).toBeTruthy();
    expect(wsClient.isConnected).toBeFalsy();
  });

  test('Stop listening', async () => {
    wsClient?.stop(true);
    await waiter(
      'Waiting for close',
      () => {
        return (wsClient as any).wsClient?.isConnected;
      },
      false,
      70000,
    );

    expect((wsClient as any).wsClient).toBeDefined();
    expect(wsClient.isConnecting).toBeFalsy();
    expect(wsClient.isConnected).toBeFalsy();
  }, 90000);
});
