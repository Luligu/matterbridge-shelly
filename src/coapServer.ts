/**
 * This file contains the class CoapServer.
 *
 * @file src\coapServer.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 3.0.0
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

// Matterbridge imports
import { AnsiLogger, BLUE, CYAN, LogLevel, MAGENTA, RESET, TimestampFormat, db, debugStringify, er, hk, nf, wr, zb } from 'matterbridge/logger';

// CoAP imports
import coap, { Server, IncomingMessage, OutgoingMessage, parameters } from 'coap';

// Node.js imports
import EventEmitter from 'node:events';
import path from 'node:path';
import { promises as fs } from 'node:fs';

// Shelly imports
import { Shelly } from './shelly.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { ShellyDevice } from './shellyDevice.js';

// 192.168.1.189:5683

const COIOT_OPTION_GLOBAL_DEVID = '3332';
const COIOT_OPTION_STATUS_VALIDITY = '3412';
const COIOT_OPTION_STATUS_SERIAL = '3420';

const COAP_MULTICAST_ADDRESS = '224.0.1.187';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CoIoTMessage {
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

interface CoapServerEvent {
  update: [host: string, component: string, property: string, value: ShellyDataType];
  coapupdate: [host: string, status: ShellyData];
}

export class CoapServer extends EventEmitter {
  public readonly log;
  private readonly shelly: Shelly;
  private coapServer: Server | undefined;
  private _isListening = false;
  private _isReady = false;
  private readonly deviceDescription = new Map<string, CoIoTDescription[]>(); // host, descriptions
  private readonly deviceSerial = new Map<string, number>(); // host, serial
  private readonly deviceValidityTimeout = new Map<string, NodeJS.Timeout | undefined>(); // host, validity timeout
  private readonly deviceId = new Map<string, string>(); // host, deviceId
  private _dataPath = 'temp';

  constructor(shelly: Shelly, logLevel: LogLevel = LogLevel.INFO) {
    super();
    this.shelly = shelly;
    this.log = new AnsiLogger({ logName: 'ShellyCoapServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel });

    // Set the CoAP parameters to minimum values
    parameters.maxRetransmit = 3;
    // parameters.maxLatency = 1;
    if (parameters.refreshTiming) parameters.refreshTiming();

    this.registerShellyOptions();
  }

  override emit<K extends keyof CoapServerEvent>(eventName: K, ...args: CoapServerEvent[K]): boolean {
    return super.emit(eventName, ...args);
  }

  override on<K extends keyof CoapServerEvent>(eventName: K, listener: (...args: CoapServerEvent[K]) => void): this {
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
   * Indicates whether the CoAP server is currently listening for incoming requests.
   *
   * @returns {boolean} A boolean value indicating whether the CoAP is listening.
   */
  get isListening(): boolean {
    return this._isListening;
  }

  /**
   * Indicates whether the CoAP server is ready.
   *
   * @returns {boolean} A boolean value indicating whether the CoAP is ready.
   */
  get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Retrieves the device description from the specified host using CoAP protocol.
   * @param {string} host The host from which to retrieve the device description.
   * @param {string} id - The id to request the device description from.
   * @returns {Promise<IncomingMessage | null>} A Promise that resolves with the IncomingMessage object representing the response, or null if the request times out.
   */
  async getDeviceDescription(host: string, id: string): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting CoIoT (coap) device description from ${hk}${id}${db} host ${zb}${host}${db}...`);

    return new Promise((resolve) => {
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
          this.log.warn(`CoIoT (coap) timeout requesting device description ("/cit/d") from ${hk}${id}${wr} host ${zb}${host}${wr}: ${err instanceof Error ? err.message : err}`);
          resolve(null);
        })
        .on('error', (err) => {
          this.log.warn(`CoIoT (coap) error requesting device description ("/cit/d") from ${hk}${id}${wr} host ${zb}${host}${wr}: ${err instanceof Error ? err.message : err}`);
          resolve(null);
        })
        .end();
      this.log.debug(`Sent CoIoT (coap) device description request to ${hk}${id}${db} host ${zb}${host}${db}.`);
    });
  }

  /**
   * Retrieves the device status from the specified host.
   * @param {string} host - The host to request the device status from.
   * @param {string} id - The id to request the device status from.
   * @returns {Promise<IncomingMessage | null>} A Promise that resolves with the IncomingMessage containing the device status, or null if the request times out.
   */
  async getDeviceStatus(host: string, id: string): Promise<IncomingMessage | null> {
    this.log.debug(`Requesting CoIoT (coap) device status from ${hk}${id}${db} host ${zb}${host}${db}...`);

    return new Promise((resolve) => {
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
          this.log.warn(`CoIoT (coap) timeout requesting device status ("/cit/s") from ${hk}${id}${wr} host ${zb}${host}${wr}: ${err instanceof Error ? err.message : err}`);
          resolve(null);
        })
        .on('error', (err) => {
          this.log.warn(`CoIoT (coap) error requesting device status ("/cit/s") from ${hk}${id}${wr} host ${zb}${host}${wr}: ${err instanceof Error ? err.message : err}`);
          resolve(null);
        })
        .end();
      this.log.debug(`Sent CoIoT (coap) device status request to ${hk}${id}${db} host ${zb}${host}${db}.`);
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
          this.log.warn('CoIoT (coap) timeout requesting multicast device status ("/cit/s"):', err instanceof Error ? err.message : err);
          resolve(null);
        })
        .on('error', (err) => {
          this.log.warn('CoIoT (coap) error requesting multicast device status ("/cit/s"):', err instanceof Error ? err.message : err);
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
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16LE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_VALIDITY');
      },
      (buf) => buf.readUInt16LE(0),
    );

    coap.registerOption(
      COIOT_OPTION_STATUS_SERIAL,
      (str) => {
        // Convert to integer and then to Buffer
        if (typeof str === 'string') {
          // Create a new Buffer and write the integer
          const buffer = Buffer.alloc(2); // Allocate buffer of 2 bytes
          buffer.writeUInt16LE(parseInt(str, 10), 0); // Write to buffer
          return buffer; // Return the buffer
        }
        // Handle null or non-string types explicitly
        throw new TypeError('Expected a string for STATUS_SERIAL');
      },
      (buf) => buf.readUInt16LE(0),
    );
  }

  /**
   * Parses the Shelly message received from the CoIoT (coap) response.
   *
   * @param {IncomingMessage} msg - The incoming message object.
   */
  private parseShellyMessage(msg: IncomingMessage): ShellyData | CoIoTDescription[] | undefined {
    if (!this.deviceId.get(msg.rsinfo.address)) return;
    this.log.debug(`Parsing CoIoT (coap) response from device ${hk}${this.deviceId.get(msg.rsinfo.address)}${db} host ${zb}${msg.rsinfo.address}${db}...`);

    const host = msg.rsinfo.address;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const headers = msg.headers as any;

    const code = msg.code;
    const url = msg.url;
    let deviceModel = '';
    let deviceMac = '';
    let protocolRevision = '';
    let validity = 0;
    let validFor = 0;
    let serial = 0;
    let payload;

    if (headers[COIOT_OPTION_GLOBAL_DEVID]) {
      const parts = headers[COIOT_OPTION_GLOBAL_DEVID].split('#');
      deviceModel = parts[0];
      deviceMac = parts[1];
      protocolRevision = parts[2];
    }

    if (headers[COIOT_OPTION_STATUS_VALIDITY]) {
      validity = headers[COIOT_OPTION_STATUS_VALIDITY];
      if ((validity & 1) === 0) {
        validFor = Math.floor(validity / 10);
      } else {
        validFor = validity * 4;
      }
    }

    if (headers[COIOT_OPTION_STATUS_SERIAL]) {
      serial = headers[COIOT_OPTION_STATUS_SERIAL];
    }

    /*
    TODO: Uncomment this code when we have a list of Gen1 devices with sleep mode
    if (url === '/cit/s') {
      this.log.info(
        `Device model ${hk}${deviceModel}${nf} id ${hk}${this.deviceId.get(msg.rsinfo.address)}${nf} host ${zb}${host}${nf} sent cit/s serial ${CYAN}${serial}${nf} valid for ${CYAN}${validFor}${nf} seconds`,
      );
      if (this.deviceValidityTimeout.get(host)) clearTimeout(this.deviceValidityTimeout.get(host));
      this.deviceValidityTimeout.set(
        host,
        setTimeout(
          () => {
            this.log.warn(
              `Device model ${hk}${deviceModel}${wr} id ${hk}${this.deviceId.get(msg.rsinfo.address)}${wr} host ${zb}${host}${wr} didn't update in ${zb}${validFor}${wr} seconds`,
            );
          },
          (validFor + 10) * 1000,
        ).unref(),
      );
    }
    */

    if (url === '/cit/s' && this.deviceSerial.get(host) === serial && !['SHDW-1', 'SHDW-2'].includes(deviceModel)) {
      this.log.debug(`No updates (serial not changed) for device ${hk}${this.deviceId.get(host)}${db} host ${zb}${host}${db}`);
      return;
    }

    try {
      payload = JSON.parse(msg.payload.toString());
    } catch {
      payload = msg.payload.toString();
    }

    this.log.debug(`url: ${CYAN}${url}${db}`);
    this.log.debug(`code: ${CYAN}${code}${db}`);
    this.log.debug(`host: ${CYAN}${host}${db}`);
    this.log.debug(`deviceId: ${CYAN}${this.deviceId.get(host)}${db}`);
    this.log.debug(`deviceModel: ${CYAN}${deviceModel}${db}`);
    this.log.debug(`deviceMac: ${CYAN}${deviceMac}${db}`);
    this.log.debug(`protocolRevision: ${CYAN}${protocolRevision}${db}`);
    this.log.debug(`validFor (${validity}): ${CYAN}${validFor}${db} seconds`);
    this.log.debug(`serial (${this.deviceSerial.get(host) === serial ? 'not changed' : 'updated'}): ${CYAN}${serial}${db}`);
    this.log.debug(`payload:${RESET}\n`, payload);

    if (msg.url === '/cit/d') {
      try {
        if (this.log.logLevel === LogLevel.DEBUG) this.saveResponse(deviceModel + '-' + deviceMac + '.coap.citd.json', payload);
      } catch {
        // Ignore cause the error is already logged
      }
      const desc = this.parseDescription(payload);
      this.deviceDescription.set(host, desc);
      return desc;
    }

    if (msg.url === '/cit/s') {
      try {
        if (this.log.logLevel === LogLevel.DEBUG) this.saveResponse(this.deviceId.get(host) + '.coap.cits.json', payload);
      } catch {
        // Ignore cause the error is already logged
      }
      this.deviceSerial.set(host, serial);
      let descriptions: CoIoTDescription[] = this.deviceDescription.get(host) || [];
      // For sleep mode devices we don't have the device description at the first message
      if (!descriptions || descriptions.length === 0) {
        // SHMOS-01, SHMOS-02, SHTRV-01 and first Gen1 don't answer to cit/d and cit/s on CoIot (they answer to fetch http://host/cit/d)
        if (deviceModel === 'SHDW-1' || deviceModel === 'SHDW-2') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHDW_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHTRV-01') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHTRV01_CITD, deviceModel);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHBTN-1' || deviceModel === 'SHBTN-2') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHBTN_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHMOS-01') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHMOS01_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHMOS-02') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHMOS02_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHWT-1') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHWT1_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHHT-1') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHHT1_CITD);
          this.deviceDescription.set(host, descriptions);
        } else if (deviceModel === 'SHSM-01') {
          this.log.debug(`*Set coap descriptions for host ${zb}${host}${db} deviceType ${CYAN}${deviceModel}${db}`);
          descriptions = this.parseDescription(SHSM1_CITD);
          this.deviceDescription.set(host, descriptions);
        } else {
          this.log.info(`No coap description found for ${hk}${deviceModel}${nf} id ${hk}${this.deviceId.get(host)}${nf} host ${zb}${host}${nf} fetching it...`);
          const id = this.deviceId.get(host);
          if (id) this.registerDevice(host, id, false); // No await
        }
      }
      try {
        const status: ShellyData = this.parseStatus(descriptions, payload);

        /*
        const values: CoIoTGValue[] =
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          payload.G?.map((v: any[]) => ({
            channel: v[0],
            id: v[1],
            value: v[2],
          })) || [];
        this.log.debug(`Parsing ${MAGENTA}values${db} (${values.length}):`);
        values.forEach((v) => {
          const desc = descriptions.find((d) => d.id === v.id);
          if (desc) {
            this.log.debug(
              `- channel ${CYAN}${v.channel}${db} id ${CYAN}${v.id}${db} value ${CYAN}${v.value}${db} => component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${desc.range === '0/1' ? v.value === 1 : v.value}${db}`,
            );
            if (!desc.property.startsWith('input') && typeof desc.range === 'string' && desc.range === '0/1') {
              // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value === 1}${db}`);
              // this.emit('update', host, desc.component, desc.property, v.value === 1);
              if (!status[desc.component]) status[desc.component] = {};
              (status[desc.component] as ShellyData)[desc.property] = v.value === 1;
            } else if (!desc.property.startsWith('input') && Array.isArray(desc.range) && desc.range[0] === '0/1' && desc.range[1] === '-1') {
              // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value === -1 ? null : v.value === 1}${db}`);
              // this.emit('update', host, desc.component, desc.property, v.value === -1 ? null : v.value === 1);
              if (!status[desc.component]) status[desc.component] = {};
              (status[desc.component] as ShellyData)[desc.property] = v.value === -1 ? null : v.value === 1;
            } else {
              // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value}${db}`);
              if (desc.property.includes('.')) {
                // target_t#value
                const [property, subproperty] = desc.property.split('.');
                // this.emit('update', host, desc.component, property, { [subproperty]: v.value });
                if (!status[desc.component]) status[desc.component] = {};
                (status[desc.component] as ShellyData)[property] = { [subproperty]: v.value };
              } else {
                // this.emit('update', host, desc.component, desc.property, v.value);
                if (!status[desc.component]) status[desc.component] = {};
                (status[desc.component] as ShellyData)[desc.property] = v.value;
              }
            }
          } else this.log.debug(`No coap description found for id ${v.id}`);
        });
        */
        this.log.debug(`***Update status for device ${hk}${this.deviceId.get(host)}${db} host ${zb}${host}${db} payload:\n`, status);
        this.emit('coapupdate', host, status);
        return status;
      } catch {
        this.log.warn(`Error parsing values for host ${zb}${host}${wr}`);
      }
    }
  }
  /**
   * Parse the status of the device
   * @param payload - The payload of the message
   *
   * @returns The parsed staus of the device
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseStatus(descriptions: CoIoTDescription[], payload: any): ShellyData {
    const status: ShellyData = {};

    const values: CoIoTGValue[] =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload.G?.map((v: any[]) => ({
        channel: v[0],
        id: v[1],
        value: v[2],
      })) || [];
    this.log.debug(`Parsing ${MAGENTA}values${db} (${values.length}):`);
    values.forEach((v) => {
      const desc = descriptions.find((d) => d.id === v.id);
      if (desc) {
        this.log.debug(
          `- channel ${CYAN}${v.channel}${db} id ${CYAN}${v.id}${db} value ${CYAN}${v.value}${db} => component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${desc.range === '0/1' ? v.value === 1 : v.value}${db}`,
        );
        if (!desc.property.startsWith('input') && typeof desc.range === 'string' && desc.range === '0/1') {
          // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value === 1}${db}`);
          // this.emit('update', host, desc.component, desc.property, v.value === 1);
          if (!status[desc.component]) status[desc.component] = {};
          (status[desc.component] as ShellyData)[desc.property] = v.value === 1;
        } else if (!desc.property.startsWith('input') && Array.isArray(desc.range) && desc.range[0] === '0/1' && desc.range[1] === '-1') {
          // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value === -1 ? null : v.value === 1}${db}`);
          // this.emit('update', host, desc.component, desc.property, v.value === -1 ? null : v.value === 1);
          if (!status[desc.component]) status[desc.component] = {};
          (status[desc.component] as ShellyData)[desc.property] = v.value === -1 ? null : v.value === 1;
        } else {
          // this.log.debug(`sending update for component ${CYAN}${desc.component}${db} property ${CYAN}${desc.property}${db} value ${CYAN}${v.value}${db}`);
          if (desc.property.includes('.')) {
            // target_t#value
            const [property, subproperty] = desc.property.split('.');
            // this.emit('update', host, desc.component, property, { [subproperty]: v.value });
            if (!status[desc.component]) status[desc.component] = {};
            (status[desc.component] as ShellyData)[property] = { [subproperty]: v.value };
          } else {
            // this.emit('update', host, desc.component, desc.property, v.value);
            if (!status[desc.component]) status[desc.component] = {};
            (status[desc.component] as ShellyData)[desc.property] = v.value;
          }
        }
      } else this.log.debug(`No coap description found for id ${v.id}`);
    });
    return status;
  }

  /**
   * Parse the description of the device
   * @param payload - The payload of the message
   *
   * @returns The parsed description of the device
   */
  parseDescription(payload: Record<string, unknown>, model?: string): CoIoTDescription[] {
    this.log.debug(`Parsing ${MAGENTA}blocks${db}:`);
    const desc: CoIoTDescription[] = [];
    const blk = payload.blk as CoIoTBlkComponent[];
    const sen = payload.sen as CoIoTSenProperty[];
    if (!blk || blk.length === 0 || !sen || sen.length === 0) {
      return desc;
    }
    blk.forEach((b) => {
      this.log.debug(`- block: ${CYAN}${b.I}${db} description ${CYAN}${b.D}${db}`);
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
          if (s.D === 'cfgChanged' && b.D === 'device') desc.push({ id: s.I, component: 'sys', property: 'cfg_rev', range: s.R });
          if (s.D === 'wakeupEvent' && b.D === 'device') desc.push({ id: s.I, component: 'sys', property: 'act_reasons', range: s.R });

          // output component
          if (s.D === 'overpower') desc.push({ id: s.I, component: b.D.replace('_', ':').replace('device', 'sys'), property: 'overpower', range: s.R });

          // input component
          if (s.D === 'input' && !b.D.startsWith('sensor')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('device', 'input:0'), property: 'input', range: s.R });
          if (s.D === 'inputEvent' && !b.D.startsWith('sensor'))
            desc.push({ id: s.I, component: b.D.replace('_', ':').replace('device', 'input:0'), property: 'event', range: s.R });
          if (s.D === 'inputEventCnt' && !b.D.startsWith('sensor'))
            desc.push({ id: s.I, component: b.D.replace('_', ':').replace('device', 'input:0'), property: 'event_cnt', range: s.R });

          // sensor/input component
          if (s.D === 'inputEvent' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('sensor', 'input'), property: 'event', range: s.R }); // SHBTN-2
          if (s.D === 'inputEventCnt' && b.D.startsWith('sensor'))
            desc.push({ id: s.I, component: b.D.replace('_', ':').replace('sensor', 'input'), property: 'event_cnt', range: s.R }); // SHBTN-2

          // light component
          if (s.D === 'output') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'state', range: s.R });
          if (s.D === 'brightness') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'brightness', range: s.R }); // Used by white channels
          if (s.D === 'gain') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'gain', range: s.R }); // Used by color channels
          if (s.D === 'red') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'red', range: s.R });
          if (s.D === 'green') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'green', range: s.R });
          if (s.D === 'blue') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'blue', range: s.R });
          if (s.D === 'white') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'white', range: s.R });
          if (s.D === 'whiteLevel') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'white', range: s.R });
          if (s.D === 'colorTemp') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'temp', range: s.R });
          if (s.D === 'effect') desc.push({ id: s.I, component: b.D.replace('_', ':'), property: 'effect', range: s.R });
          if (s.D === 'power' && b.D.startsWith('light')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('light', 'meter'), property: 'power', range: s.R });
          if (s.D === 'energy' && b.D.startsWith('light')) desc.push({ id: s.I, component: b.D.replace('_', ':').replace('light', 'meter'), property: 'total', range: s.R });

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

          // motion component
          if (s.D === 'motion' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'sensor', property: 'motion', range: ['0/1', '-1'] }); // SHMOS-01 and SHMOS-02

          // dw component
          if (s.D === 'dwIsOpened' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'sensor', property: 'contact_open', range: s.R }); // SHDW-1 and SHDW-2
          if (s.D === 'vibration' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'vibration', property: 'vibration', range: s.R }); // SHDW-1 and SHDW-2
          if (s.D === 'tilt' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'vibration', property: 'tilt', range: s.R }); // SHDW-1 and SHDW-2
          if (s.D === 'luminosity' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'lux', property: 'value', range: s.R }); // SHDW-1 and SHDW-2
          if (s.D === 'luminosityLevel' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'lux', property: 'illumination', range: s.R }); // SHDW-1 and SHDW-2

          // flood component
          if (s.D === 'flood' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'flood', property: 'flood', range: s.R }); // SHWT-1

          // smoke component
          if (s.D === 'smoke' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'smoke', property: 'alarm', range: s.R }); // SHSM-01

          // temperature component
          if (s.D === 'extTemp' && s.U === 'C' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'temperature', property: 'tC', range: s.R }); // SHHT-1
          if (s.D === 'extTemp' && s.U === 'F' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'temperature', property: 'tF', range: s.R }); // SHHT-1
          if (s.D === 'temp' && s.U === 'C' && b.D.startsWith('sensor') && model !== 'SHTRV-01') desc.push({ id: s.I, component: 'temperature', property: 'tC', range: s.R }); // SHHT-1
          if (s.D === 'temp' && s.U === 'F' && b.D.startsWith('sensor') && model !== 'SHTRV-01') desc.push({ id: s.I, component: 'temperature', property: 'tF', range: s.R }); // SHHT-1

          // termostat component
          if (s.D === 'temp' && s.U === 'C' && b.D.startsWith('sensor') && model === 'SHTRV-01')
            desc.push({ id: s.I, component: 'thermostat:0', property: 'tmp.value', range: s.R }); // SHHT-1
          if (s.D === 'targetTemp' && s.U === 'C' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'thermostat:0', property: 'target_t.value', range: s.R }); // SHTRV-1

          // humidity component
          if (s.D === 'humidity' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'humidity', property: 'value', range: s.R }); // SHHT-1

          // gas_sensor component
          if (s.D === 'sensorOp' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'gas', property: 'sensor_state', range: s.R }); // SHGS-1
          if (s.D === 'gas' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'gas', property: 'alarm_state', range: s.R }); // SHGS-1
          if (s.D === 'concentration' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'gas', property: 'ppm', range: s.R }); // SHGS-1

          // generic sensor error
          if (s.D === 'sensorError' && b.D.startsWith('sensor')) desc.push({ id: s.I, component: 'sys', property: 'sensor_error', range: s.R });

          // battery component
          if (s.D === 'battery' && b.D === 'device') desc.push({ id: s.I, component: 'battery', property: 'level', range: s.R }); // SHBTN-2
          if (s.D === 'charger' && b.D === 'device') desc.push({ id: s.I, component: 'battery', property: 'charging', range: s.R }); // SHBTN-2
        });
    });
    this.log.debug(`Parsing ${MAGENTA}decoding${db}:`);
    desc.forEach((d) => {
      this.log.debug(`- id ${CYAN}${d.id}${db} component ${CYAN}${d.component}${db} property ${CYAN}${d.property}${db} range ${CYAN}${d.range}${db}`);
    });
    return desc;
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
        this.log.debug(`Coap server got a wrong messagge code ${BLUE}${msg.code}${db} url ${BLUE}${msg.url}${db} rsinfo ${db}${debugStringify(msg.rsinfo)}...`);
        // console.log(msg);
      }
    });

    this.coapServer.listen((err) => {
      if (err) {
        this.log.error(`CoIoT (coap) server error: ${err instanceof Error ? err.message : err}`);
      } else {
        this._isReady = true;
        this.log.info('CoIoT (coap) server is listening on port 5683...');
      }
    });
  }

  /**
   * Registers a device with the specified host.
   *
   * @param {string} host - The host of the device to register.
   * @param {string} id - The id of the device to register.
   * @param {boolean} registerOnly - Whether the device has sleep mode and needs to be only registered.
   * @returns {Promise<void>} - A promise that resolves when the device is registered.
   */
  async registerDevice(host: string, id: string, registerOnly: boolean): Promise<void> {
    this.deviceId.set(host, id);
    if (registerOnly) return;
    // SHMOS-01, SHMOS-02, SHTRV-01 and SHRGBWW-01 don't answer to the /cit/d and /cit/s requests
    this.log.debug(`*Registering device ${hk}${id}${db} host ${zb}${host}${db} with fetch...`);
    ShellyDevice.fetch(this.shelly, this.log, host, 'cit/d')
      .then((msg) => {
        if (msg && msg.blk && msg.sen) {
          // Simulate a CoAP message to use the same code
          const coapMessage = {
            rsinfo: { address: host, port: 5683, family: 'IPv4' },
            headers: {
              [COIOT_OPTION_GLOBAL_DEVID]: `${ShellyDevice.normalizeId(id).type}#${ShellyDevice.normalizeId(id).mac}#2`,
              [COIOT_OPTION_STATUS_VALIDITY]: 0,
              [COIOT_OPTION_STATUS_SERIAL]: 0,
            },
            url: '/cit/d',
            payload: Buffer.from(JSON.stringify(msg)),
            code: '2.05',
          };
          this.parseShellyMessage(coapMessage as unknown as IncomingMessage);
          this.log.debug(`***Registered CoIoT (coap) ${CYAN}/cit/d${db} for device ${hk}${id}${db} host ${zb}${host}${db} with fetch`);
        } else {
          this.log.debug(`****Invalid response registering device ${hk}${id}${db} host ${zb}${host}${db} with fetch`);
        }
      })
      .catch((err) => {
        this.log.debug(`****Error registering device ${hk}${id}${db} host ${zb}${host}${db} with fetch: ${err instanceof Error ? err.message : err}`);
      });
    /*
    this.log.debug(`Registering device ${hk}${id}${db} host ${zb}${host}${db} with coap...`);
    this.getDeviceDescription(host, id).then((msg) => {
      if (msg) this.log.debug(`Registered CoIoT (coap) ${CYAN}/cit/d${db} for device ${hk}${id}${db} host ${zb}${host}${db}.`);
      this.getDeviceStatus(host, id).then((msg) => {
        if (msg) this.log.debug(`Registered CoIoT (coap) ${CYAN}/cit/s${db} for device ${hk}${id}${db} host ${zb}${host}${db}.`);
      });
    });
    */
  }

  /**
   * Starts the CoIoT (coap) server for shelly devices.
   * If the server is already listening, this method does nothing.
   */
  start() {
    if (this._isListening) return;
    this.log.info('Starting CoIoT (coap) server for shelly devices...');
    this._isListening = true;
    this.listenForStatusUpdates();
    this.log.info('Started CoIoT (coap) server for shelly devices.');
  }

  /**
   * Stops the CoIoT (coap) server for shelly devices.
   *
   * @remarks
   * This method stops the CoIoT server by performing the following actions:
   * - Logs a message indicating the server is being stopped.
   * - Removes all event listeners.
   * - Closes the global agent.
   * - Closes the `coapServer` if it exists.
   * - Clears the `devices` map.
   * - Logs a message indicating the server has been stopped.
   */
  stop() {
    this.log.info('Stopping CoIoT (coap) server for shelly devices...');
    this.removeAllListeners();
    this._isListening = false;
    // globalAgent.close((err?: Error) => this.log.debug(`CoIoT (coap) agent closed${err ? ' with error ' + err.message : ''}.`));
    if (this.coapServer)
      this.coapServer.close((err?: Error) => {
        this._isReady = false;
        this.log.debug(`CoIoT (coap) server closed${err ? ' with error ' + err.message : ''}.`);
      });
    this.deviceDescription.clear();
    this.deviceId.clear();
    this.deviceSerial.clear();
    this.deviceValidityTimeout.clear();
    this.log.info('Stopped CoIoT (coap) server for shelly devices.');
  }

  /**
   * Saves the response packet to a file.
   *
   * @param {string} fileName - The ID of the Shelly device.
   * @param {object} payload - The response payload to be saved.
   * @returns {Promise<void>} A promise that resolves when the response is successfully saved, or rejects with an error.
   */
  private async saveResponse(fileName: string, payload: object): Promise<void> {
    const responseFile = path.join(this._dataPath, `${fileName}`);
    try {
      await fs.writeFile(responseFile, JSON.stringify(payload, null, 2), 'utf8');
      this.log.debug(`*Saved shellyId ${hk}${fileName}${db} coap response file ${CYAN}${responseFile}${db}`);
      return Promise.resolve();
    } catch (err) {
      this.log.error(`Error saving shellyId ${hk}${fileName}${er} coap response file ${CYAN}${responseFile}${er}: ${err instanceof Error ? err.message : err}`);
      return Promise.reject(err);
    }
  }
}

// Use with: node dist/coapServer.js coapStatus coapDescription
/*
if (
  process.argv.includes('coapServer') ||
  process.argv.includes('coapRegister') ||
  process.argv.includes('coapDescription') ||
  process.argv.includes('coapStatus') ||
  process.argv.includes('coapMcast')
) {
  // Set the CoAP parameters to minimum values
  const { parameters } = await import('coap');
  parameters.maxRetransmit = 3;
  // parameters.maxLatency = 1;
  if (parameters.refreshTiming) parameters.refreshTiming();

  const coapServer = new CoapServer(LogLevel.DEBUG);

  const devices = [
    { host: '192.168.1.219', id: 'shellydimmer2-98CDAC0D01BB' },
    { host: '192.168.1.222', id: 'shellyswitch25-3494546BBF7E' },
    { host: '192.168.1.236', id: 'shellyswitch25-3494547BF36C' },
    { host: '192.168.1.249', id: 'shellyem3-485519D732F4' },
    { host: '192.168.1.154', id: 'shellybulbduo-34945479CFA4' },
    { host: '192.168.1.155', id: 'shellycolorbulb-485519EE12A7' },
    { host: '192.168.1.240', id: 'shelly1-34945472A643' },
    { host: '192.168.1.241', id: 'shelly1l-E8DB84AAD781' },
    { host: '192.168.1.152', id: 'shellyrgbw2-EC64C9D199AD' },
    { host: '192.168.1.226', id: 'shellyrgbw2-EC64C9D3FFEF' },
    { host: '192.168.1.245', id: 'shellymotionsensor-60A42386E566' },
    { host: '192.168.1.246', id: 'shellymotion2-8CF68108A6F5' },
  ];
  for (const device of devices) {
    for (let i = 0; i < 5; i++) {
      if (process.argv.includes('coapRegister')) await coapServer.registerDevice(device.host, device.id, false);
      if (process.argv.includes('coapDescription')) await coapServer.getDeviceDescription(device.host, device.id);
      if (process.argv.includes('coapStatus')) await coapServer.getDeviceStatus(device.host, device.id);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  // await coapServer.getDeviceDescription('192.168.1.246', 'shellymotion2-8CF68108A6F5');

  if (process.argv.includes('coapDescription')) {
    await coapServer.getDeviceDescription('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');
  }

  if (process.argv.includes('coapStatus')) {
    await coapServer.getDeviceStatus('192.168.1.219', 'shellydimmer2-98CDAC0D01BB');
  }

  if (process.argv.includes('coapMcast')) {
    await coapServer.getMulticastDeviceStatus(30);
  }

  if (process.argv.includes('coapServer')) coapServer.start();

  process.on('SIGINT', async function () {
    coapServer.stop();
    process.exit();
  });
}
*/

const SHDW_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 3108, 'T': 'S', 'D': 'dwIsOpened', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3119, 'T': 'S', 'D': 'dwStateChanged', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3109, 'T': 'S', 'D': 'tilt', 'U': 'deg', 'R': ['0/180', '-1'], 'L': 1 },
    { 'I': 6110, 'T': 'A', 'D': 'vibration', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3106, 'T': 'L', 'D': 'luminosity', 'U': 'lux', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 3110, 'T': 'S', 'D': 'luminosityLevel', 'R': ['dark/twilight/bright', 'unknown'], 'L': 1 },
    { 'I': 3101, 'T': 'T', 'D': 'extTemp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'extTemp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9102, 'T': 'EV', 'D': 'wakeupEvent', 'R': ['battery/button/periodic/poweron/sensor/alarm', 'unknown'], 'L': 2 },
  ],
};

const SHBTN_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 2102, 'T': 'EV', 'D': 'inputEvent', 'R': ['S/L/SS/SSS', ''], 'L': 1 },
    { 'I': 2103, 'T': 'EVC', 'D': 'inputEventCnt', 'R': 'U16', 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 1 },
    { 'I': 3112, 'T': 'S', 'D': 'charger', 'R': ['0/1', '-1'], 'L': 2 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9102, 'T': 'EV', 'D': 'wakeupEvent', 'R': ['battery/button/periodic/poweron/sensor/ext_power', 'unknown'], 'L': 2 },
  ],
};

const SHMOS01_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 6107, 'T': 'A', 'D': 'motion', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3119, 'T': 'S', 'D': 'timestamp', 'U': 's', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 3120, 'T': 'S', 'D': 'motionActive', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 6110, 'T': 'A', 'D': 'vibration', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3106, 'T': 'L', 'D': 'luminosity', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
  ],
};

const SHMOS02_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 3101, 'T': 'T', 'D': 'temp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'temp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 6107, 'T': 'A', 'D': 'motion', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3119, 'T': 'S', 'D': 'timestamp', 'U': 's', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 3120, 'T': 'A', 'D': 'motionActive', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 6110, 'T': 'A', 'D': 'vibration', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3106, 'T': 'L', 'D': 'luminosity', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
  ],
};

const SHWT1_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 3101, 'T': 'T', 'D': 'extTemp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'extTemp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 6106, 'T': 'A', 'D': 'flood', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9102, 'T': 'EV', 'D': 'wakeupEvent', 'R': ['battery/button/periodic/poweron/sensor/alarm', 'unknown'], 'L': 2 },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHRGBWW01 = {
  'blk': [
    { 'I': 1, 'D': 'light_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 1101, 'T': 'S', 'D': 'output', 'R': '0/1', 'L': 1 },
    { 'I': 5105, 'T': 'S', 'D': 'red', 'R': '0/255', 'L': 1 },
    { 'I': 5106, 'T': 'S', 'D': 'green', 'R': '0/255', 'L': 1 },
    { 'I': 5107, 'T': 'S', 'D': 'blue', 'R': '0/255', 'L': 1 },
    { 'I': 5108, 'T': 'S', 'D': 'white', 'R': '0/255', 'L': 1 },
    { 'I': 5102, 'T': 'S', 'D': 'gain', 'R': '0/100', 'L': 1 },
    { 'I': 5109, 'T': 'S', 'D': 'effect', 'R': '0/3', 'L': 1 },
    { 'I': 4101, 'T': 'P', 'D': 'power', 'U': 'W', 'R': ['0/288', '-1'], 'L': 1 },
    { 'I': 4103, 'T': 'E', 'D': 'energy', 'U': 'Wmin', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 6102, 'T': 'A', 'D': 'overpower', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 2101, 'T': 'S', 'D': 'input', 'R': '0/1', 'L': 2 },
    { 'I': 2102, 'T': 'EV', 'D': 'inputEvent', 'R': ['S/L', ''], 'L': 2 },
    { 'I': 2103, 'T': 'EVC', 'D': 'inputEventCnt', 'R': 'U16', 'L': 2 },
    { 'I': 9101, 'T': 'S', 'D': 'mode', 'R': 'color/white', 'L': 2 },
  ],
};

const SHTRV01_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 3101, 'T': 'T', 'D': 'temp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'temp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 3103, 'T': 'T', 'D': 'targetTemp', 'U': 'C', 'R': ['4/31', '999'], 'L': 1 },
    { 'I': 3104, 'T': 'T', 'D': 'targetTemp', 'U': 'F', 'R': ['39/88', '999'], 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 2 },
    { 'I': 3116, 'T': 'S', 'D': 'valveError', 'R': '0/1', 'L': 2 },
    { 'I': 3117, 'T': 'S', 'D': 'mode', 'R': '0/5', 'L': 2 },
    { 'I': 3118, 'T': 'S', 'D': 'status', 'R': '0/1', 'L': 2 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 3121, 'T': 'S', 'D': 'valvePos', 'U': '%', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 3122, 'T': 'S', 'D': 'boostMinutes', 'U': '%', 'R': ['0/1440', '-1'], 'L': 2 },
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHRGBW2 = {
  'blk': [
    { 'I': 1, 'D': 'light_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 1101, 'T': 'S', 'D': 'output', 'R': '0/1', 'L': 1 },
    { 'I': 5105, 'T': 'S', 'D': 'red', 'R': '0/255', 'L': 1 },
    { 'I': 5106, 'T': 'S', 'D': 'green', 'R': '0/255', 'L': 1 },
    { 'I': 5107, 'T': 'S', 'D': 'blue', 'R': '0/255', 'L': 1 },
    { 'I': 5108, 'T': 'S', 'D': 'white', 'R': '0/255', 'L': 1 },
    { 'I': 5102, 'T': 'S', 'D': 'gain', 'R': '0/100', 'L': 1 },
    { 'I': 5109, 'T': 'S', 'D': 'effect', 'R': '0/3', 'L': 1 },
    { 'I': 4101, 'T': 'P', 'D': 'power', 'U': 'W', 'R': ['0/288', '-1'], 'L': 1 },
    { 'I': 4103, 'T': 'E', 'D': 'energy', 'U': 'Wmin', 'R': ['U32', '-1'], 'L': 1 },
    { 'I': 6102, 'T': 'A', 'D': 'overpower', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 2101, 'T': 'S', 'D': 'input', 'R': '0/1', 'L': 2 },
    { 'I': 2102, 'T': 'EV', 'D': 'inputEvent', 'R': ['S/L', ''], 'L': 2 },
    { 'I': 2103, 'T': 'EVC', 'D': 'inputEventCnt', 'R': 'U16', 'L': 2 },
    { 'I': 9101, 'T': 'S', 'D': 'mode', 'R': 'color/white', 'L': 2 },
  ],
};

const SHHT1_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 3101, 'T': 'T', 'D': 'extTemp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'extTemp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 3103, 'T': 'H', 'D': 'humidity', 'R': ['0/100', '999'], 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9102, 'T': 'EV', 'D': 'wakeupEvent', 'R': ['battery/button/periodic/poweron/sensor/alarm', 'unknown'], 'L': 2 },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHSM1_CITS = {
  'G': [
    [0, 9103, 0],
    [0, 3101, 999],
    [0, 3102, 999],
    [0, 6105, -1],
    [0, 3115, 0],
    [0, 3111, -1],
    [0, 9102, ['unknown']],
  ],
};

const SHSM1_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 2 },
    { 'I': 3101, 'T': 'T', 'D': 'extTemp', 'U': 'C', 'R': ['-55/125', '999'], 'L': 1 },
    { 'I': 3102, 'T': 'T', 'D': 'extTemp', 'U': 'F', 'R': ['-67/257', '999'], 'L': 1 },
    { 'I': 6105, 'T': 'A', 'D': 'smoke', 'R': ['0/1', '-1'], 'L': 1 },
    { 'I': 3115, 'T': 'S', 'D': 'sensorError', 'R': '0/1', 'L': 1 },
    { 'I': 3111, 'T': 'B', 'D': 'battery', 'R': ['0/100', '-1'], 'L': 2 },
    { 'I': 9102, 'T': 'EV', 'D': 'wakeupEvent', 'R': ['battery/button/periodic/poweron/sensor/alarm', 'unknown'], 'L': 2 },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHGS1_CITS = {
  'G': [
    [0, 9103, 0],
    [0, 3113, 'normal'],
    [0, 3114, 'not_completed'],
    [0, 6108, 'none'],
    [0, 3107, 0],
    [0, 1105, 'closed'],
  ],
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SHGS1_CITD = {
  'blk': [
    { 'I': 1, 'D': 'sensor_0' },
    { 'I': 2, 'D': 'valve_0' },
    { 'I': 3, 'D': 'device' },
  ],
  'sen': [
    { 'I': 9103, 'T': 'EVC', 'D': 'cfgChanged', 'R': 'U16', 'L': 3 },
    { 'I': 3113, 'T': 'S', 'D': 'sensorOp', 'R': ['warmup/normal/fault', 'unknown'], 'L': 1 },
    { 'I': 3114, 'T': 'S', 'D': 'selfTest', 'R': 'not_completed/completed/running/pending', 'L': 1 },
    { 'I': 6108, 'T': 'A', 'D': 'gas', 'R': ['none/mild/heavy/test', 'unknown'], 'L': 1 },
    { 'I': 3107, 'T': 'C', 'D': 'concentration', 'U': 'ppm', 'R': ['U16', '-1'], 'L': 1 },
    { 'I': 1105, 'T': 'S', 'D': 'valve', 'R': ['closed/opened/not_connected/failure/closing/opening/checking', 'unknown'], 'L': 2 },
  ],
};
