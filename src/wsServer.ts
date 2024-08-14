/* eslint-disable @typescript-eslint/no-unused-vars */
/**
 * This file contains the class WsClient.
 *
 * @file src\wsServer.ts
 * @author Luca Liguori
 * @date 2024-08-13
 * @version 1.1.0
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

import { AnsiLogger, CYAN, LogLevel, TimestampFormat, db, er, hk, nf, rs, wr, zb } from 'matterbridge/logger';
import WebSocket, { WebSocketServer } from 'ws';
import EventEmitter from 'events';
import { createServer, IncomingMessage, Server } from 'http';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyData } from './shellyTypes.js';
/*
{
  src: 'shellyhtg3-3030f9ec8468',
  dst: 'ws',
  method: 'NotifyStatus',
  params: { ts: 1723580582.44, ws: { connected: true } }
}

{
  src: 'shellyhtg3-3030f9ec8468',
  dst: 'ws',
  method: 'NotifyEvent',
  params: { ts: 1723580181.2, events: [ [Object] ] }
}
*/

interface WsMessage {
  src: string;
  dst: string;
  method: string;
  params: ShellyData;
}

interface WsServerEvent {
  wssupdate: [shellyId: string, params: ShellyData];
  wssevent: [shellyId: string, params: ShellyData];
}

/**
 * WebSocket server for receiving updates from a Shelly device.
 *
 * @remarks
 * The WsServer class provides methods for a WebSocket connection from a Shelly device,
 * receiving status updates and events from the device.
 * It also includes functionality for handling ping/pong messages to ensure the connection is alive.
 */
export class WsServer extends EventEmitter {
  public readonly log;
  private httpServer: Server | undefined;
  private wsServer: WebSocket.Server | undefined;
  private _isListening = false;

  /**
   * Constructs a new instance of the WsServer class.
   *
   */
  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.log = new AnsiLogger({ logName: 'ShellyWsServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
  }

  override emit<K extends keyof WsServerEvent>(eventName: K, ...args: WsServerEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof WsServerEvent>(eventName: K, listener: (...args: WsServerEvent[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * Gets the current listening status.
   *
   * @returns {boolean} A boolean value indicating whether the server is currently listening.
   */
  get isListening(): boolean {
    return this._isListening;
  }

  /**
   * Listens for status updates from the WebSocket connection.
   *
   * @remarks
   * This method listens to a WebSocket connection and handles various events such as open, error, close, and message.
   * It receives updates and events from the WebSocket client.
   * The received responses are parsed and appropriate actions are taken based on the response type.
   *
   * @returns void
   */
  async listenForStatusUpdates(port = 8080) {
    try {
      // Create an HTTP server
      this.httpServer = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('WebSocketServer is running\n');
      });
      // Create a WebSocket server
      this.wsServer = new WebSocketServer({ server: this.httpServer });
    } catch (error) {
      this.log.error(`Failed to create the WebSocketServer: ${error}`);
      return;
    }

    // Handle the open event
    this.wsServer.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientAddress = req.socket.remoteAddress;
      this.log.debug(`WebSocketServer incoming client connection from ${zb}${clientAddress}${db}.`);

      // Start the ping/pong mechanism
      this.log.debug(`Start WebSocketServer PingPong.`);

      // Set a timeout to wait for a ping response
      let pongTimeout: NodeJS.Timeout | undefined = undefined;
      let pingInterval: NodeJS.Timeout | undefined = undefined;
      ws.ping();
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.ping();
          // Set a timeout to wait for a pong response
          pongTimeout = setTimeout(() => {
            this.log.error(`WebSocketServer pong not received.`);
          }, 30000);
        }
      }, 30000);

      // Handle incoming messages from clients
      ws.on('message', (data) => {
        this.log.debug(`Received message from WebSocketServer client ${zb}${clientAddress}${db}.`);

        // Process the message and respond if necessary
        try {
          const message: WsMessage = JSON.parse(data.toString());
          // console.log(message);

          if (message.method && (message.method === 'NotifyStatus' || message.method === 'NotifyFullStatus') && message.src && message.dst === 'ws') {
            message.src = ShellyDevice.normalizeId(message.src).id;
            this.log.debug(`Received ${CYAN}${message.method}${db} from ${hk}${message.src}${db} host ${zb}${clientAddress}${db}:${rs}\n`, message.params);
            this.emit('wssupdate', message.src, message.params);
          } else if (message.method && message.method === 'NotifyEvent' && message.src && message.dst === 'ws') {
            message.src = ShellyDevice.normalizeId(message.src).id;
            this.log.debug(`Received ${CYAN}NotifyEvent${db} from ${hk}${message.src}${db} host ${zb}${clientAddress}${db}:${rs}\n`, message.params);
            this.emit('wssevent', message.src, message.params);
          } else {
            this.log.debug(`WebSocketServer received an unknown message from ${hk}${message.src}${db} host ${zb}${clientAddress}${wr}:${rs}\n`, message);
          }
        } catch (error) {
          this.log.error(`WebSocketServer error parsing message from ${zb}${clientAddress}${er}: ${error instanceof Error ? error.message : error}`);
        }
      });

      // Handle pong messages
      ws.on('pong', (data: Buffer) => {
        this.log.debug('WebSocketServer client received a pong');
        clearTimeout(pongTimeout);
        pongTimeout = undefined;
      });

      // Handle ping messages
      ws.on('ping', (data: Buffer) => {
        this.log.debug('WebSocketServer client received a ping');
        ws.pong();
      });

      // Handle connection close
      ws.on('close', () => {
        this.log.debug('WebSocketServer client disconnected');
        clearInterval(pingInterval);
        pingInterval = undefined;
        clearTimeout(pongTimeout);
        pongTimeout = undefined;
      });

      // Handle errors
      ws.on('error', (error) => {
        this.log.error('WebSocketServer client error:', error);
      });
    });

    // Handle errors
    this.wsServer.on('error', (error: Error) => {
      this.log.error(`WebSocketServer error: ${error instanceof Error ? error.message : error}`);
      this._isListening = false;
    });

    // Handle the close event
    this.wsServer.on('close', () => {
      this.log.debug(`WebSocketServer connection closed.`);
      this._isListening = false;
    });

    // Start the server
    this.httpServer.listen(port, () => {
      this.log.debug(`WebSocketServer is listening on port ${port}`);
      this._isListening = true;
    });
  }

  /**
   * Starts the WebSocket client for the Shelly device.
   *
   * @remarks
   * This method initializes the WebSocket client and starts listening for status updates.
   *
   * @returns void
   */
  start(port = 8080) {
    this.log.debug(`Starting WebSocketServer...`);
    this.listenForStatusUpdates(port); // Na await to start listening for status updates
    this.log.debug(`Started WebSocketServer.`);
  }

  /**
   * Stops the WebSocket client for the Shelly device.
   *
   * @remarks
   * This method stops the WebSocket client and performs necessary cleanup operations.
   * If the client is currently connecting, it will wait for a maximum of 5 seconds before forcefully terminating the connection.
   *
   * @returns void
   */
  stop() {
    this.log.debug(`Stopping WebSocketServer listening ${this._isListening}`);
    for (const client of this.wsServer?.clients || []) {
      client?.terminate();
    }
    this._isListening = false;
    this.wsServer?.close();
    this.wsServer?.removeAllListeners();
    this.httpServer?.close();
    this.httpServer?.removeAllListeners();
    this.log.debug(`Stopped WebSocketServer.`);
  }
}

// Start the WebSocket server with the following command: node dist/wsServer.js startWsServer
/*
if (process.argv.includes('startWsServer')) {
  const wss = new WsServer(LogLevel.DEBUG);
  wss.start();

  process.on('SIGINT', async function () {
    wss.stop();
  });
}
*/