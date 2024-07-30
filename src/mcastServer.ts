/**
 * This file contains the class Multicast.
 *
 * @file src\mcastServer.ts
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

import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import { getIpv4InterfaceAddress } from 'matterbridge/utils';
import dgram from 'dgram';

export class Multicast {
  private log;
  private dgramServer?: dgram.Socket;
  private dgramClient?: dgram.Socket;
  private clientTimeout?: NodeJS.Timeout;
  dgramServerBound = false;
  dgramClientBound = false;

  constructor() {
    this.log = new AnsiLogger({ logName: 'MulticastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  }

  startDgramServer(boundCallback?: () => void, messageCallback?: (msg: Buffer, rinfo: dgram.RemoteInfo) => void) {
    this.log.info('Starting dgram multicast server...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const MULTICAST_PORT = 5683;
    const INTERFACE = getIpv4InterfaceAddress();

    this.dgramServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.dgramServer.on('error', (err) => {
      this.log.error(`Dgram multicast server socket error:\n${err.message}`);
      this.dgramServer?.close();
    });

    this.dgramServer.on('close', () => {
      this.log.info(`Dgram multicast server socket closed`);
      this.dgramServerBound = false;
    });

    this.dgramServer.on('connect', () => {
      this.log.info(`Dgram multicast server socket connected`);
    });

    this.dgramServer.on('message', (msg, rinfo) => {
      this.log.info(`Dgram multicast server received message "${msg}" from ${rinfo.address}:${rinfo.port}`);
      if (messageCallback) messageCallback(msg, rinfo);
    });

    this.dgramServer.on('listening', () => {
      if (!this.dgramServer) {
        this.log.error('Dgram multicast server error listening for multicast messages...');
        return;
      }
      const address = this.dgramServer.address();
      this.log.info(`Dgram multicast server listening on ${address.family} ${address.address}:${address.port}`);
      this.dgramServer.setBroadcast(true);
      this.log.info(`Dgram multicast server broadcast enabled`);
      this.dgramServer.setMulticastTTL(128);
      this.log.info(`Dgram multicast server multicast TTL set to 128`);
      this.dgramServer.addMembership(MULTICAST_ADDRESS, INTERFACE);
      this.log.info(`Dgram multicast server joined multicast group: ${MULTICAST_ADDRESS} with interface ${INTERFACE}`);
      this.dgramServerBound = true;
      if (boundCallback) boundCallback();
    });

    this.dgramServer.bind(MULTICAST_PORT, INTERFACE);
  }

  startDgramClient(boundCallback?: () => void) {
    this.log.info('Starting dgram multicast client...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const MULTICAST_PORT = 5683;
    const INTERFACE = getIpv4InterfaceAddress();

    const message = Buffer.from('Test multicast message');

    this.dgramClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.dgramClient.on('error', (err) => {
      this.log.error(`Dgram multicast client socket error:\n${err.message}`);
      this.dgramClient?.close();
    });

    this.dgramClient.on('close', () => {
      this.log.info(`Dgram multicast client socket closed`);
      this.dgramClientBound = false;
    });

    this.dgramClient.on('connect', () => {
      this.log.info(`Dgram multicast client socket connected`);
    });

    this.dgramClient.on('message', (msg, rinfo) => {
      this.log.info(`Dgram multicast client message "${msg}" received from ${rinfo.address}:${rinfo.port}`);
    });

    this.dgramClient.on('listening', () => {
      this.log.info(`Dgram multicast client socket listening`);
      if (!this.dgramClient) {
        this.log.error('Dgram multicast client error binding for multicast messages...');
        return;
      }
      const address = this.dgramClient.address();
      this.log.info(`Dgram multicast client listening on ${address.family} ${address.address}:${address.port}`);
      this.dgramClient?.setBroadcast(true);
      this.log.info(`Dgram multicast client broadcast enabled`);
      this.dgramClient?.setMulticastTTL(128);
      this.log.info(`Dgram multicast client multicast TTL set to 128`);
      this.dgramClient?.addMembership(MULTICAST_ADDRESS, INTERFACE);
      this.log.info(`Dgram multicast client joined multicast group: ${MULTICAST_ADDRESS} with interface: ${INTERFACE}`);
      this.dgramClientBound = true;
      if (boundCallback) boundCallback();

      this.clientTimeout = setInterval(() => {
        this.dgramClient?.send(message, 0, message.length, MULTICAST_PORT, MULTICAST_ADDRESS, (error: Error | null) => {
          if (error) {
            this.log.error(`Dgram multicast client failed to send message: ${error.stack}`);
          } else {
            this.log.info(`Dgram multicast client sent message "Test multicast message" to ${MULTICAST_ADDRESS}:${MULTICAST_PORT}`);
          }
        });
      }, 1000); // Send message every second
    });

    this.dgramClient.bind();
  }

  stop() {
    this.log.info('Stopping dgram server for shelly devices...');
    if (this.dgramServer) this.dgramServer.close();
    this.dgramServer = undefined;
    this.dgramServerBound = false;

    this.log.info('Stopping dgram client for shelly devices...');
    if (this.clientTimeout) clearTimeout(this.clientTimeout);
    this.clientTimeout = undefined;
    if (this.dgramClient) this.dgramClient.close();
    this.dgramClient = undefined;
    this.dgramClientBound = false;

    this.log.info('Stopped dgram server and client for shelly devices.');
  }
}

// Use with: node dist/mcastServer.js testMulticastServer testMulticastClient
if (process.argv.includes('testMulticastServer') || process.argv.includes('testMulticastClient')) {
  const mcast = new Multicast();

  if (process.argv.includes('testMulticastServer')) mcast.startDgramServer();

  if (process.argv.includes('testMulticastClient')) mcast.startDgramClient();

  process.on('SIGINT', async function () {
    mcast.stop();
  });
}
