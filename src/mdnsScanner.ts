/**
 * This file contains the class MdnsScanner.
 *
 * @file src\mdnsScanner.ts
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

import { AnsiLogger, BLUE, CYAN, LogLevel, TimestampFormat, db, debugStringify, hk, idn, nf, rs, zb } from 'matterbridge/logger';
import mdns, { ResponsePacket } from 'multicast-dns';
import EventEmitter from 'events';

export interface DiscoveredDevice {
  id: string;
  host: string;
  port: number;
  gen: number;
}

export type DiscoveredDeviceListener = (data: DiscoveredDevice) => void;

/**
 * Creates an instance of MdnsScanner.
 * @param {LogLevel} logLevel - The log level for the scanner. Defaults to LogLevel.INFO.
 */
export class MdnsScanner extends EventEmitter {
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  public readonly log;
  private scanner?: mdns.MulticastDNS;
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;
  private queryTimeout?: NodeJS.Timeout;

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.log = new AnsiLogger({ logName: 'ShellyMdnsDiscover', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
  }

  /**
   * Gets a value indicating whether the MdnsScanner is currently scanning.
   *
   * @returns {boolean} A boolean value indicating whether the MdnsScanner is scanning.
   */
  get isScanning() {
    return this._isScanning;
  }

  /**
   * Sends an mDNS query for shelly devices.
   */
  private sendQuery() {
    this.scanner?.query([
      { name: '_http._tcp.local', type: 'PTR' },
      { name: '_shelly._tcp.local', type: 'PTR' },
    ]);
    this.log.debug('Sent mDNS query for shelly devices.');
  }

  /**
   * Starts the mDNS query service for shelly devices.
   *
   * @param {number} shutdownTimeout - The timeout value in milliseconds to stop the MdnsScanner (optional, if not provided the MdnsScanner will not stop).
   * @param {boolean} debug - Indicates whether to enable debug mode (default: false).
   */
  start(shutdownTimeout?: number, debug = false) {
    this.log.debug('Starting mDNS query service for shelly devices...');
    this._isScanning = true;

    this.scanner = mdns();
    this.scanner.on('response', async (response: ResponsePacket) => {
      let port = 0;
      let gen = 1;
      if (debug) this.log.debug(`***--- start ---`);
      // if (debug && response.answers.length === 0 && response.additionals.length === 0) this.log.debug('ResponsePacket:\n', response);
      if (debug) this.log.debug(`--- response.answers ---`);
      for (const a of response.answers) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          // this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'PTR' && a.name === '_http._tcp.local') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'NSEC' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'SRV' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
        }
        if (a.type === 'SRV' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          port = a.data.port;
        }
        if (a.type === 'TXT' && a.name.startsWith('Shelly') && a.data.toString() === 'gen=2') {
          gen = 2;
        }
        if (a.type === 'A' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          const [name, mac] = a.name.replace('.local', '').split('-');
          const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          if (!this.discoveredDevices.has(deviceId)) {
            this.log.info(`Discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
          }
        }
      }
      if (debug) this.log.debug(`--- response.additionals ---`);
      for (const a of response.additionals) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          // this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'PTR' && a.name === '_http._tcp.local') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'NSEC' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'SRV') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
        }
        if (a.type === 'SRV' && a.name.startsWith('shelly')) {
          port = a.data.port;
        }
        if (a.type === 'TXT' && a.name.startsWith('shelly')) {
          gen = parseInt(a.data.toString().replace('gen=', ''));
        }
        if (a.type === 'A' && a.name.startsWith('Shelly')) {
          const [name, mac] = a.name.replace('.local', '').split('-');
          const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          if (!this.discoveredDevices.has(deviceId)) {
            this.log.info(`Discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
          }
        }
      }
      if (debug) this.log.debug(`--- end ---`);
    });

    // Send the query and set the timeout to send it again every 60 seconds
    this.sendQuery();
    this.queryTimeout = setInterval(() => {
      this.sendQuery();
    }, 60 * 1000);

    // Set the timeout to stop the scanner if it is defined
    if (shutdownTimeout && shutdownTimeout > 0) {
      this.scannerTimeout = setTimeout(() => {
        this.stop();
      }, shutdownTimeout);
    }
    this.log.debug('Started mDNS query service for shelly devices.');
  }

  /**
   * Stops the MdnsScanner query service.
   */
  stop() {
    this.log.debug('Stopping mDNS query service...');
    if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
    this.scannerTimeout = undefined;
    if (this.queryTimeout) clearTimeout(this.queryTimeout);
    this.queryTimeout = undefined;
    this._isScanning = false;
    this.scanner?.removeAllListeners();
    this.scanner?.destroy();
    this.scanner = undefined;
    this.removeAllListeners();
    this.logPeripheral();
    this.log.debug('Stopped mDNS query service.');
  }

  /**
   * Logs information about discovered shelly devices.
   * @returns The number of discovered devices.
   */
  logPeripheral() {
    this.log.info(`Discovered ${this.discoveredDevices.size} shelly devices:`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [name, { id, host, port, gen }] of this.discoveredDevices) {
      this.log.info(`- id: ${hk}${name}${nf} host: ${zb}${host}${nf} port: ${zb}${port}${nf} gen: ${CYAN}${gen}${nf}`);
    }
    return this.discoveredDevices.size;
  }
}

/*
// node dist/mdnsScanner.js mdnsScanner
if (process.argv.includes('mdnsScanner')) {
  const mdnsScanner = new MdnsScanner(true);
  mdnsScanner.start(undefined, true);

  process.on('SIGINT', async function () {
    mdnsScanner.stop();
    // process.exit();
  });
}
*/
