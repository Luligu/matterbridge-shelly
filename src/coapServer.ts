/**
 * This file contains the class CoapServer.
 *
 * @file src\coapServer.ts
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

import { AnsiLogger, BLUE, CYAN, MAGENTA, RESET, TimestampFormat, db, debugStringify, idn, rs } from 'matterbridge/logger';
import coap, { Server, IncomingMessage, OutgoingMessage, globalAgent } from 'coap';
import EventEmitter from 'events';

// 192.168.1.189:5683

const COIOT_OPTION_GLOBAL_DEVID = '3332';
const COIOT_OPTION_STATUS_VALIDITY = '3412';
const COIOT_OPTION_STATUS_SERIAL = '3420';

const COAP_MULTICAST_ADDRESS = '224.0.1.187';

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

interface CoIoTBlkComponent {
  I: number;
  D: string;
}

interface CoIoTSenProperty {
  I: number;
  T: string;
  D: string;
  U: string;
  R: string | string[];
  L: number;
}

interface CoIoTGValue {
  channel: number;
  id: number;
  value: number | string;
}

interface CoIoTDescription {
  id: number;
  component: string;
  property: string;
  range: string | string[];
}

export class CoapServer extends EventEmitter {
  private readonly log;
  // private readonly coapAgent;
  private coapServer: Server | undefined;
  private _isListening = false;
  private readonly devices = new Map<string, CoIoTDescription[]>();

  constructor(debug = false) {
    super();
    this.log = new AnsiLogger({ logName: 'coapServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });

    this.registerShellyOptions();

    // this.coapAgent = new coap.Agent();
    // this.coapAgent._nextToken = () => Buffer.alloc(0);
  }

  get isListening() {
    return this._isListening;
  }

  getDeviceDescription(host: string, timeout = 60): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting device description from ${host}...`);
    timeout = Math.min(Math.max(Math.round(timeout), 2), 300);

    return new Promise((resolve, reject) => {
      const response = coap
        .request({
          host,
          method: 'GET',
          pathname: '/cit/d',
          // agent: this.coapAgent,
        })
        .on('response', (msg: IncomingMessage) => {
          clearTimeout(timer);
          this.log.debug(`CoIoT (coap) received device description ("/cit/d") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          msg.url = '/cit/d';
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('error', (err) => {
          clearTimeout(timer);
          this.log.error('CoIoT (coap) error getting device description ("/cit/d"):', err);
          reject(err);
        })
        .end();

      const timer = setTimeout(
        () => {
          this.log.debug('CoIoT (coap) request timeout reached');
          response.sender.removeAllListeners();
          response.sender.reset();
          response.end();
          resolve(null);
        },
        (timeout - 1) * 1000,
      );
    });
  }

  getDeviceStatus(host: string, timeout = 60): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting device status from ${host}...`);
    timeout = Math.min(Math.max(Math.round(timeout), 2), 300);

    return new Promise((resolve, reject) => {
      const response = coap
        .request({
          host,
          method: 'GET',
          pathname: '/cit/s',
          // agent: this.coapAgent,
        })
        .on('response', (msg: IncomingMessage) => {
          clearTimeout(timer);
          this.log.debug(`CoIoT (coap) received device status ("/cit/s") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('error', (err) => {
          clearTimeout(timer);
          this.log.error('CoIoT (coap) error getting device status ("/cit/s"):', err);
          reject(err);
        })
        .end();

      const timer = setTimeout(
        () => {
          this.log.debug('CoIoT (coap) request timeout reached');
          response.sender.removeAllListeners();
          response.sender.reset();
          response.end();
          resolve(null);
        },
        (timeout - 1) * 1000,
      );
    });
  }

  getMulticastDeviceStatus(timeout = 60): Promise<IncomingMessage | null> {
    this.log.debug('Requesting CoIoT (coap) multicast device status...');
    timeout = Math.min(Math.max(Math.round(timeout), 2), 300);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, reject) => {
      this.log.debug('Sending CoAP multicast request...');
      const response = coap
        .request({
          host: COAP_MULTICAST_ADDRESS,
          method: 'GET',
          pathname: '/cit/s',
          // agent: this.coapAgent,
          multicast: true,
          multicastTimeout: timeout * 1000,
        })
        .on('response', (msg: IncomingMessage) => {
          clearTimeout(timer);
          this.log.debug(`Multicast device status code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('error', (err) => {
          clearTimeout(timer);
          this.log.error('CoIoT (coap) error requesting multicast device status ("/cit/s"):', err);
          resolve(null);
        })
        .end();
      this.log.debug('Sent CoAP multicast request.');

      this.log.debug('Adding CoAP multicast request timeout');
      const timer = setTimeout(
        () => {
          this.log.debug('Multicast request timeout reached');
          response.sender.removeAllListeners();
          response.sender.reset();
          response.end();
          resolve(null);
        },
        (timeout - 1) * 1000,
      );
    });
  }

  private registerShellyOptions() {
    coap.registerOption(
      COIOT_OPTION_GLOBAL_DEVID,
      (str) => {
        this.log.debug('GLOBAL_DEVID str', str);
        // Ensure that 'str' is a string
        if (typeof str === 'string' || (str && typeof str.toString === 'function')) {
          return Buffer.from(str.toString());
        }
        // Handle null or incompatible types explicitly
        throw new TypeError('Expected a string for GLOBAL_DEVID');
      },
      (buf) => buf.toString(),
    );

    coap.registerOption(
      COIOT_OPTION_STATUS_VALIDITY,
      (str) => {
        this.log.debug('STATUS_VALIDITY str', str);
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16BE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_VALIDITY');
      },
      (buf) => buf.readUInt16BE(0),
    );

    coap.registerOption(
      COIOT_OPTION_STATUS_SERIAL,
      (str) => {
        this.log.debug('STATUS_SERIAL str', str);
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16BE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_SERIAL');
      },
      (buf) => buf.readUInt16BE(0),
    );
  }

  private parseShellyMessage(msg: IncomingMessage) {
    this.log.debug(`Parsing device CoIoT (coap) response...`);

    const host = msg.rsinfo.address;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = msg.headers as any;

    const code = msg.code;
    const url = msg.url;
    let deviceType = '';
    let deviceId = '';
    let protocolRevision = '';
    let validFor = 0;
    let serial = 0;
    let payload;

    if (headers[COIOT_OPTION_GLOBAL_DEVID]) {
      const parts = headers[COIOT_OPTION_GLOBAL_DEVID].split('#');
      deviceType = parts[0];
      deviceId = parts[1];
      protocolRevision = parts[2];
    }

    if (headers[COIOT_OPTION_STATUS_VALIDITY]) {
      const validity = headers[COIOT_OPTION_STATUS_VALIDITY];
      if ((validity & 0x1) === 0) {
        validFor = Math.floor(validity / 10);
      } else {
        validFor = validity * 4;
      }
    }

    if (headers[COIOT_OPTION_STATUS_SERIAL]) {
      serial = headers[COIOT_OPTION_STATUS_SERIAL];
    }

    try {
      payload = JSON.parse(msg.payload.toString());
    } catch {
      payload = msg.payload.toString();
    }

    this.log.debug(`url:  ${BLUE}${url}${db}`);
    this.log.debug(`code: ${BLUE}${code}${db}`);
    this.log.debug(`host: ${idn}${host}${rs}${db}`);
    this.log.debug(`deviceType: ${BLUE}${deviceType}${db}`);
    this.log.debug(`deviceId: ${BLUE}${deviceId}${db}`);
    this.log.debug(`protocolRevision: ${protocolRevision}${db}`);
    this.log.debug(`validFor: ${validFor}`);
    this.log.debug(`serial: ${serial}`);
    this.log.debug(`payload:${RESET}`, payload);

    if (msg.url === '/cit/d') {
      const desc: CoIoTDescription[] = [];
      this.log.debug(`parsing ${MAGENTA}blocks${db}:`);
      const blk: CoIoTBlkComponent[] = payload.blk;
      if (!blk) {
        this.log.error(`No blk found for host ${host} in ${msg.url}`);
        return;
      }
      blk.forEach((b) => {
        this.log.debug(`- block: ${CYAN}${b.I}${db} description ${CYAN}${b.D}${db}`);
        const sen: CoIoTSenProperty[] = payload.sen;
        sen
          .filter((s) => s.L === b.I)
          .forEach((s) => {
            this.log.debug(
              `  - id: ${CYAN}${s.I}${db} type ${CYAN}${s.T}${db} description ${CYAN}${s.D}${db} unit ${CYAN}${s.U}${db} range ${CYAN}${s.R}${db} block ${CYAN}${s.L}${db}`,
            );

            // sys component
            if (s.D === 'mode') desc.push({ id: s.I, component: 'sys', property: 'profile', range: s.R });
            if (s.D === 'deviceTemp' && s.U !== 'F' && b.D === 'device') desc.push({ id: s.I, component: 'sys', property: 'temperature', range: s.R }); // SHSW-25
            if (s.D === 'voltage' && b.D === 'device') desc.push({ id: s.I, component: 'sys', property: 'voltage', range: s.R }); // SHSW-25

            // light component
            if (s.D === 'output') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'state', range: s.R });
            if (s.D === 'brightness') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'brightness', range: s.R });
            if (s.D === 'gain') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'brightness', range: s.R });
            if (s.D === 'red') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'red', range: s.R });
            if (s.D === 'green') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'green', range: s.R });
            if (s.D === 'blue') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'blue', range: s.R });
            if (s.D === 'white') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'white', range: s.R });
            if (s.D === 'power' && b.D.startsWith('light')) desc.push({ id: s.I, component: 'meter:0', property: 'power', range: s.R });
            if (s.D === 'energy' && b.D.startsWith('light')) desc.push({ id: s.I, component: 'meter:0', property: 'total', range: s.R });

            // relay component
            if (s.D === 'power' && b.D.startsWith('relay')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('relay', 'meter'), property: 'power', range: s.R });
            if (s.D === 'energy' && b.D.startsWith('relay')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('relay', 'meter'), property: 'total', range: s.R });

            // roller component
            if (s.D === 'roller') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'state', range: s.R });
            if (s.D === 'rollerPos') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'current_pos', range: s.R });
            if (s.D === 'rollerStopReason') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'stop_reason', range: s.R });
            if (s.D === 'rollerPower') desc.push({ id: s.I, component: 'meter:0', property: 'power', range: s.R });
            if (s.D === 'rollerEnergy') desc.push({ id: s.I, component: 'meter:0', property: 'total', range: s.R });

            // emeter component
            if (s.D === 'voltage' && b.D.startsWith('emeter')) desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'voltage', range: s.R }); // SHEM
            if (s.D === 'power' && b.D.startsWith('emeter')) desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'power', range: s.R });
            if (s.D === 'energy' && b.D.startsWith('emeter')) desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'total', range: s.R });
          });
      });
      this.log.debug(`parsing ${MAGENTA}decoding${db}:`);
      desc.forEach((d) => {
        this.log.debug(`- id ${CYAN}${d.id}${db} component ${CYAN}${d.component}${db} property ${CYAN}${d.property}${db} range ${CYAN}${d.range}${db}`);
      });
      this.devices.set(host, desc);
    }

    if (msg.url === '/cit/s') {
      const descriptions: CoIoTDescription[] = this.devices.get(host) || [];
      if (!descriptions || descriptions.length === 0) {
        // this.log.warn(`No description found for host ${host}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: CoIoTGValue[] = payload.G.map((v: any[]) => ({
        channel: v[0],
        id: v[1],
        value: v[2],
      }));
      this.log.debug(`parsing ${MAGENTA}values${db} (${values.length}):`);
      values.forEach((v) => {
        const desc = descriptions.find((d) => d.id === v.id);
        if (desc) {
          this.log.debug(
            `- channel ${CYAN}${v.channel}${db} id ${CYAN}${v.id}${db} value ${CYAN}${v.value}${db} => ${CYAN}${desc.component}${db} ${CYAN}${desc.property}${db} ${CYAN}${desc.range === '0/1' ? v.value === 1 : v.value}${db}`,
          );
          this.emit('update', host, desc.component, desc.property, desc.range === '0/1' ? v.value === 1 : v.value);
        }
        // else this.log.warn(`No description found for id ${v.id}`);
      });
    }

    return { msg, host, deviceType, deviceId, protocolRevision, validFor, serial, payload } as CoapMessage;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private listenForStatusUpdates(networkInterface?: string) {
    this.coapServer = coap.createServer({
      multicastAddress: COAP_MULTICAST_ADDRESS,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.coapServer.on('request', (msg: IncomingMessage, res: OutgoingMessage) => {
      this.log.debug(`CoIoT (coap) server got a messagge code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}...`);
      if (msg.code === '0.30' && msg.url === '/cit/s') {
        this.parseShellyMessage(msg);
      } else {
        // this.log.warn(`Coap server got a wrong messagge code ${BLUE}${msg.code}${wr} url ${BLUE}${msg.url}${wr} rsinfo ${db}${debugStringify(msg.rsinfo)}...`);
        // console.log(msg);
      }
    });

    this.coapServer.listen((err) => {
      if (err) {
        this.log.warn('CoIoT (coap) server error while listening:', err);
      } else {
        this.log.info('CoIoT (coap) server is listening ...');
      }
    });
  }

  async registerDevice(host: string) {
    this.log.debug(`Registering device ${host}...`);
    await this.getDeviceDescription(host);
    this.log.debug(`Registered device ${host}.`);
  }

  start(debug = false) {
    this.log.setLogDebug(debug);
    if (this._isListening) return;
    this.log.info('Starting CoIoT (coap) server for shelly devices...');
    this._isListening = true;
    this.listenForStatusUpdates();
    this.log.info('Started CoIoT (coap) server for shelly devices.');
  }

  stop() {
    this.log.info('Stopping CoIoT (coap) server for shelly devices...');
    this.removeAllListeners();
    this._isListening = false;
    globalAgent.close();
    // this.coapAgent.close();
    if (this.coapServer) this.coapServer.close();
    this.devices.clear();
    this.log.info('Stopped CoIoT (coap) server for shelly devices.');
  }
}

/*
if (process.argv.includes('coapServer') || process.argv.includes('coapDescription') || process.argv.includes('coapStatus') || process.argv.includes('coapMcast')) {
  const coapServer = new CoapServer(true);

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.219');

  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.219');

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.222');

  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.222');

  if (process.argv.includes('coapMcast')) {
    await coapServer.getMulticastDeviceStatus(30);
    coapServer.stop();
  }

  if (process.argv.includes('coapServer')) coapServer.start(true);

  process.on('SIGINT', async function () {
    coapServer.stop();
    // process.exit();
  });
}
*/
