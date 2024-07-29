/**
 * This file contains the class MdnsScanner.
 *
 * @file src\mdnsScanner.ts
 * @author Luca Liguori
 * @date 2024-05-01
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

import { AnsiLogger, BLUE, CYAN, LogLevel, MAGENTA, TimestampFormat, db, debugStringify, hk, idn, nf, rs, zb } from 'matterbridge/logger';
import mdns, { ResponsePacket } from 'multicast-dns';
import EventEmitter from 'events';
import { RemoteInfo, SocketType } from 'dgram';

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
    this.log = new AnsiLogger({ logName: 'ShellyMdnsScanner', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
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
   * @param {string} interfaceAddress - Explicitly specify a network interface address. Will use all interfaces when not specified.
   * @param {SocketType} type - Explicitly specify a socket type: "udp4" | "udp6". Default is "udp4".
   * @param {boolean} debug - Indicates whether to enable debug mode (default: false).
   */
  start(shutdownTimeout?: number, interfaceAddress?: string, type?: SocketType, debug = false) {
    this.log.debug('Starting mDNS query service for shelly devices...');
    this._isScanning = true;

    // Create and initialize the mDNS scanner
    const mdnsOptions: mdns.Options = {};
    if (interfaceAddress && interfaceAddress !== '' && type && (type === 'udp4' || type === 'udp6')) {
      mdnsOptions.interface = interfaceAddress;
      mdnsOptions.type = type;
      mdnsOptions.ip = type === 'udp4' ? '224.0.0.251' : 'ff02::fb';
    }
    this.scanner = mdns(mdnsOptions);

    this.scanner.on('response', async (response: ResponsePacket, rinfo: RemoteInfo) => {
      let port = 0;
      let gen = 1;
      if (debug) this.log.debug(`***--- response from ${MAGENTA}${rinfo.address} ${rinfo.family} ${rinfo.port} ${rinfo.size}${db} ---`);
      if (debug) this.log.debug(`*--- response.answers ---`);
      for (const a of response.answers) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          if (typeof a.data === 'string') this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
          else if (Buffer.isBuffer(a.data)) this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data.toString()}`);
          else if (Array.isArray(a.data)) this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data.map((d) => d.toString()).join(', ')}`);
        }
        if (debug && a.type === 'SRV') {
          this.log.debug(
            `[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} target: ${a.data.target} port: ${a.data.port} priority: ${a.data.priority} weight: ${a.data.weight}`,
          );
        }
        if (debug && a.type === 'A') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
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
            this.log.info(`MdnsScanner discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
            console.log('Response:', response, 'Rinfo:', rinfo);
          }
        }
      }
      if (debug) this.log.debug(`*--- response.additionals ---`);
      for (const a of response.additionals) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          if (typeof a.data === 'string') this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
          else if (Buffer.isBuffer(a.data)) this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data.toString()}`);
          else if (Array.isArray(a.data)) this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data.map((d) => d.toString()).join(', ')}`);
        }
        if (debug && a.type === 'SRV') {
          this.log.debug(
            `[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} target: ${a.data.target} port: ${a.data.port} priority: ${a.data.priority} weight: ${a.data.weight}`,
          );
        }
        if (debug && a.type === 'A') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
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
            this.log.info(`MdnsScanner discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
            console.log('Response:', response, 'Rinfo:', rinfo);
          }
        }
      }
      if (debug) this.log.debug(`--- end ---\n\n`);
    });

    this.scanner.on('error', async (err: Error) => {
      this.log.error(`Error in mDNS query service: ${err.message}`);
    });

    this.scanner.on('warning', async (err: Error) => {
      this.log.error(`Warning in mDNS query service: ${err.message}`);
    });

    this.scanner.on('ready', async () => {
      //
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

// Use with: node dist/mdnsScanner.js testMdnsScanner
if (process.argv.includes('testMdnsScanner')) {
  const mdnsScanner = new MdnsScanner(LogLevel.DEBUG);
  // mdnsScanner.start(0, 'fd78:cbf8:4939:746:d555:85a9:74f6:9c6', 'udp6', true);
  // mdnsScanner.start(0, undefined, 'udp4', true);
  // mdnsScanner.start(0, '192.168.1.189', 'udp4', true);
  mdnsScanner.start(0, undefined, undefined, true);

  process.on('SIGINT', async function () {
    mdnsScanner.stop();
  });
}
