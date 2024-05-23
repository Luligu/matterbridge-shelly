/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { AnsiLogger, BLUE, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, idn, nf, rs, wr, zb } from 'node-ansi-logger';
import WebSocket from 'ws';
import axios from 'axios';

export interface CoapMessage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  msg: any;
  host: string;
  deviceType: string;
  deviceId: string;
  protocolRevision: string;
  validFor: number;
  serial: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
}

export class WsClient {
  private log;
  private wsClient: WebSocket | undefined;
  private _isConnected = false;
  private wsUrl = '';
  private callback?: (msg: CoapMessage) => void;

  constructor(wsUrl: string) {
    this.log = new AnsiLogger({ logName: 'wsClient', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
    this.wsUrl = wsUrl;
  }

  get isConnected() {
    return this._isConnected;
  }

  listenForStatusUpdates() {
    // Create WebSocket connection
    this.wsClient = new WebSocket(this.wsUrl);
    // Define the request frame
    const requestFrame = {
      id: 0x1234,
      src: 'Matterbridge',
      method: 'Shelly.GetStatus',
      params: {},
    };

    // Handle the open event
    this.wsClient.on('open', () => {
      console.log('WebSocket connection opened');
      this._isConnected = true;
      // Send the request frame
      this.wsClient?.send(JSON.stringify(requestFrame));
    });

    // Handle messages from the WebSocket
    this.wsClient.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      console.log('Received:', data.toString());
    });

    // Handle errors
    this.wsClient.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });

    // Handle the close event
    this.wsClient.on('close', () => {
      console.log('WebSocket connection closed');
      this._isConnected = false;
    });
  }

  start(callback?: (msg: CoapMessage) => void, debug = false) {
    this.log.setLogDebug(debug);
    this.log.info('Starting CoIoT server for shelly devices...');
    this.callback = callback;
    this.listenForStatusUpdates();
    this.log.info('Started CoIoT server for shelly devices.');
  }

  stop() {
    this.log.info('Stopping CoIoT server for shelly devices...');
    this.wsClient?.close();
    this.wsClient?.removeAllListeners();
    this._isConnected = false;
    this.log.info('Stopped CoIoT server for shelly devices.');
  }
}

if (process.argv.includes('wsClient')) {
  const wsClient = new WsClient('ws://192.168.1.217/rpc');

  wsClient.start(undefined, true);

  process.on('SIGINT', async function () {
    wsClient.stop();
    process.exit();
  });
}
