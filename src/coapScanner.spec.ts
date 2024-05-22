import { CoapMessage, CoapServer } from './coapScanner';

describe('Coap scanner', () => {
  let coapServer: CoapServer | undefined = undefined;

  beforeAll(() => {
    coapServer = new CoapServer();
  });

  beforeEach(() => {
    // (fetch as jest.Mock).mockClear();
  });

  afterEach(() => {
    // jest.clearAllMocks();
  });

  afterAll(() => {
    coapServer?.stop();
  });

  test('Create the coapScanner', () => {
    expect(coapServer).not.toBeUndefined();
  });

  test('Not starting to scan', () => {
    expect(coapServer?.isScanning).toBeFalsy();
  });

  test('Getting device description', () => {
    coapServer?.getDeviceDescription('192.168.1.219');
    expect(coapServer?.isScanning).toBeFalsy();
  });

  test('Getting device status', () => {
    coapServer?.getDeviceStatus('192.168.1.219');
    expect(coapServer?.isScanning).toBeFalsy();
  });

  test('Getting multicast device status', () => {
    coapServer?.getMulticastDeviceStatus();
    expect(coapServer?.isScanning).toBeFalsy();
  });

  test('Use dgram server', () => {
    coapServer?.startDgramServer();
    expect(coapServer?.isScanning).toBeFalsy();
  }, 60000);

  test('Use dgram sender', () => {
    coapServer?.startDgramSender();
    expect(coapServer?.isScanning).toBeFalsy();
  }, 60000);

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
});
