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
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
    //
  });

  test('Create the Multicast class', () => {
    mcast = new Multicast();
    expect(mcast).not.toBeUndefined();
  });

  // eslint-disable-next-line jest/no-done-callback
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

  // eslint-disable-next-line jest/no-done-callback
  test('Use dgram client', (done) => {
    function boundCallback() {
      try {
        expect(mcast?.dgramClientBound).toBeTruthy();
        done();
      } catch (error) {
        done(error);
      }
    }
    mcast?.startDgramClient(boundCallback);
  }, 60000);

  test('Stop the Multicast class', async () => {
    mcast?.stop();
    await wait(1000);
    expect(mcast?.dgramServerBound).toBe(false);
    expect(mcast?.dgramClientBound).toBe(false);
  });
});
