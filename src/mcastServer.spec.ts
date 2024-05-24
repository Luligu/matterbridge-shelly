import { Multicast } from './mcastServer';

describe('Muticast server and client test', () => {
  let mcast: Multicast | undefined = undefined;

  beforeAll(() => {
    mcast = new Multicast();
  });

  beforeEach(() => {
    // (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    // jest.clearAllMocks();
  });

  afterAll(() => {
    mcast?.stop();
  });

  test('Create the mcast', () => {
    expect(mcast).not.toBeUndefined();
  });

  // eslint-disable-next-line jest/no-done-callback
  test('Use dgram server', (done) => {
    function callback() {
      try {
        expect(mcast?.dgramServerBound).toBeTruthy();
        done();
      } catch (error) {
        done(error);
      }
    }
    mcast?.startDgramServer(callback);
  }, 60000);

  // eslint-disable-next-line jest/no-done-callback
  test('Use dgram client', (done) => {
    function callback() {
      try {
        expect(mcast?.dgramClientBound).toBeTruthy();
        done();
      } catch (error) {
        done(error);
      }
    }
    mcast?.startDgramClient(callback);
  }, 60000);

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  describe('Testing scanner', () => {
    // eslint-disable-next-line jest/no-done-callback
    test('Start scanner', (done) => {
      function callback(message: CoapMessage) {
        try {
          expect(message.validFor).toBeGreaterThan(0);
          done();
        } catch (error) {
          done(error);
        }
      }
      coapServer?.start(callback, true);
      // expect(coapServer?.isScanning).toBeTruthy();
    }, 60000);
  });
  */
});
