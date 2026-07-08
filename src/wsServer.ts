/**
 * @file src/wsServer.ts
 * @description This file contains the class WsServer.
 * @author Luca Liguori
 * @created 2024-08-13
 * @version 1.4.0
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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
 * limitations under the License.
 */

import EventEmitter from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';

import { AnsiLogger, CYAN, db, er, hk, LogLevel, rs, TimestampFormat, wr, zb } from 'matterbridge/logger';
import { getErrorMessage } from 'matterbridge/utils';
import { WebSocket, WebSocketServer } from 'ws';

import type { ShellyData } from './shellyTypes.js';
import { normalizeId } from './shellyUtils.js';

interface WsMessage {
  src: string;
  dst: string;
  method: string;
  params: ShellyData;
}

interface WsServerEvent {
  started: [];
  stopped: [];
  error: [Error];
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
export class WsServer extends EventEmitter<WsServerEvent> {
  public readonly log;
  private httpServer: Server | undefined;
  private wsServer: WebSocketServer | undefined;
  private pingPeriod = 30000;
  private pongPeriod = 30000;
  private _isListening = false;

  /**
   * Constructs a new instance of the WsServer class.
   *
   * @param {LogLevel} logLevel - The log level for the logger. Defaults to LogLevel.INFO.
   */
  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.log = new AnsiLogger({ logName: 'ShellyWsServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
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
   * @param {number} port - The port number on which the WebSocket server will listen. Defaults to 8485.
   *
   * @remarks
   * This method listens to a WebSocket connection and handles various events such as open, error, close, and message.
   * It receives updates and events from the WebSocket server.
   * The received responses are parsed and appropriate actions are taken based on the response type.
   */
  private listenForStatusUpdates(port: number = 8485): void {
    try {
      // Create an HTTP server
      this.httpServer = createServer();
      // Create a WebSocket server and attach it to the HTTP server
      this.wsServer = new WebSocketServer({ server: this.httpServer });
    } catch (error) {
      /* v8 ignore next */
      this.log.error(`Failed to create the HttpServer and WebSocketServer: ${getErrorMessage(error)}`);
      /* v8 ignore next */
      return;
    }

    // Handle the open event
    this.wsServer.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientAddress = req.socket.remoteAddress;
      this.log.info(`WebSocketServer client connected host ${zb}${clientAddress}${db}.`);

      // Start the ping/pong mechanism
      this.log.debug(`Start WebSocketServer PingPong.`);

      // Set a timeout to wait for a ping response
      let pongTimeout: NodeJS.Timeout | undefined;
      let pingInterval: NodeJS.Timeout | undefined;
      ws.ping();
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.ping();
          // Set a timeout to wait for a pong response
          pongTimeout = setTimeout(() => {
            this.log.error(`WebSocketServer pong not received.`);
          }, this.pongPeriod);
        }
      }, this.pingPeriod);

      // Handle incoming messages from clients
      ws.on('message', (data) => {
        this.log.debug(`Received message from WebSocketServer client ${zb}${clientAddress}${db}.`);

        // Process the message and respond if necessary
        try {
          // oxlint-disable-next-line typescript/no-base-to-string
          const message: WsMessage = JSON.parse(data.toString());
          if (message.method && (message.method === 'NotifyStatus' || message.method === 'NotifyFullStatus') && message.src && message.dst === 'ws') {
            message.src = normalizeId(message.src).id;
            this.log.debug(`Received ${CYAN}${message.method}${db} from ${hk}${message.src}${db} host ${zb}${clientAddress}${db}:${rs}\n`, message.params);
            this.emit('wssupdate', message.src, message.params);
          } else if (message.method && message.method === 'NotifyEvent' && message.src && message.dst === 'ws') {
            message.src = normalizeId(message.src).id;
            this.log.debug(`Received ${CYAN}NotifyEvent${db} from ${hk}${message.src}${db} host ${zb}${clientAddress}${db}:${rs}\n`, message.params);
            this.emit('wssevent', message.src, message.params);
          } else {
            this.log.debug(`WebSocketServer received an unknown message from ${hk}${message.src}${db} host ${zb}${clientAddress}${wr}:${rs}\n`, message);
          }
        } catch (error) {
          this.log.error(`WebSocketServer error parsing message from ${zb}${clientAddress}${er}: ${getErrorMessage(error)}`);
        }
      });

      // Handle pong messages
      ws.on('pong', (_data: Buffer) => {
        this.log.debug('WebSocketServer client sent a pong');
        clearTimeout(pongTimeout);
        pongTimeout = undefined;
      });

      // Handle ping messages
      ws.on('ping', (_data: Buffer) => {
        this.log.debug('WebSocketServer client sent a ping');
        ws.pong();
      });

      // Handle connection close
      ws.on('close', (code: number, reason: Buffer) => {
        this.log.info(`WebSocketServer client disconnected: code ${code} ${reason.toString('utf-8') === '' ? '' : 'reason ' + reason.toString('utf-8')}`);
        clearInterval(pingInterval);
        pingInterval = undefined;
        clearTimeout(pongTimeout);
        pongTimeout = undefined;
      });

      // Handle errors
      ws.on('error', (error) => {
        this.log.error(`WebSocketServer client error: ${getErrorMessage(error)}`);
      });
    });

    // Handle errors
    this.wsServer.on('error', (error: Error) => {
      this.log.error(`WebSocketServer error: ${getErrorMessage(error)}`);
      this._isListening = false;
    });

    // Handle the close event
    this.wsServer.on('close', () => {
      this.log.debug(`WebSocketServer connection closed.`);
      this._isListening = false;
    });

    this.httpServer.on('error', (error: Error) => {
      this.log.error(`HttpServer error: ${error instanceof Error ? error.message : error}`);
      this.emit('error', error);
      this._isListening = false;
    });

    // Start the server
    this.httpServer.listen(port, () => {
      this._isListening = true;
      this.log.debug(`HttpServer for WebSocketServer is listening on port ${port}`);
      this.log.info(`Started WebSocket server for shelly devices.`);
      this.log.info(`WebSocket server for shelly devices is listening on port ${port}...`);
      this.emit('started');
    });
  }

  /**
   * Starts the WebSocket server for the Shelly devices.
   *
   * @param {number} [port] - The port number on which the WebSocket server will listen. Defaults to 8485.
   *
   * @remarks
   * This method initializes the WebSocket server and starts listening for status updates.
   */
  start(port: number = 8485): void {
    if (this._isListening) {
      this.log.debug(`WebSocketServer is already listening.`);
      return;
    }
    this.log.info(`Starting WebSocket server for shelly devices...`);
    this.listenForStatusUpdates(port);
  }

  /**
   * Stops the WebSocket client for the Shelly device.
   *
   * @remarks
   * This method stops the WebSocket client and performs necessary cleanup operations.
   * If the client is currently connecting, it will wait for a maximum of 5 seconds before forcefully terminating the connection.
   */
  stop(): void {
    this.log.info(`Stopping WebSocket server (listening ${this._isListening}) for shelly devices...`);
    for (const client of this.wsServer?.clients ?? []) {
      client.terminate();
    }

    this.wsServer?.close((err?: Error) => {
      this.log.debug(`WebSocket server for shelly devices stopped${err ? ' with error ' + err.message : ''}.`);
      this.wsServer?.removeAllListeners();
      this.wsServer = undefined;
    });

    this.httpServer?.close((err?: Error) => {
      this.log.debug(`HttpServer for WebSocketServer stopped${err ? ' with error ' + err.message : ''}.`);
      this.httpServer?.removeAllListeners();
      this.httpServer = undefined;
    });

    this._isListening = false;
    this.log.info(`Stopped WebSocket server for shelly devices...`);
    this.emit('stopped');
  }
}
