/**
 * This file contains the class MdnsScanner.
 *
 * @file src\mdnsScanner.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 1.2.4
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
 * limitations under the License. *
 */

import { AnsiLogger, BLUE, CYAN, LogLevel, TimestampFormat, db, debugStringify, er, hk, idn, ign, nf, rs, zb } from 'matterbridge/logger';
import mdns, { QueryPacket, ResponsePacket } from 'multicast-dns';
import EventEmitter from 'node:events';
import { RemoteInfo, SocketType } from 'node:dgram';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ShellyDeviceId } from './shellyTypes.js';
// import { getIpv4InterfaceAddress, getIpv6InterfaceAddress } from 'matterbridge/utils';

export interface DiscoveredDevice {
  id: ShellyDeviceId;
  host: string;
  port: number;
  gen: number;
}

export type DiscoveredDeviceListener = (data: DiscoveredDevice) => void;

interface MdnsScannerEvent {
  discovered: [{ id: ShellyDeviceId; host: string; port: number; gen: number }];
  query: [{ type: string; name: string; class?: string }];
}

/**
 * Creates an instance of MdnsScanner.
 * @param {LogLevel} logLevel - The log level for the scanner. Defaults to LogLevel.INFO.
 */
export class MdnsScanner extends EventEmitter {
  private devices = new Map<string, string>();
  private discoveredDevices = new Map<string, DiscoveredDevice>();
  public readonly log;
  private scanner?: mdns.MulticastDNS;
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;
  private queryTimeout?: NodeJS.Timeout;
  private queryInterval?: NodeJS.Timeout;
  private _dataPath = 'temp';

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.log = new AnsiLogger({ logName: 'ShellyMdnsScanner', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });
  }

  override emit<K extends keyof MdnsScannerEvent>(eventName: K, ...args: MdnsScannerEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof MdnsScannerEvent>(eventName: K, listener: (...args: MdnsScannerEvent[K]) => void): this {
    return super.on(eventName, listener);
  }

  /**
   * Sets the data path.
   *
   * @param {string} path - The new data path.
   */
  set dataPath(path: string) {
    this._dataPath = path;
  }

  /**
   * Gets a value indicating whether the MdnsScanner is currently scanning.
   *
   * @returns {boolean} A boolean value indicating whether the MdnsScanner is scanning.
   */
  get isScanning(): boolean {
    return this._isScanning;
  }

  /**
   * Sends an mDNS query for shelly devices.
   */
  sendQuery() {
    this.scanner?.query([
      { name: '_http._tcp.local', type: 'PTR' },
      { name: '_shelly._tcp.local', type: 'PTR' },
      { name: '_services._dns-sd._udp.local', type: 'PTR' },
    ]);
    this.scanner?.query([{ name: '_shelly._tcp.local', type: 'PTR', class: 'IN' }]);
    this.log.debug('Sent mDNS query for shelly devices.');
  }

  /**
   * Starts the mDNS query service for shelly devices.
   *
   * @param {number} scannerTimeout - The timeout value in milliseconds to stop the MdnsScanner (optional, if not provided the MdnsScanner will not stop).
   * @param {number} queryTimeout - The timeout value in milliseconds to stop the query service (optional, if not provided the query service will not stop).
   * @param {string} mdnsInterface - Explicitly specify a network interface name. Will use all interfaces when not specified.
   * @param {SocketType} type - Explicitly specify a socket type: "udp4" | "udp6". Default is "udp4".
   * @param {boolean} debug - Indicates whether to enable debug mode (default: false).
   */
  start(scannerTimeout?: number, queryTimeout?: number, mdnsInterface?: string, type?: SocketType, debug = false) {
    if (this._isScanning) return;
    this._isScanning = true;

    // Create and initialize the mDNS scanner
    if (mdnsInterface && mdnsInterface !== '' && type && (type === 'udp4' || type === 'udp6')) {
      const mdnsOptions: mdns.Options = {};
      mdnsOptions.interface = mdnsInterface;
      mdnsOptions.bind = mdnsOptions.interface;
      mdnsOptions.type = type;
      mdnsOptions.ip = type === 'udp4' ? '224.0.0.251' : 'ff02::fb';
      mdnsOptions.port = 5353;
      mdnsOptions.multicast = true;
      mdnsOptions.reuseAddr = true;
      this.log.info(
        `Starting MdnsScanner for shelly devices (interface ${mdnsOptions.interface} bind ${mdnsOptions.bind} type ${mdnsOptions.type} ip ${mdnsOptions.ip}) for shelly devices...`,
      );
      this.scanner = mdns(mdnsOptions);
    } else {
      this.log.info('Starting MdnsScanner for shelly devices...');
      this.scanner = mdns();
    }

    this.scanner.on('response', async (response: ResponsePacket, rinfo: RemoteInfo) => {
      let port = 80; // shellymotionsensor, shellymotion2 send A record before SRV
      let gen = 1;
      this.devices.set(rinfo.address, rinfo.address);
      if (debug) this.log.debug(`Mdns response from ${ign} ${rinfo.address} family ${rinfo.family} port ${rinfo.port} ${rs}${db} id ${response.id} flags ${response.flags}`);
      if (debug) this.log.debug(`--- response.questions[${response.questions.length}] ---`);
      for (const q of response.questions) {
        if (debug) this.log.debug(`[${idn}${q.type}${rs}${db}] Name: ${CYAN}${q.name}${db} class: ${CYAN}${q.class}${db}`);
      }

      if (debug) this.log.debug(`--- response.answers[${response.answers.length}] ---`);
      for (const a of response.answers) {
        if (a.type === 'SRV' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          port = a.data.port;
        }
        if (a.type === 'TXT' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          if (a.data.toString().includes('gen=2')) gen = 2;
          if (a.data.toString().includes('gen=3')) gen = 3;
          if (a.data.toString().includes('gen=4')) gen = 4;
        }
      }
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
        if (debug && a.type === 'NSEC') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (a.type === 'A' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          // const [name, mac] = a.name.replace('.local', '').split('-');
          // const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          const deviceId = this.normalizeShellyId(a.name);
          if (deviceId && (!this.discoveredDevices.has(deviceId) || this.discoveredDevices.get(deviceId)?.host !== a.data)) {
            this.log.debug(`MdnsScanner discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
            if (debug || process.argv.includes('testMdnsScanner')) {
              this.saveResponse(deviceId, response); // No await
            }
          }
        }
      }
      if (debug) this.log.debug(`--- response.additionals[${response.additionals.length}] ---`);
      for (const a of response.additionals) {
        if (a.type === 'SRV' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          port = a.data.port;
        }
        if (a.type === 'TXT' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          if (a.data.toString().includes('gen=2')) gen = 2;
          if (a.data.toString().includes('gen=3')) gen = 3;
          if (a.data.toString().includes('gen=4')) gen = 4;
        }
      }
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
        if (debug && a.type === 'NSEC') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (a.type === 'A' && (a.name.startsWith('shelly') || a.name.startsWith('Shelly'))) {
          // const [name, mac] = a.name.replace('.local', '').split('-');
          // const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          const deviceId = this.normalizeShellyId(a.name);
          if (deviceId && (!this.discoveredDevices.has(deviceId) || this.discoveredDevices.get(deviceId)?.host !== a.data)) {
            this.log.debug(`MdnsScanner discovered shelly gen: ${CYAN}${gen}${nf} device id: ${hk}${deviceId}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredDevices.set(deviceId, { id: deviceId, host: a.data, port, gen });
            this.emit('discovered', { id: deviceId, host: a.data, port, gen });
            if (debug || process.argv.includes('testMdnsScanner')) {
              this.saveResponse(deviceId, response); // No await
            }
          }
        }
      }
      if (debug) this.log.debug(`--- response.authorities[${response.authorities.length}] ---`);
      if (debug) this.log.debug(`--- end ---\n`);
    });

    this.scanner.on('query', (query: QueryPacket, rinfo: RemoteInfo) => {
      if (debug) this.log.debug(`Mdns query from ${idn} ${rinfo.address} family ${rinfo.family} port ${rinfo.port} ${rs}${db} id ${query.id} flags ${query.flags}`);
      if (debug) this.log.debug(`--- query.questions[${query.questions.length}] ---`);
      for (const q of query.questions) {
        if (debug) this.log.debug(`[${ign}${q.type}${rs}${db}] Name: ${CYAN}${q.name}${db} class: ${CYAN}${q.class}${db}`);
        this.emit('query', { type: q.type, name: q.name, class: q.class });
      }
      if (debug) this.log.debug(`--- query.answers[${query.answers.length}] ---`);
      if (debug) this.log.debug(`--- query.additionals[${query.additionals.length}] ---`);
      if (debug) this.log.debug(`--- query.authorities[${query.authorities.length}] ---`);
      if (debug) this.log.debug(`--- end ---\n`);
    });

    this.scanner.on('error', async (err: Error) => {
      this.log.error(`Error in mDNS query service: ${err.message}`);
    });

    this.scanner.on('warning', async (err: Error) => {
      this.log.warn(`Warning in mDNS query service: ${err.message}`);
    });

    this.scanner.on('ready', async () => {
      this.log.debug(`The mDNS socket is bound`);
    });

    // Send the query and set the timeout to send it again every 60 seconds
    this.sendQuery();
    this.queryInterval = setInterval(() => {
      this.sendQuery();
    }, 60 * 1000);

    // Set the timeout to stop the scanner if it is defined
    if (scannerTimeout && scannerTimeout > 0) {
      this.scannerTimeout = setTimeout(() => {
        this.stop();
      }, scannerTimeout);
    }

    // Set the timeout to stop the query if it is defined
    if (queryTimeout && queryTimeout > 0) {
      this.queryTimeout = setTimeout(() => {
        if (this.queryInterval) clearInterval(this.queryInterval);
        this.queryInterval = undefined;
        this.log.info('Stopped MdnsScanner query service for shelly devices.');
      }, queryTimeout);
    }
    this.log.info('Started MdnsScanner for shelly devices.');
  }

  /**
   * Stops the MdnsScanner query service.
   */
  stop(keepAlive = false) {
    this.log.info('Stopping MdnsScanner for shelly devices...');
    if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
    this.scannerTimeout = undefined;
    if (this.queryTimeout) clearTimeout(this.queryTimeout);
    this.queryTimeout = undefined;
    if (this.queryInterval) clearTimeout(this.queryInterval);
    this.queryInterval = undefined;
    this._isScanning = false;
    if (keepAlive) return;
    this.scanner?.removeAllListeners();
    this.scanner?.destroy();
    this.scanner = undefined;
    this.removeAllListeners();
    this.logPeripheral();
    this.log.info('Stopped MdnsScanner for shelly devices.');
  }

  /**
   * Normalizes a Shelly device ID by converting it to a standard format.
   * @param {string} shellyId - The Shelly device ID to normalize.
   * @returns {string | undefined} The normalized Shelly device ID, or undefined if the ID is invalid.
   * @example
   * // Normalize a Shelly device ID
   * const normalizedId = mdnsScanner.normalizeShellyId('ShellyPlug-S-c38345.local');
   * console.log(normalizedId); // Output: 'shellyplug-s-C38345'
   */
  normalizeShellyId(shellyId: string): string | undefined {
    const parts = shellyId.replace('.local', '').split('-');
    if (parts.length < 2) return undefined;
    const mac = parts.pop(); // Extract the MAC address (last part)
    if (!mac) return undefined;
    const name = parts.join('-'); // Join the remaining parts to form the device name
    return name.toLowerCase() + '-' + mac.toUpperCase();
  }

  /**
   * Logs information about discovered shelly devices and sort them.
   * @returns The number of the discovered shelly devices.
   */
  logPeripheral() {
    this.log.debug(`Discovered ${this.devices.size} devices:`);
    // Convert the Map to an array and sort by host
    const sortedDevices = Array.from(this.devices).sort((a, b) => {
      const hostA = a[1].toLowerCase();
      const hostB = b[1].toLowerCase();
      if (hostA >= hostB) return 1;
      else return -1;
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [name, host] of sortedDevices) {
      this.log.debug(`- host: ${zb}${host}${nf}`);
    }

    this.log.info(`Discovered ${this.discoveredDevices.size} shelly devices:`);
    // Convert the Map to an array and sort by id
    const sortedDiscoveredDevices = Array.from(this.discoveredDevices).sort((a, b) => {
      const idA = a[1].id;
      const idB = b[1].id;
      if (idA >= idB) return 1;
      else return -1;
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [name, { id, host, port, gen }] of sortedDiscoveredDevices) {
      this.log.info(`- id: ${hk}${name}${nf} host: ${zb}${host}${nf} port: ${zb}${port}${nf} gen: ${CYAN}${gen}${nf}`);
    }
    return this.discoveredDevices.size;
  }

  /**
   * Saves the response packet to a file.
   *
   * @param {shellyId} shellyId - The ID of the Shelly device.
   * @param {ResponsePacket} response - The response packet to be saved.
   * @returns {Promise<void>} A promise that resolves when the response is successfully saved, or rejects with an error.
   */
  async saveResponse(shellyId: string, response: ResponsePacket): Promise<void> {
    const responseFile = path.join(this._dataPath, `${shellyId}.mdns.json`);
    try {
      await fs.mkdir(this._dataPath, { recursive: true });
      this.log.debug(`Successfully created directory ${this._dataPath}`);

      for (const a of response.answers) {
        if (a.type === 'TXT') {
          if (Buffer.isBuffer(a.data)) a.data = a.data.toString();
          if (Array.isArray(a.data)) a.data = a.data.map((d) => (Buffer.isBuffer(d) ? d.toString() : d));
        }
      }
      for (const a of response.additionals) {
        if (a.type === 'TXT') {
          if (Buffer.isBuffer(a.data)) a.data = a.data.toString();
          if (Array.isArray(a.data)) a.data = a.data.map((d) => (Buffer.isBuffer(d) ? d.toString() : d));
        }
      }
      await fs.writeFile(responseFile, JSON.stringify(response, null, 2), 'utf8');
      this.log.debug(`Saved shellyId ${hk}${shellyId}${db} response file ${CYAN}${responseFile}${db}`);
      return Promise.resolve();
    } catch (err) {
      this.log.error(`Error saving shellyId ${hk}${shellyId}${er} response file ${CYAN}${responseFile}${er}: ${err instanceof Error ? err.message : err}`);
      return Promise.reject(err);
    }
  }
}

// Use with: node dist/mdnsScanner.js testMdnsScanner
// Additional debug logging
// const ipConfigCommand = isWindows ? 'ipconfig' : 'ip a';
// const multicastCommand = isWindows ? 'netsh interface ipv4 show joins' : 'ip maddr show';
/*
if (process.argv.includes('testMdnsScanner')) {
  console.log(`Starting MdnsScanner with host interface ipv4="${getIpv4InterfaceAddress()}" ipv6="${getIpv6InterfaceAddress()}" ...`);
  const mdnsScannerIpv4 = new MdnsScanner(LogLevel.DEBUG);
  const mdnsScannerIpv6 = new MdnsScanner(LogLevel.DEBUG);
  // mdnsScanner.start(0, 'fd78:cbf8:4939:746:d555:85a9:74f6:9c6', 'udp6', true);
  // mdnsScannerIpv6.start(0, '::', 'udp6', true);
  // mdnsScanner.start(0, '192.168.1.189', 'udp4', true);
  mdnsScannerIpv4.start(0, getIpv4InterfaceAddress(), 'udp4', true);
  mdnsScannerIpv6.start(0, getIpv6InterfaceAddress(), 'udp6', true);
  // mdnsScanner.start(0, undefined, undefined, true);

  process.on('SIGINT', async function () {
    mdnsScannerIpv4.stop();
    mdnsScannerIpv6.stop();
  });
}
[12:58:57.941] [ShellyMdnsScanner] Mdns query from  192.168.1.40 family IPv4 port 5353
[12:58:57.941] [ShellyMdnsScanner] --- query.questions[1] ---
[12:58:57.941] [ShellyMdnsScanner] [PTR] Name: _shelly._tcp.local class: UNKNOWN_32769
[12:58:57.941] [ShellyMdnsScanner] --- end ---

[12:58:58.202] [ShellyMdnsScanner] Mdns query from  192.168.1.40 family IPv4 port 5353
[12:58:58.203] [ShellyMdnsScanner] --- query.questions[1] ---
[12:58:58.203] [ShellyMdnsScanner] [PTR] Name: _shelly._tcp.local class: IN
[12:58:58.203] [ShellyMdnsScanner] --- end ---

[12:58:59.228] [ShellyMdnsScanner] Mdns query from  192.168.1.40 family IPv4 port 5353
[12:58:59.228] [ShellyMdnsScanner] --- query.questions[3] ---
[12:58:59.228] [ShellyMdnsScanner] [PTR] Name: _shelly._tcp.local class: IN
[12:58:59.228] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus1PM-CC7B5C0AB624.local class: UNKNOWN_32769
[12:58:59.229] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus2PM-08F9E0FD173C.local class: UNKNOWN_32769
[12:58:59.229] [ShellyMdnsScanner] --- end ---

[12:58:59.231] [ShellyMdnsScanner] Mdns query from  192.168.1.40 family IPv4 port 5353
[12:58:59.231] [ShellyMdnsScanner] --- query.questions[12] ---
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlusRGBWPM-ECC9FF4CEAF0.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus010V-80646FE1FAC4.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus2PM-1C692044F140.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlusI4-D48AFC41B6F4.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyBluGw-B0B21CFAAD18.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlusPlugS-E86BEAEAA000.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus2PM-5443B23D81F8.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus1PM-441793D69718.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus2PM-30C922810DA0.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: Shelly2PMG3-34CDB0770C4C.local class: UNKNOWN_32769
[12:58:59.231] [ShellyMdnsScanner] [AAAA] Name: Shelly1G3-DCDA0CDEEC20.local class: UNKNOWN_32769
[12:58:59.232] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus2PM-30C92286CB68.local class: UNKNOWN_32769
[12:58:59.232] [ShellyMdnsScanner] --- end ---

[12:58:59.739] [ShellyMdnsScanner] Mdns query from  192.168.1.40 family IPv4 port 5353
[12:58:59.739] [ShellyMdnsScanner] --- query.questions[2] ---
[12:58:59.739] [ShellyMdnsScanner] [AAAA] Name: ShellyPlus1-E465B8F3028C.local class: UNKNOWN_32769
[12:58:59.740] [ShellyMdnsScanner] [AAAA] Name: ShellyBluGw-B0B21CFC5080.local class: UNKNOWN_32769
*/
