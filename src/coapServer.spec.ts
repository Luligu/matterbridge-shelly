import { CoapServer } from './coapServer';

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

  test('Create the coapServer', () => {
    expect(coapServer).not.toBeUndefined();
  });

  test('Not starting to listen', () => {
    expect(coapServer?.isListening).toBeFalsy();
  });

  test('Getting device description', async () => {
    await coapServer?.getDeviceDescription('192.168.1.219');
    expect(coapServer?.isListening).toBeFalsy();
  });

  test('Getting device status', async () => {
    await coapServer?.getDeviceStatus('192.168.1.219');
    expect(coapServer?.isListening).toBeFalsy();
  });

  test(
    'Getting multicast device status',
    async () => {
      await coapServer?.getMulticastDeviceStatus(20);
      expect(coapServer?.isListening).toBeFalsy();
    },
    30 * 1000,
  );

  test(
    'Getting multicast device status resolve null',
    async () => {
      return expect(coapServer?.getMulticastDeviceStatus(20)).resolves.toBe(null);
    },
    30 * 1000,
  );

  test('Start scanner', () => {
    coapServer?.start(true);
    expect(coapServer?.isListening).toBeTruthy();
  }, 60000);
});
