/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import { CoapServer } from './coapServer';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';

// jest.useFakeTimers();

describe('Coap scanner', () => {
  let coapServer: CoapServer | undefined = undefined;

  beforeAll(() => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: LogLevel, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    coapServer = new CoapServer(true);
  });

  beforeEach(() => {
    //
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    coapServer?.stop();

    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  });

  test('Create the coapServer', () => {
    expect(coapServer).not.toBeUndefined();
  });

  test('Not starting to listen', () => {
    expect(coapServer?.isListening).toBeFalsy();
  });

  test('Getting device description', async () => {
    await coapServer?.getDeviceDescription('192.168.222.219', 3);
    expect(coapServer?.isListening).toBeFalsy();
  }, 5000);

  test('Getting device status', async () => {
    await coapServer?.getDeviceStatus('192.168.222.219', 3);
    expect(coapServer?.isListening).toBeFalsy();
  }, 5000);

  test('Getting multicast device status', async () => {
    await coapServer?.getMulticastDeviceStatus(3);
    expect(coapServer?.isListening).toBeFalsy();
  }, 5000);

  test('Start scanner', () => {
    coapServer?.start(true);
    expect(coapServer?.isListening).toBeTruthy();
  }, 5000);
});
