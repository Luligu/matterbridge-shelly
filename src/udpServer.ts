/**
 * @file src/udpServer.ts
 * @description This file contains the class UdpServer.
 * @author Luca Liguori
 * @created 2026-08-10
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

import crypto from 'node:crypto';
import EventEmitter from 'node:events';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

import { Unicast } from 'matterbridge/dgram';
import { AnsiLogger, CYAN, debugStringify, LogLevel, nf, TimestampFormat } from 'matterbridge/logger';
import { getErrorMessage } from 'matterbridge/utils';

import { type AuthParams, createDigestShellyAuth } from './auth.js';
import type { ShellyData } from './shellyTypes.js';
import { normalizeId } from './shellyUtils.js';

/** RPC notification, response, or error frame received from a Shelly device over UDP. */
interface UdpMessage {
  /** Request ID present on RPC responses and errors. */
  id?: number;
  /** Shelly device ID that sent the frame. */
  src: string;
  /** Destination identifier or wildcard. */
  dst: string;
  /** Notification method, such as `NotifyStatus` or `NotifyEvent`. */
  method?: string;
  /** Notification parameters. */
  params?: ShellyData;
  /** Successful RPC response payload. */
  result?: ShellyData;
  /** Failed RPC response payload. */
  error?: {
    /** Shelly RPC error code. */
    code: number;
    /** Human-readable error or serialized authentication challenge. */
    message: string;
  };
}

/** RPC request frame sent to a Shelly device over UDP. */
export interface UdpRequestFrame {
  /** Request ID assigned by the server when omitted. */
  id?: number;
  /** Source identifier used to address the response. */
  src: string;
  /** Shelly RPC method to invoke. */
  method: string;
  /** Parameters passed to the RPC method. */
  params: ShellyData;
  /** Digest authentication data included after an authentication challenge. */
  auth?: AuthParams;
}

/** Digest authentication challenge returned by a password-protected Shelly device. */
interface UdpAuthChallenge {
  /** Server-generated nonce. */
  nonce: number | string;
  /** Authentication realm, normally the Shelly device ID. */
  realm: string;
  /** Optional nonce count used by legacy firmware. */
  nc?: number;
}

/** RPC request retained while awaiting a response or authentication challenge. */
interface PendingRequest {
  /** Original RPC request frame. */
  request: UdpRequestFrame;
  /** Destination IPv4 address. */
  address: string;
  /** Destination UDP port. */
  port: number;
  /** Optional password used to answer an authentication challenge. */
  password?: string;
}

/** Events emitted by the UDP RPC server. */
interface UdpServerEvents {
  /** Emitted when the UDP listener is ready. */
  started: [];
  /** Emitted when the UDP server is stopped. */
  stopped: [];
  /** Emitted when the UDP listener encounters an error. */
  error: [Error];
  /** Emitted for a successful client-initiated RPC response. */
  udpresponse: [shellyId: string, result: ShellyData];
  /** Emitted for `NotifyStatus` and `NotifyFullStatus` notifications. */
  udpupdate: [shellyId: string, params: ShellyData];
  /** Emitted for `NotifyEvent` notifications. */
  udpevent: [shellyId: string, params: ShellyData];
}

/**
 * UDP RPC server for communicating with Shelly devices.
 *
 * @remarks
 * Shelly devices send unsolicited `NotifyStatus` and `NotifyEvent` messages to the configured
 * `Sys.rpc_udp.dst_addr`. These notifications, including BTHome device and sensor updates,
 * are sent regardless of whether device authentication is enabled and require no subscription.
 *
 * Client-initiated RPC requests are an independent flow. Password-protected devices respond
 * with a digest authentication challenge, which this server handles by resending the original
 * request with authentication. Sending an authenticated request does not enable or subscribe
 * the server to notifications.
 *
 * @example
 * Configure a Shelly device through HTTP RPC to send notifications to `192.168.69.100:8585`
 * and listen for inbound UDP RPC requests on port `8585`:
 * ```bash
 * curl -X POST -d '{"id":1,"method":"Sys.SetConfig","params":{"config":{"rpc_udp":{"dst_addr":"192.168.69.100:8585","listen_port":8585}}}}' http://<shelly-ip>/rpc
 * ```
 *
 * The equivalent TypeScript request using `fetch`:
 * ```ts
 * await fetch('http://<shelly-ip>/rpc', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({
 *     id: 1,
 *     method: 'Sys.SetConfig',
 *     params: {
 *       config: {
 *         rpc_udp: {
 *           dst_addr: '192.168.69.100:8585',
 *           listen_port: 8585,
 *         },
 *       },
 *     },
 *   }),
 * });
 * ```
 */
export class UdpServer extends EventEmitter<UdpServerEvents> {
  /** Logger used by the UDP server. */
  public readonly log;
  /** Underlying Matterbridge UDP unicast listener. */
  private udpServer: Unicast | undefined;
  /** Shelly source IDs whose messages are forwarded when filtering is enabled. */
  private filter: string[] = [];
  /** RPC requests awaiting a response or authentication challenge. */
  private pendingRequests = new Map<string, PendingRequest>();
  /** Next automatically assigned RPC request ID. */
  private id = 1;
  /** UDP port on which the server listens. Defaults to 8585. */
  private readonly port: number;
  /** Password used to authenticate RPC requests. */
  private readonly password: string | undefined;
  /** Indicates whether the UDP listener is ready to receive datagrams. */
  private _isListening = false;

  /**
   * Constructs a new instance of the UdpServer class.
   *
   * @param {number} port - The UDP port on which the server will listen. Defaults to 8585.
   * @param {string} [password] - The password used to authenticate RPC requests.
   * @param {LogLevel} logLevel - The log level for the logger. Defaults to LogLevel.INFO.
   */
  constructor(port: number = 8585, password?: string, logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.port = port;
    this.password = password;
    this.log = new AnsiLogger({ logName: 'ShellyUdpServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
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
   * Sets the source IDs whose messages are forwarded.
   *
   * Messages from other source IDs are logged but not forwarded when the filter contains entries.
   * An empty filter forwards messages from every source.
   *
   * @param {string[]} filter - Shelly source IDs to forward. An empty array disables filtering.
   * @returns {void}
   */
  setFilter(filter: string[]): void {
    this.filter = [...filter];
    this.log.info(`UDP RPC server filter set to: ${this.filter.length ? this.filter.join(', ') : 'none'}`);
  }

  /**
   * Sends an RPC request to a Shelly device over UDP.
   *
   * @param {UdpRequestFrame} request - The RPC request frame to send.
   * @param {string} address - The destination IPv4 address.
   * @param {number} port - The destination UDP port.
   * @returns {void}
   */
  sendRpc(request: UdpRequestFrame, address: string, port: number): void {
    if (!this.udpServer) {
      this.log.error(`Unable to send UDP RPC request: server is not started`);
      return;
    }
    request.id ??= this.id++;
    this.pendingRequests.set(`${address}:${request.id}`, { request: { ...request }, address, port, password: this.password });
    const message = Buffer.from(JSON.stringify(request));
    this.udpServer.send(message, address, port);
    this.log.debug(`Sent UDP RPC request to ${address}:${port}: ${debugStringify(request)}`);
  }

  /**
   * Starts the UDP server for Shelly devices.
   *
   * @returns {void}
   */
  start(): void {
    if (this.udpServer || this._isListening) {
      this.log.debug(`UDP RPC server is already listening`);
      return;
    }

    this.log.info(`Starting UDP RPC server for shelly devices...`);
    const udpServer = new Unicast('ShellyUdpServer', 'udp4', false, undefined, undefined, this.port);
    this.udpServer = udpServer;

    udpServer.on('message', (data, remoteInfo) => {
      try {
        const message: UdpMessage = JSON.parse(data.toString());
        const pendingKey = message.id === undefined ? undefined : `${remoteInfo.address}:${message.id}`;
        const pendingRequest = pendingKey ? this.pendingRequests.get(pendingKey) : undefined;
        if (pendingKey && message.error?.code === 401 && pendingRequest) {
          this.pendingRequests.delete(pendingKey);
          if (pendingRequest.password) {
            const challenge: UdpAuthChallenge = JSON.parse(message.error.message);
            const authenticatedRequest: UdpRequestFrame = {
              ...pendingRequest.request,
              auth: createDigestShellyAuth('admin', pendingRequest.password, challenge.nonce, crypto.randomInt(0, 999999999), challenge.realm, challenge.nc),
            };
            const authenticatedMessage = Buffer.from(JSON.stringify(authenticatedRequest));
            this.udpServer?.send(authenticatedMessage, pendingRequest.address, pendingRequest.port);
            this.log.debug(`Resent authenticated UDP RPC request to ${pendingRequest.address}:${pendingRequest.port}: ${debugStringify(authenticatedRequest)}`);
            return;
          } else {
            this.log.error(`Authentication required for ${message.src}, but no password was provided.`);
          }
        } else if (pendingKey && pendingRequest) {
          this.pendingRequests.delete(pendingKey);
        }
        if (this.filter.length && !this.filter.includes(message.src)) {
          this.log.debug(`Filtered UDP RPC message received from ${message.src} at ${remoteInfo.address}:${remoteInfo.port}: ${debugStringify(message)}`);
          return;
        }
        this.log.debug(`Received UDP RPC message from ${message.src} at ${remoteInfo.address}:${remoteInfo.port}: ${debugStringify(message)}`);
        const shellyId = normalizeId(message.src).id;
        if ((message.method === 'NotifyStatus' || message.method === 'NotifyFullStatus') && message.params) {
          this.emit('udpupdate', shellyId, message.params);
        } else if (message.method === 'NotifyEvent' && message.params) {
          this.emit('udpevent', shellyId, message.params);
        } else if (message.method === undefined && message.result !== undefined) {
          this.emit('udpresponse', shellyId, message.result);
        }
      } catch (error) {
        this.log.error(`Unable to parse data received from ${remoteInfo.address}:${remoteInfo.port}: ${getErrorMessage(error)}`);
      }
    });

    udpServer.on('ready', () => {
      this._isListening = true;
      this.log.info(`UDP RPC server for shelly devices is listening on port ${this.port}...`);
      this.emit('started');
    });

    udpServer.on('error', (error) => {
      this.log.error(`UDP RPC server error: ${getErrorMessage(error)}`);
      this._isListening = false;
      this.emit('error', error);
    });

    udpServer.on('close', () => {
      this._isListening = false;
      this.udpServer = undefined;
    });

    udpServer.start();
  }

  /** Stops the UDP server for Shelly devices. */
  stop(): void {
    this.log.info(`Stopping UDP RPC server (listening ${this._isListening}) for shelly devices...`);
    this.udpServer?.stop();
    this.pendingRequests.clear();
    this._isListening = false;
    this.log.info(`Stopped UDP RPC server for shelly devices`);
    this.emit('stopped');
  }
}

/* v8 ignore start */
// Run with: node dist/udpServer.js
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const udpServer = new UdpServer(8585, 'tango', LogLevel.DEBUG);
  udpServer.setFilter(['shelly2pmg4-98a316721128']);
  udpServer.on('udpupdate', (shellyId, params) => {
    udpServer.log.info(`Received UDP RPC update from ${CYAN}${shellyId}${nf}:\n${inspect(params, { colors: true, depth: 10 })}`);
  });
  udpServer.on('udpevent', (shellyId, params) => {
    udpServer.log.info(`Received UDP RPC event from ${CYAN}${shellyId}${nf}:\n${inspect(params, { colors: true, depth: 10 })}`);
  });
  udpServer.on('udpresponse', (shellyId, result) => {
    udpServer.log.info(`Received UDP RPC response from ${CYAN}${shellyId}${nf}:\n${inspect(result, { colors: true, depth: 10 })}`);
  });
  udpServer.start();

  setTimeout(() => {
    // Send Shelly.GetStatus to 192.168.68.56:8585
    const shellyGetStatus: UdpRequestFrame = {
      src: 'Matterbridge',
      method: 'Shelly.GetStatus',
      params: {},
    };
    udpServer.sendRpc(shellyGetStatus, '192.168.68.56', 8585);
  }, 5000);
}
