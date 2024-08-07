/**
 * This file contains the ble functions.
 *
 * @file src\ble.ts
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

/*
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnsiLogger, TimestampFormat, db, debugStringify, dn, hk, nf, rs, wr, zb } from 'matterbridge/logger';

import { createRequire } from 'module';
import type { Peripheral, Service } from '@stoprocent/noble';

const require = createRequire(import.meta.url);
let noble: typeof import('@stoprocent/noble');

//import noble from '@stoprocent/noble';

// $env:BLUETOOTH_HCI_SOCKET_USB_VID = '8087'  # Vendor ID for Intel Corporation
// $env:BLUETOOTH_HCI_SOCKET_USB_PID = '0026'  # Product ID
// $env:DEBUG = 'noble*'

// Setting the environment variables in the code
// process.env['BLUETOOTH_HCI_SOCKET_USB_VID'] = '8087'; // Intel Corporation Vendor ID
// process.env['BLUETOOTH_HCI_SOCKET_USB_PID'] = '0026'; // Product ID

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const BLE_SHELLY_SERVICE_UUID = '1800';

process.on('SIGINT', async function () {
  // eslint-disable-next-line no-console
  console.log('Caught interrupt signal');
  bleDiscover.stopScanning();
  bleDiscover.logPeripheral();
  process.exit();
});

process.on('SIGQUIT', async function () {
  // eslint-disable-next-line no-console
  console.log('Caught interrupt signal');
  bleDiscover.stopScanning();
  bleDiscover.logPeripheral();
  process.exit();
});

process.on('SIGTERM', async function () {
  // eslint-disable-next-line no-console
  console.log('Caught interrupt signal');
  bleDiscover.stopScanning();
  bleDiscover.logPeripheral();
  process.exit();
});

function loadNoble(hciId?: number) {
  // load noble driver with the correct device selected
  if (hciId !== undefined) {
    process.env.NOBLE_HCI_DEVICE_ID = hciId.toString();
  }
  noble = require('@stoprocent/noble');
}

export class NobleBleClient {
  private readonly discoveredPeripherals = new Map<
    string,
    {
      peripheral: Peripheral;
      manufacturerData: string;
      serviceUuids: string[];
      name?: string;
    }
  >();
  private shouldScan = false;
  private isScanning = false;
  private nobleState = 'unknown';
  private log;

  constructor() {
    this.log = new AnsiLogger({ logName: 'bleShellyDiscover', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

    loadNoble();
    try {
      noble.reset();
    } catch (error: unknown) {
      this.log.debug(`Error resetting Noble (can be ignored): ${(error as unknown as Error).message}`);
    }
    noble.on('stateChange', (state) => {
      this.nobleState = state;
      this.log.debug(`Noble state changed to ${state}`);
      if (state === 'poweredOn') {
        if (this.shouldScan) {
          this.startScanning();
        }
      } else {
        this.stopScanning();
      }
    });
    noble.on('discover', async (peripheral) => {
      //this.log.debug('Noble discover...');
      await this.handleDiscoveredDevice(peripheral);
    });
    noble.on('scanStart', () => {
      this.log.debug('Noble start scanning...');
      this.isScanning = true;
    });
    noble.on('scanStop', () => {
      this.log.debug('Noble stop scanning...');
      this.isScanning = false;
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async startScanning(serviceUUIDs?: string[] | undefined, allowDuplicates?: boolean | undefined) {
    if (this.isScanning) {
      this.log.debug('Scanning already in progress ...');
      return;
    }
    this.log.debug('Starting BLE scanning for Shelly Devices for ...');
    this.shouldScan = true;
    if (this.nobleState === 'poweredOn') {
      await noble.startScanningAsync(undefined, true);
      //await noble.startScanningAsync([BLE_SHELLY_SERVICE_UUID], false);
      //await noble.startScanningAsync(serviceUUIDs, allowDuplicates);
      this.log.debug('Started BLE scanning for Shelly Devices');
    } else {
      this.log.debug('Noble state is not poweredOn ... delay scanning till Noble state is poweredOn');
    }
  }

  public async stopScanning() {
    this.shouldScan = false;
    this.log.debug('Stopping BLE scanning for Shelly Devices ...');
    await noble.stopScanningAsync();
    this.log.debug('Stopped BLE scanning for Shelly Devices');
  }

  private async handleDiscoveredDevice(peripheral: Peripheral) {
    // The advertisement data contains a name, power level (if available), certain advertised service uuids,
    // as well as manufacturer data.
    // {"localName":"MATTER-3840","serviceData":[{"uuid":"fff6","data":{"type":"Buffer","data":[0,0,15,241,255,1,128,0]}}],"serviceUuids":["fff6"],
    // "solicitationServiceUuids":[],"serviceSolicitationUuids":[]}

    // Shelly 15 0xa90b0105000b01100a1897d6931744
    // [16:04:47.990] [bleShellyDiscover] Found peripheral 44:17:93:d6:97:1a (): {"localName":"","txPowerLevel":-1284976214,
    // "manufacturerData":{"type":"Buffer","data":[169,11,1,5,0,11,1,16,10,24,151,214,147,23,68]},"serviceData":[],"serviceUuids":[]}

    // console.log(peripheral.advertisement);
    if (!peripheral.connectable) {
      this.log.debug(`Peripheral ${peripheral.address} is not connectable ... ignoring`);
      return;
    }
    if (peripheral.addressType === 'public') {
      //this.log.debug(`Peripheral ${peripheral.address} addressType is not public ... ignoring`);
      //return;
    }
    if (!peripheral.advertisement.localName) {
      //this.log.debug(`Peripheral ${peripheral.address} has no localName ... ignoring`);
      //return;
    }

    this.log.debug(
      `Found peripheral ${zb}${peripheral.address}${db} (${peripheral.addressType}) name ${hk}${peripheral.advertisement.localName}${db} connectable ${peripheral.connectable}`,
    );
    this.log.debug(`- rssi ${peripheral.rssi} mtu ${peripheral.mtu} state ${peripheral.state}`);
    this.log.debug(`- advertisement: ${JSON.stringify(peripheral.advertisement)}`);
    this.log.debug(`- txPowerLevel: ${peripheral.advertisement.txPowerLevel}`);
    this.log.debug(`- manufacturerData: ${JSON.stringify(peripheral.advertisement.manufacturerData)}`);
    this.log.debug(`- serviceData: ${peripheral.advertisement.serviceData.length > 0 ? zb : ''}${JSON.stringify(peripheral.advertisement.serviceData)}`);
    this.log.debug(`- serviceUuids: ${peripheral.advertisement.serviceUuids.length > 0 ? zb : ''}${JSON.stringify(peripheral.advertisement.serviceUuids)}`);

    const manufacturerData = peripheral.advertisement.manufacturerData?.toString('hex');
    //if (peripheral.advertisement.localName !== 'EveEnergy5125F') {
    if (!manufacturerData || !manufacturerData.startsWith('a90b')) {
      this.log.debug(`Peripheral ${peripheral.address} is not a Shelly device ... ignoring`);
      return;
    }
    //}

    //const matterServiceData = peripheral.advertisement.serviceData.find((serviceData) => serviceData.uuid === BLE_SHELLY_SERVICE_UUID);
    //if (matterServiceData === undefined || matterServiceData.data.length !== 8) {
    //  this.log.info(`Peripheral ${peripheral.address} does not advertise Shelly Service ... ignoring`);
    //  return;
    //}

    if (!this.discoveredPeripherals.has(peripheral.address)) {
      this.log.warn(`Exploring peripheral ${peripheral.address} and adding to discovered devices ...`);
      this.discoveredPeripherals.set(peripheral.address, { peripheral, manufacturerData, serviceUuids: peripheral.advertisement.serviceUuids });
      await this.stopScanning();
      await this.explore(peripheral);
      this.isScanning = false;
      await this.startScanning();
    }
  }

  async explore(peripheral: Peripheral) {
    const entry = this.discoveredPeripherals.get(peripheral.address);

    peripheral.on('connect', (error: string) => {
      if (error) this.log.error(`Peripheral ${peripheral.address} connect error ${error}`);
      else this.log.debug(`Peripheral ${peripheral.address} connected`);
    });
    peripheral.on('disconnect', (error: string) => {
      if (error) this.log.error(`Peripheral ${peripheral.address} disconnect error ${error}`);
      else this.log.debug(`Peripheral ${peripheral.address} disconnected`);
    });
    peripheral.on('servicesDiscover', (services: Service[]) => {
      this.log.debug(`Peripheral ${peripheral.address} servicesDiscover services ${services.length}`);
    });

    // Connect to the peripheral
    await peripheral.connectAsync();
    this.log.warn(`Connected to ${peripheral.address}`);

    // Once connected, discover services
    if (peripheral.state !== 'connected') return;
    const services = await peripheral.discoverServicesAsync([]);
    for (const service of services) {
      // Update the map with new services
      if (entry && !entry.serviceUuids.find((uuid) => uuid === service.uuid)) {
        entry.serviceUuids.push(service.uuid);
        this.log.info(`Added service ${service.uuid}`);
      }
      let serviceInfo = service.uuid;
      if (service.name) serviceInfo += ` (${service.name})`;
      this.log.info(`- discovered service ${serviceInfo}`);

      // Discover characteristics
      if (peripheral.state !== 'connected') return;
      const characteristics = await service.discoverCharacteristicsAsync([]);
      for (const characteristic of characteristics) {
        let characteristicInfo = characteristic.uuid;
        if (characteristic.name) characteristicInfo += ` (${characteristic.name})`;
        if (characteristic.type) characteristicInfo += ` type: ${characteristic.type}`;
        this.log.info(`  - discovered characteristic ${characteristicInfo} properties ${characteristic.properties.join(', ')}`);
        if (characteristic.properties.includes('read')) {
          if (peripheral.state !== 'connected') return;
          const data = await characteristic.readAsync();
          if (data) {
            const string = data.toString('ascii');
            this.log.info(`    - read: ${string}`);
            // Update the map with the name of the peripheral name
            if (entry && service.uuid === '1800' && characteristic.uuid === '2a00') {
              entry.name = string;
            }
          }
        }
        if (peripheral.state !== 'connected') return;
        const descriptors = await characteristic.discoverDescriptorsAsync();
        for (const descriptor of descriptors) {
          let descriptorInfo = descriptor.uuid;
          if (descriptor.name) descriptorInfo += ` (${descriptor.name})`;

          this.log.info(`    - discovered descriptor ${descriptorInfo}`);
          if (peripheral.state !== 'connected') return;
          const data = await descriptor.readValueAsync();
          if (data) {
            this.log.info(`      - read: ${data.toString()}`);
          }
        }
        //console.log(characteristic);
      }
    }

    // Update the map
    if (entry) this.discoveredPeripherals.set(peripheral.address, entry);

    await peripheral.disconnectAsync();
    peripheral.removeAllListeners();
    this.log.warn(`Disconnected from ${peripheral.address}`);
  }

  logPeripheral() {
    this.log.info('Discovered peripherals:');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [address, { peripheral, manufacturerData, serviceUuids, name }] of this.discoveredPeripherals) {
      this.log.info(`- ${address} ${name ?? ''} manufacturerData: ${manufacturerData} services: ${serviceUuids.join(', ')}`);
    }
  }
}

const bleDiscover = new NobleBleClient();
await bleDiscover.startScanning([], true);
*/
