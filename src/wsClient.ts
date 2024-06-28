/**
 * This file contains the class WsClient.
 *
 * @file src\wsClient.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 1.0.0
 *
 * Copyright 2024, 2025 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. *
 */

import { AnsiLogger, BLUE, CYAN, TimestampFormat, db, er, nf, rs, wr, zb } from 'node-ansi-logger';
import WebSocket from 'ws';
import crypto from 'crypto';
import EventEmitter from 'events';
import { createDigestShellyAuth } from './auth.js';

interface AuthParams {
  realm: string; // device_id
  username: string; // admin
  nonce: number; // generated by device
  cnonce: number; // random number
  response: string; // hash <<user>:<realm>:<password>> + ":" + <nonce> + ":" + <nc> + ":" + <cnonce> + ":" + "auth" + ":" + <dummy_method:dummy_uri>
  algorithm: string; // SHA-256
}

interface RequestFrame {
  id: number; // Request ID
  src: string; // Source of request
  method: string; // Shelly.GetStatus';
  params: object; // other stuff
}

interface RequestFrameWithAuth {
  id: number; // Request ID
  src: string; // Source of request
  method: string; // Shelly.GetStatus';
  params: object; // other stuff
  auth: AuthParams;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ResponseError {
  id: number;
  src: string;
  dst: string;
  error: {
    code: number;
    message: string;
  };
}

interface ResponseErrorMessage {
  auth_type: string; // digest
  nonce: number;
  nc: number;
  realm: string; // device_id shelly1minig3-543204547478
  algorithm: string; // SHA-256
}

type Params = Record<string, string | number | boolean | object>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface ResponseNotifyStatus {
  src: string;
  dst: string;
  method: string;
  params: Params;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Response {
  id: number;
  src: string;
  dst: string;
  result: Params;
}

export class WsClient extends EventEmitter {
  private log;
  private wsClient: WebSocket | undefined;
  private _isConnected = false;
  private _isConnecting = false;
  private id?: string;
  private wsHost;
  private wsUrl;
  private auth = false;
  private password;
  private requestId;

  // PingPong
  private pingInterval?: NodeJS.Timeout;
  private pongTimeout?: NodeJS.Timeout;

  // Define the request frame without auth
  private requestFrame: RequestFrame = {
    id: 0, // Request ID will get updated with a random number
    src: 'Matterbridge', // Source of request
    method: 'Shelly.GetStatus',
    params: {},
  };

  // Define the request frame with auth
  private requestFrameWithAuth: RequestFrameWithAuth = {
    id: 0, // Request ID will get updated with a random number
    src: 'Matterbridge', // Source of request
    method: 'Shelly.GetStatus',
    params: {},
    auth: { realm: '', username: 'admin', nonce: 0, cnonce: 0, response: '', algorithm: 'SHA-256' },
  };

  constructor(wsHost: string, password?: string) {
    super();
    this.log = new AnsiLogger({ logName: 'wsClient', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: false });
    this.wsHost = wsHost;
    this.wsUrl = `ws://${this.wsHost}/rpc`;
    this.password = password;
    this.requestId = crypto.randomInt(0, 9999);
    this.requestFrame.id = this.requestId;
    this.requestFrameWithAuth.id = this.requestId;
  }

  get isConnected() {
    return this._isConnected;
  }

  async sendRequest(method = 'Shelly.GetStatus', params: Params = {}) {
    if (!this.wsClient || !this._isConnected) {
      this.log.error(`SendRequest error: WebSocket client is not connected to ${zb}${this.wsHost}${er}`);
      return;
    }
    this.requestFrame.method = method;
    this.requestFrame.params = params;
    this.wsClient?.send(JSON.stringify(this.requestFrame));
  }

  private startPingPong(pingTimeout = 30000) {
    this.log.debug(`Start PingPong with host ${zb}${this.wsHost}${db}.`);
    this.pingInterval = setInterval(() => {
      if (this.wsClient?.readyState === WebSocket.OPEN) {
        this.wsClient.ping(); // Send a ping message

        // Set a timeout to wait for a pong response
        this.pongTimeout = setTimeout(() => {
          this.log.error(`Pong not received from ${zb}${this.wsHost}${er}, closing connection.`);
          this.wsClient?.terminate(); // Close the connection if pong is not received
        }, pingTimeout);
      }
    }, pingTimeout);

    // Listen for pong messages to clear the pong timeout
    this.wsClient?.on('pong', () => {
      clearTimeout(this.pongTimeout);
      this.log.debug(`Pong received from ${zb}${this.wsHost}${db}, connection is alive.`);
    });
  }

  private stopPingPong() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = undefined;
    }
  }

  async listenForStatusUpdates() {
    try {
      this._isConnecting = true;
      this.wsClient = new WebSocket(this.wsUrl);
    } catch (error) {
      this.log.error(`Failed to create WebSocket connection to ${zb}${this.wsUrl}${er}: ${error}`);
      return;
    }

    // Handle the open event
    this.wsClient.on('open', () => {
      this.log.info(`WebSocket connection opened with Shelly device host ${zb}${this.wsHost}${nf}`);
      this._isConnecting = false;
      this._isConnected = true;
      this.wsClient?.send(JSON.stringify(this.requestFrame));

      // Start the ping/pong mechanism
      this.startPingPong();
    });

    // Handle errors
    this.wsClient.on('error', (error: Error) => {
      this.log.error(`WebSocket error with Shelly device on address ${zb}${this.wsHost}${rs}\n`, error);
    });

    // Handle the close event
    this.wsClient.on('close', () => {
      this.log.info(`WebSocket connection closed with Shelly device on address ${zb}${this.wsHost}${nf}`);
      this._isConnected = false;
      this.stopPingPong();
    });

    // Handle messages from the WebSocket
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.wsClient.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      const response = JSON.parse(data.toString());
      this.id = response.src;

      // Handle the response error code 401 (auth required)
      if (response.error && response.error.code === 401 && response.id === this.requestId && response.dst === 'Matterbridge') {
        this.auth = true;
        if (!this.password) {
          this.log.error(`Authentication required for ${response.src} but the password is not set. Exiting...`);
          return;
        }
        this.requestFrameWithAuth.method = this.requestFrame.method;
        this.requestFrameWithAuth.params = this.requestFrame.params;
        const auth: ResponseErrorMessage = JSON.parse(response.error.message);
        this.log.debug(`Auth requested: ${response.error.message}`);
        this.requestFrameWithAuth.auth = createDigestShellyAuth('admin', this.password, auth.nonce, crypto.randomInt(0, 999999999), auth.realm, auth.nc);
        this.wsClient?.send(JSON.stringify(this.requestFrameWithAuth));
      } else if (response.result && response.id === this.requestId && response.dst === 'Matterbridge') {
        this.log.debug(`Received Shelly.GetStatus response from ${CYAN}${this.id}${db} on ${BLUE}${this.wsHost}${db}:${rs}\n`, response.result);
        this.emit('response', response.result);
      } else if (response.method && (response.method === 'NotifyStatus' || response.method === 'NotifyFullStatus') && response.dst === 'Matterbridge') {
        this.log.debug(`Received NotifyStatus from ${CYAN}${this.id}${db} on ${BLUE}${this.wsHost}${db}:${rs}\n`, response.params);
        this.emit('update', response.params);
      } else if (response.method && response.method === 'NotifyEvent' && response.dst === 'Matterbridge') {
        this.log.debug(`Received NotifyEvent from ${CYAN}${this.id}${db} on ${BLUE}${this.wsHost}${db}:${rs}\n`, response.params.events);
        this.emit('event', response.params.events);
      } else if (response.error && response.id === this.requestId && response.dst === 'Matterbridge') {
        this.log.error(`Received error response from ${CYAN}${this.id}${er} on ${BLUE}${this.wsHost}${er}:${rs}\n`, response);
      } else {
        this.log.warn(`Received unknown response from ${CYAN}${this.id}${wr} on ${BLUE}${this.wsHost}${wr}:${rs}\n`, response);
      }
    });
  }

  start(debug = false) {
    this.log.setLogDebug(debug);
    this.log.debug(`Starting ws client for Shelly device on address ${this.wsHost}`);
    this.listenForStatusUpdates();
    this.log.debug(`Started ws client for Shelly device on address ${this.wsHost}`);
  }

  stop(debug = false) {
    this.log.setLogDebug(debug);
    this.log.debug(
      `Stopping ws client for Shelly device on address ${this.wsHost} state ${this.wsClient?.readyState} conencting ${this._isConnecting} connected ${this._isConnected} `,
    );
    this.stopPingPong();
    if (this._isConnecting) {
      setTimeout(() => {
        if (this._isConnected) this.wsClient?.close();
        this._isConnected = false;
        this.wsClient?.removeAllListeners();
        this.log.debug(`Stopped ws client for Shelly device on address ${this.wsHost}`);
      }, 5000);
      return;
    }
    if (this._isConnected) this.wsClient?.close();
    this._isConnected = false;
    this.wsClient?.removeAllListeners();
    this.log.debug(`Stopped ws client for Shelly device on address ${this.wsHost}`);
  }
}

/*
// Start the WebSocket client with the following command: node dist/wsClient.js startWsClient
if (process.argv.includes('startWsClient')) {
  const wsClient1 = new WsClient('192.168.1.217', 'tango');
  wsClient1.start(true);

  const wsClient2 = new WsClient('192.168.1.218', 'tango');
  wsClient2.start(true);

  setTimeout(() => {
    wsClient1.sendRequest('Switch.Set', { id: 0, on: true });
  }, 5000);

  setTimeout(() => {
    wsClient1.sendRequest('Switch.Set', { id: 0, on: false });
  }, 10000);

  setTimeout(() => {
    wsClient1.sendRequest('Shelly.GetComponents', {});
  }, 15000);

  setTimeout(() => {
    wsClient1.sendRequest('Shelly.ListMethods', {});
  }, 20000);

  process.on('SIGINT', async function () {
    wsClient1.stop();
    wsClient2.stop();
  });
}
*/
