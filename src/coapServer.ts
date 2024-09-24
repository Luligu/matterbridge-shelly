/**
 * This file contains the class CoapServer.
 *
 * @file src\coapServer.ts
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

import { AnsiLogger, BLUE, CYAN, LogLevel, MAGENTA, RESET, TimestampFormat, db, debugStringify, er, hk, idn, rs, zb } from 'matterbridge/logger';
import coap, { Server, IncomingMessage, OutgoingMessage, globalAgent, parameters } from 'coap';
import EventEmitter from 'events';
import path from 'path';
import { promises as fs } from 'fs';

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
  public readonly log;
  private coapServer: Server | undefined;
  private _isListening = false;
  private _debug = false;
  private readonly devices = new Map<string, CoIoTDescription[]>();
  private readonly deviceSerial = new Map<string, number>();
  private _dataPath = 'temp';

  constructor(logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.log = new AnsiLogger({ logName: 'ShellyCoapServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });

    // Set the CoAP parameters to minimum values
    parameters.maxRetransmit = 1;
    parameters.maxLatency = 1;
    if (parameters.refreshTiming) parameters.refreshTiming();

    this.registerShellyOptions();
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
   * Sets the debug mode.
   *
   * @param {boolean} debug - The new debug mode.
   */
  set debug(debug: boolean) {
    this._debug = debug;
  }

  /**
   * Indicates whether the CoAP server is currently listening for incoming requests.
   *
   * @returns {boolean} A boolean value indicating whether the CoAP is listening.
   */
  get isListening(): boolean {
    return this._isListening;
  }

  /**
   * Retrieves the device description from the specified host using CoAP protocol.
   * @param {string} host The host from which to retrieve the device description.
   * @param {string} id - The id to request the device status from (default undefined).
   * @returns {Promise<IncomingMessage | null>} A Promise that resolves with the IncomingMessage object representing the response, or null if the request times out.
   */
  async getDeviceDescription(host: string, id?: string): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting CoIoT (coap) device description from ${hk}${id ? id + ' ' : ''}${db}${zb}${host}${db}...`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, reject) => {
      coap
        .request({
          host,
          method: 'GET',
          pathname: '/cit/d',
          retrySend: 0,
        })
        .on('response', (msg: IncomingMessage) => {
          this.log.debug(`CoIoT (coap) received device description ("/cit/d") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          msg.url = '/cit/d';
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('timeout', (err) => {
          this.log.error(
            `CoIoT (coap) timeout requesting device description ("/cit/d") from ${hk}${id ? id + ' ' : ''}${er}${zb}${host}${er}: ${err instanceof Error ? err.message : err}`,
          );
          resolve(null);
        })
        .on('error', (err) => {
          this.log.error(
            `CoIoT (coap) error requesting device description ("/cit/d") from ${hk}${id ? id + ' ' : ''}${er}${zb}${host}${er}: ${err instanceof Error ? err.message : err}`,
          );
          resolve(null);
        })
        .end();
      this.log.debug(`Sent CoIoT (coap) device description request to ${hk}${id ? id + ' ' : ''}${db}${zb}${host}${db}.`);
    });
  }

  /**
   * Retrieves the device status from the specified host.
   * @param {string} host - The host to request the device status from.
   * @param {string} id - The id to request the device status from (default undefined).
   * @returns {Promise<IncomingMessage | null>} A Promise that resolves with the IncomingMessage containing the device status, or null if the request times out.
   */
  async getDeviceStatus(host: string, id?: string): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting CoIoT (coap) device status from ${hk}${id ? id + ' ' : ''}${db}${zb}${host}${db}...`);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, reject) => {
      coap
        .request({
          host,
          method: 'GET',
          pathname: '/cit/s',
        })
        .on('response', (msg: IncomingMessage) => {
          this.log.debug(`CoIoT (coap) received device status ("/cit/s") code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('timeout', (err) => {
          this.log.error(
            `CoIoT (coap) timeout requesting device status ("/cit/s") from ${hk}${id ? id + ' ' : ''}${er}${zb}${host}${er}: ${err instanceof Error ? err.message : err}`,
          );
          resolve(null);
        })
        .on('error', (err) => {
          this.log.error(
            `CoIoT (coap) error requesting device status ("/cit/s") from ${hk}${id ? id + ' ' : ''}${er}${zb}${host}${er}: ${err instanceof Error ? err.message : err}`,
          );
          resolve(null);
        })
        .end();
      this.log.debug(`Sent CoIoT (coap) device status request to ${hk}${id ? id + ' ' : ''}${db}${zb}${host}${db}.`);
    });
  }

  /**
   * Retrieves the multicast device status using CoIoT (coap) protocol.
   * @param {number} timeout The timeout value in seconds (default: 60)
   * @returns {Promise<IncomingMessage | null>} A Promise that resolves with the IncomingMessage object or null if an error occurs or the timeout is reached.
   */
  async getMulticastDeviceStatus(timeout = 60): Promise<IncomingMessage | null> {
    this.log.debug('Requesting CoIoT (coap) multicast device status...');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return new Promise((resolve, reject) => {
      this.log.debug('Sending CoAP multicast request...');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const response = coap
        .request({
          host: COAP_MULTICAST_ADDRESS,
          method: 'GET',
          pathname: '/cit/s',
          multicast: true,
          multicastTimeout: timeout * 1000,
        })
        .on('response', (msg: IncomingMessage) => {
          this.log.debug(`Multicast device status code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}:`);
          this.parseShellyMessage(msg);
          resolve(msg);
        })
        .on('timeout', (err) => {
          this.log.error('CoIoT (coap) timeout requesting multicast device status ("/cit/s"):', err instanceof Error ? err.message : err);
          resolve(null);
        })
        .on('error', (err) => {
          this.log.error('CoIoT (coap) error requesting multicast device status ("/cit/s"):', err instanceof Error ? err.message : err);
          resolve(null);
        })
        .end();
      this.log.debug('Sent CoIoT (coap) multicast device status request');
    });
  }

  /**
   * Register the Shelly CoIoT options with the coap server.
   */
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

  /**
   * Parses the Shelly message received from the CoIoT (coap) response.
   *
   * @param {IncomingMessage} msg - The incoming message object.
   * @returns {CoapMessage} An object containing the parsed information from the message.
   */
  private parseShellyMessage(msg: IncomingMessage) {
    this.log.debug(`Parsing device CoIoT (coap) response from ${zb}${msg.rsinfo.address}${db}...`);

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

    if (url === '/cit/s' && this.deviceSerial.get(host) === serial && !['SHDW-1', 'SHDW-2'].includes(deviceType)) {
      this.log.debug(`No updates (serial not changed) for host ${zb}${host}${db}`);
      return;
    }

    try {
      payload = JSON.parse(msg.payload.toString());
    } catch {
      payload = msg.payload.toString();
    }

    this.log.debug(`url:  ${CYAN}${url}${db}`);
    this.log.debug(`code: ${CYAN}${code}${db}`);
    this.log.debug(`host: ${idn}${host}${rs}${db}`);
    this.log.debug(`deviceType: ${CYAN}${deviceType}${db}`);
    this.log.debug(`deviceId: ${CYAN}${deviceId}${db}`);
    this.log.debug(`protocolRevision: ${CYAN}${protocolRevision}${db}`);
    this.log.debug(`validFor: ${CYAN}${validFor}${db} seconds`);
    this.log.debug(`serial (${this.deviceSerial.get(host) === serial ? 'not changed' : 'updated'}): ${CYAN}${serial}${db}`);
    this.log.debug(`payload:${RESET}\n`, payload);

    if (msg.url === '/cit/d') {
      if (this._debug) this.saveResponse(deviceType + '-' + deviceId + '.coap.citd.json', payload);
      const desc: CoIoTDescription[] = [];
      this.log.debug(`parsing ${MAGENTA}blocks${db}:`);
      const blk: CoIoTBlkComponent[] = payload.blk;
      if (!blk) {
        this.log.error(`No blk found for host ${zb}${host}${er} in ${msg.url}`);
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
            if (s.D === 'overtemp' && b.D === 'device') desc.push({ id: s.I, component: 'sys', property: 'overtemperature', range: s.R }); // SHSW-25
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
            if (s.D === 'current' && b.D.startsWith('emeter')) desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'current', range: s.R });

            // sensor component
            if (s.D === 'inputEvent' && b.D.startsWith('sensor'))
              desc.push({ id: s.I, component: b.D.replace('_', ':').replace('sensor', 'input'), property: 'event', range: s.R }); // SHBTN-2
            if (s.D === 'inputEventCnt' && b.D.startsWith('sensor'))
              desc.push({ id: s.I, component: b.D.replace('_', ':').replace('sensor', 'input'), property: 'event_cnt', range: s.R }); // SHBTN-2

            // battery component
            if (s.D === 'battery' && b.D === 'device') desc.push({ id: s.I, component: 'battery', property: 'level', range: s.R }); // SHBTN-2
            if (s.D === 'charger' && b.D === 'device') desc.push({ id: s.I, component: 'battery', property: 'charging', range: s.R }); // SHBTN-2
          });
      });
      this.log.debug(`parsing ${MAGENTA}decoding${db}:`);
      desc.forEach((d) => {
        this.log.debug(`- id ${CYAN}${d.id}${db} component ${CYAN}${d.component}${db} property ${CYAN}${d.property}${db} range ${CYAN}${d.range}${db}`);
      });
      this.devices.set(host, desc);
    }

    if (msg.url === '/cit/s') {
      if (this._debug) this.saveResponse(deviceType + '-' + deviceId + '.coap.cits.json', payload);
      this.deviceSerial.set(host, serial);
      const descriptions: CoIoTDescription[] = this.devices.get(host) || [];
      if (!descriptions || descriptions.length === 0) {
        // Bug on SHMOS-01 and SHMOS-02
        if (deviceType === 'SHDW-1' || deviceType === 'SHDW-2') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}SHDW-1/SHDW-2${db}`);
          // battery component
          descriptions.push({ id: 3111, component: 'battery', property: 'level', range: ['0/100', '-1'] }); // SHDW-1 and SHDW-2
          // contact component 1 = open, 0 = closed
          descriptions.push({ id: 3108, component: 'sensor', property: 'contact_open', range: ['0/1', '-1'] }); // SHDW-1 and SHDW-2
          descriptions.push({ id: 6110, component: 'vibration', property: 'vibration', range: ['0/1', '-1'] }); // SHDW-1 and SHDW-2
          // luminosity component
          descriptions.push({ id: 3106, component: 'lux', property: 'value', range: ['U32', '-1'] }); // SHDW-1 and SHDW-2
          // temperature component
          descriptions.push({ id: 3101, component: 'temperature', property: 'value', range: ['-55/125', '999'] }); // SHDW-1 and SHDW-2
          this.devices.set(host, descriptions);
        } else if (deviceType === 'SHBTN-1' || deviceType === 'SHBTN-2') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}SHBTN-1/SHBTN-2${db}`);
          // battery component
          descriptions.push({ id: 3111, component: 'battery', property: 'level', range: ['0/100', '-1'] }); // SHMOS-01
          // input component
          descriptions.push({ id: 2102, component: 'input:0', property: 'event', range: ['S/L/SS/SSS', ''] }); // SHBTN-2
          descriptions.push({ id: 2103, component: 'input:0', property: 'event_cnt', range: 'U16' }); // SHBTN-2
          this.devices.set(host, descriptions);
        } else if (deviceType === 'SHMOS-01') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}SHMOS-01${db}`);
          // battery component
          descriptions.push({ id: 3111, component: 'battery', property: 'level', range: ['0/100', '-1'] }); // SHMOS-01
          // motion component
          descriptions.push({ id: 6107, component: 'sensor', property: 'motion', range: ['0/1', '-1'] }); // SHMOS-01
          descriptions.push({ id: 6110, component: 'vibration', property: 'vibration', range: ['0/1', '-1'] }); // SHMOS-01
          // luminosity component
          descriptions.push({ id: 3106, component: 'lux', property: 'value', range: ['U32', '-1'] }); // SHMOS-01
          this.devices.set(host, descriptions);
        } else if (deviceType === 'SHMOS-02') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}SHMOS-02${db}`);
          // battery component
          descriptions.push({ id: 3111, component: 'battery', property: 'level', range: ['0/100', '-1'] }); // SHMOS-02
          // motion component
          descriptions.push({ id: 6107, component: 'sensor', property: 'motion', range: ['0/1', '-1'] }); // SHMOS-02
          descriptions.push({ id: 6110, component: 'vibration', property: 'vibration', range: ['0/1', '-1'] }); // SHMOS-02
          // luminosity component
          descriptions.push({ id: 3106, component: 'lux', property: 'value', range: ['U32', '-1'] }); // SHMOS-02
          // temperature component
          descriptions.push({ id: 3101, component: 'temperature', property: 'value', range: ['-55/125', '999'] }); // SHDW-1 and SHDW-2
          this.devices.set(host, descriptions);
        } else if (deviceType === 'SHWT-1') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}SHWT-1${db}`);
          // battery component
          descriptions.push({ id: 3111, component: 'battery', property: 'level', range: ['0/100', '-1'] }); // SHWT-1
          // flood component
          descriptions.push({ id: 6106, component: 'flood', property: 'flood', range: ['0/1', '-1'] }); // SHWT-1
          // temperature component
          descriptions.push({ id: 3101, component: 'temperature', property: 'value', range: ['-55/125', '999'] }); // SHWT-1
          this.devices.set(host, descriptions);
        } else {
          this.log.debug(`*No coap description found for host ${zb}${host}${db} fetching it...`);
          this.getDeviceDescription(host, deviceType); // No await
        }
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
          if (typeof desc.range === 'string' && desc.range === '0/1') {
            this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db}`);
            this.emit('update', host, desc.component, desc.property, v.value === 1);
          } else if (Array.isArray(desc.range) && desc.range[0] === '0/1' && desc.range[1] === '-1') {
            this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db}`);
            this.emit('update', host, desc.component, desc.property, v.value === -1 ? null : v.value === 1);
          } else {
            this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db}`);
            this.emit('update', host, desc.component, desc.property, v.value);
          }
        }
        // else this.log.debug(`No coap description found for id ${v.id}`);
      });
    }

    return { msg, host, deviceType, deviceId, protocolRevision, validFor, serial, payload } as CoapMessage;
  }

  /**
   * Listens for status updates from the CoAP server.
   */
  private listenForStatusUpdates() {
    this.coapServer = coap.createServer({
      multicastAddress: COAP_MULTICAST_ADDRESS,
    });

    this.coapServer.on('error', (err) => {
      this.log.error('CoIoT (coap) server error:', err instanceof Error ? err.message : err);
    });

    this.coapServer.on('warning', (err) => {
      this.log.warn('CoIoT (coap) server warning:', err instanceof Error ? err.message : err);
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.coapServer.on('request', (msg: IncomingMessage, res: OutgoingMessage) => {
      this.log.debug(`CoIoT (coap) server recevived a messagge code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${debugStringify(msg.rsinfo)}`);
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
        this.log.debug('CoIoT (coap) server is listening ...');
      }
    });
  }

  /**
   * Registers a device with the specified host.
   *
   * @param {string} host - The host of the device to register.
   * @param {string} id - The id to request the device status from (default undefined).
   * @returns {Promise<void>} - A promise that resolves when the device is registered.
   */
  async registerDevice(host: string, id?: string): Promise<void> {
    this.log.debug(`Registering device ${host}...`);
    this.getDeviceDescription(host, id); // No await
    // this.log.debug(`Registered device ${host}.`);
  }

  /**
   * Starts the CoIoT (coap) server for shelly devices.
   * If the server is already listening, this method does nothing.
   */
  start(debug = false) {
    this._debug = debug;
    if (this._isListening) return;
    this.log.debug('Starting CoIoT (coap) server for shelly devices...');
    this._isListening = true;
    this.listenForStatusUpdates();
    this.log.debug('Started CoIoT (coap) server for shelly devices.');
  }

  /**
   * Stops the CoIoT (coap) server for shelly devices.
   *
   * @remarks
   * This method stops the CoIoT server by performing the following actions:
   * - Logs a debug message indicating the server is being stopped.
   * - Removes all event listeners.
   * - Sets the `_isListening` flag to `false`.
   * - Closes the global agent.
   * - Closes the `coapServer` if it exists.
   * - Clears the `devices` map.
   * - Logs a debug message indicating the server has been stopped.
   */
  stop() {
    this.log.debug('Stopping CoIoT (coap) server for shelly devices...');
    this.removeAllListeners();
    this._isListening = false;
    globalAgent.close((err?: Error) => this.log.debug(`CoIoT (coap) agent closed${err ? ' with error ' + err.message : ''}.`));
    if (this.coapServer) this.coapServer.close((err?: Error) => this.log.debug(`CoIoT (coap) server closed${err ? ' with error ' + err.message : ''}.`));
    this.devices.clear();
    this.log.debug('Stopped CoIoT (coap) server for shelly devices.');
  }

  /**
   * Saves the response packet to a file.
   *
   * @param {shellyId} shellyId - The ID of the Shelly device.
   * @param {ResponsePacket} response - The response packet to be saved.
   * @returns {Promise<void>} A promise that resolves when the response is successfully saved, or rejects with an error.
   */
  private async saveResponse(shellyId: string, payload: object): Promise<void> {
    const responseFile = path.join(this._dataPath, `${shellyId}`);
    try {
      await fs.writeFile(responseFile, JSON.stringify(payload, null, 2), 'utf8');
      this.log.debug(`*Saved shellyId ${hk}${shellyId}${db} coap response file ${CYAN}${responseFile}${db}`);
      return Promise.resolve();
    } catch (err) {
      this.log.error(`Error saving shellyId ${hk}${shellyId}${er} coap response file ${CYAN}${responseFile}${er}: ${err instanceof Error ? err.message : err}`);
      return Promise.reject(err);
    }
  }
}

// Use with: node dist/coapServer.js coapStatus coapDescription
// Use with: node dist/coapServer.js coapServer coapDescription
/*
if (process.argv.includes('coapServer') || process.argv.includes('coapDescription') || process.argv.includes('coapStatus') || process.argv.includes('coapMcast')) {
  const coapServer = new CoapServer(LogLevel.DEBUG);

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.219');
  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.219');

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.222');
  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.222');

  if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription('192.168.1.233');
  if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus('192.168.1.233');

  if (process.argv.includes('coapMcast')) {
    await coapServer.getMulticastDeviceStatus(30);
    coapServer.stop();
  }

  if (process.argv.includes('coapServer')) coapServer.start(true);

  if (process.argv.includes('coapServer')) await coapServer.getDeviceDescription('192.168.1.245');
  if (process.argv.includes('coapServer')) await coapServer.getDeviceStatus('192.168.1.246');

  process.on('SIGINT', async function () {
    coapServer.stop();
    // process.exit();
  });
}
*/

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHDW = {
  'blk': [
    {
      'I': 1,
      'D': 'sensor_0',
    },
    {
      'I': 2,
      'D': 'device',
    },
  ],
  'sen': [
    {
      'I': 9103,
      'T': 'EVC',
      'D': 'cfgChanged',
      'R': 'U16',
      'L': 2,
    },
    {
      'I': 3108,
      'T': 'S',
      'D': 'dwIsOpened',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3119,
      'T': 'S',
      'D': 'dwStateChanged',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3109,
      'T': 'S',
      'D': 'tilt',
      'U': 'deg',
      'R': ['0/180', '-1'],
      'L': 1,
    },
    {
      'I': 6110,
      'T': 'A',
      'D': 'vibration',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3106,
      'T': 'L',
      'D': 'luminosity',
      'U': 'lux',
      'R': ['U32', '-1'],
      'L': 1,
    },
    {
      'I': 3110,
      'T': 'S',
      'D': 'luminosityLevel',
      'R': ['dark/twilight/bright', 'unknown'],
      'L': 1,
    },
    {
      'I': 3101,
      'T': 'T',
      'D': 'extTemp',
      'U': 'C',
      'R': ['-55/125', '999'],
      'L': 1,
    },
    {
      'I': 3102,
      'T': 'T',
      'D': 'extTemp',
      'U': 'F',
      'R': ['-67/257', '999'],
      'L': 1,
    },
    {
      'I': 3115,
      'T': 'S',
      'D': 'sensorError',
      'R': '0/1',
      'L': 1,
    },
    {
      'I': 3111,
      'T': 'B',
      'D': 'battery',
      'R': ['0/100', '-1'],
      'L': 2,
    },
    {
      'I': 9102,
      'T': 'EV',
      'D': 'wakeupEvent',
      'R': ['battery/button/periodic/poweron/sensor/alarm', 'unknown'],
      'L': 2,
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHBTN2 = {
  'blk': [
    {
      'I': 1,
      'D': 'sensor_0',
    },
    {
      'I': 2,
      'D': 'device',
    },
  ],
  'sen': [
    {
      'I': 9103,
      'T': 'EVC',
      'D': 'cfgChanged',
      'R': 'U16',
      'L': 2,
    },
    {
      'I': 2102,
      'T': 'EV',
      'D': 'inputEvent',
      'R': ['S/L/SS/SSS', ''],
      'L': 1,
    },
    {
      'I': 2103,
      'T': 'EVC',
      'D': 'inputEventCnt',
      'R': 'U16',
      'L': 1,
    },
    {
      'I': 3115,
      'T': 'S',
      'D': 'sensorError',
      'R': '0/1',
      'L': 1,
    },
    {
      'I': 3112,
      'T': 'S',
      'D': 'charger',
      'R': ['0/1', '-1'],
      'L': 2,
    },
    {
      'I': 3111,
      'T': 'B',
      'D': 'battery',
      'R': ['0/100', '-1'],
      'L': 2,
    },
    {
      'I': 9102,
      'T': 'EV',
      'D': 'wakeupEvent',
      'R': ['battery/button/periodic/poweron/sensor/ext_power', 'unknown'],
      'L': 2,
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHMOS01 = {
  'blk': [
    {
      'I': 1,
      'D': 'sensor_0',
    },
    {
      'I': 2,
      'D': 'device',
    },
  ],
  'sen': [
    {
      'I': 6107,
      'T': 'A',
      'D': 'motion',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3119,
      'T': 'S',
      'D': 'timestamp',
      'U': 's',
      'R': ['U32', '-1'],
      'L': 1,
    },
    {
      'I': 3120,
      'T': 'S',
      'D': 'motionActive',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 6110,
      'T': 'A',
      'D': 'vibration',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3106,
      'T': 'L',
      'D': 'luminosity',
      'R': ['U32', '-1'],
      'L': 1,
    },
    {
      'I': 3111,
      'T': 'B',
      'D': 'battery',
      'R': ['0/100', '-1'],
      'L': 2,
    },
    {
      'I': 9103,
      'T': 'EVC',
      'D': 'cfgChanged',
      'R': 'U16',
      'L': 2,
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHMOS02 = {
  'blk': [
    {
      'I': 1,
      'D': 'sensor_0',
    },
    {
      'I': 2,
      'D': 'device',
    },
  ],
  'sen': [
    {
      'I': 3101,
      'T': 'T',
      'D': 'temp',
      'U': 'C',
      'R': ['-55/125', '999'],
      'L': 1,
    },
    {
      'I': 3102,
      'T': 'T',
      'D': 'temp',
      'U': 'F',
      'R': ['-67/257', '999'],
      'L': 1,
    },
    {
      'I': 6107,
      'T': 'A',
      'D': 'motion',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3119,
      'T': 'S',
      'D': 'timestamp',
      'U': 's',
      'R': ['U32', '-1'],
      'L': 1,
    },
    {
      'I': 3120,
      'T': 'A',
      'D': 'motionActive',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 6110,
      'T': 'A',
      'D': 'vibration',
      'R': ['0/1', '-1'],
      'L': 1,
    },
    {
      'I': 3106,
      'T': 'L',
      'D': 'luminosity',
      'R': ['U32', '-1'],
      'L': 1,
    },
    {
      'I': 3111,
      'T': 'B',
      'D': 'battery',
      'R': ['0/100', '-1'],
      'L': 2,
    },
    {
      'I': 9103,
      'T': 'EVC',
      'D': 'cfgChanged',
      'R': 'U16',
      'L': 2,
    },
  ],
};
