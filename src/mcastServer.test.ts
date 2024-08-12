/* eslint-disable jest/no-done-callback */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Multicast } from './mcastServer';
import { jest } from '@jest/globals';
import dgram from 'dgram';
import { wait } from 'matterbridge/utils';

describe('Muticast server and client test', () => {
  let mcast: Multicast | undefined = undefined;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeAll(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((message?: any, ...optionalParams: any[]) => {
      // console.error(`Mocked console.log: ${message}`, optionalParams);
    });
    // consoleLogSpy.mockRestore();
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  test('Create the Multicast class', () => {
    mcast = new Multicast();
    expect(mcast).not.toBeUndefined();
  });

  test('Use dgram server', (done) => {
    function boundCallback() {
      try {
        expect(mcast?.dgramServerBound).toBeTruthy();
        done();
      } catch (error) {
        done(error);
      }
    }
    function messageCallback(msg: Buffer, rinfo: dgram.RemoteInfo) {
      try {
        expect(mcast?.dgramServerBound).toBeTruthy();
        done();
      } catch (error) {
        done(error);
      }
    }
    mcast?.startDgramServer(boundCallback, messageCallback);
  }, 60000);

  test('Use dgram client', (done) => {
    async function boundCallback() {
      try {
        expect(mcast?.dgramClientBound).toBeTruthy();
        await wait(2000);
        done();
      } catch (error) {
        done(error);
      }
    }
    mcast?.startDgramClient(boundCallback);
  }, 60000);

  test('Server connect event', async () => {
    consoleLogSpy.mockClear();
    (mcast as any)?.dgramServer?.emit('connect');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Dgram multicast server socket connected'));
  });

  test('Server error event', async () => {
    consoleLogSpy.mockClear();
    (mcast as any)?.dgramServer?.emit('error', new Error('Test error'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Dgram multicast server socket error'));
  });

  test('Client connect event', async () => {
    consoleLogSpy.mockClear();
    (mcast as any)?.dgramClient?.emit('connect');
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Dgram multicast client socket connected'));
  });

  test('Client error event', async () => {
    consoleLogSpy.mockClear();
    (mcast as any)?.dgramClient?.emit('error', new Error('Test error'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringContaining('Dgram multicast client socket error'));
  });

  test('Stop the Multicast class', async () => {
    mcast?.stop();
    await wait(1000);
    expect(mcast?.dgramServerBound).toBe(false);
    expect(mcast?.dgramClientBound).toBe(false);
  });
});
