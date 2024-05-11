// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnsiLogger, TimestampFormat, debugStringify, dn, hk, nf, rs, wr, zb } from 'node-ansi-logger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import noble from '@stoprocent/noble';
import type { Peripheral } from '@stoprocent/noble';

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

    try {
      noble.reset();
    } catch (error: unknown) {
      this.log.debug(`Error resetting BLE device via noble (can be ignored, we just tried): ${(error as unknown as Error).message}`);
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
      this.log.debug('Noble discover...');
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

  public async startScanning() {
    if (this.isScanning) return;

    this.shouldScan = true;
    if (this.nobleState === 'poweredOn') {
      this.log.debug('Start BLE scanning for Shelly Devices ...');
      //await noble.startScanningAsync([BLE_SHELLY_SERVICE_UUID], false);
      await noble.startScanningAsync(undefined, false);
    } else {
      this.log.debug('noble state is not poweredOn ... delay scanning till poweredOn');
    }
  }

  public async stopScanning() {
    this.shouldScan = false;
    this.log.debug('Stop BLE scanning for Shelly Devices ...');
    await noble.stopScanningAsync();
  }

  private async handleDiscoveredDevice(peripheral: Peripheral) {
    // The advertisement data contains a name, power level (if available), certain advertised service uuids,
    // as well as manufacturer data.
    // {"localName":"MATTER-3840","serviceData":[{"uuid":"fff6","data":{"type":"Buffer","data":[0,0,15,241,255,1,128,0]}}],"serviceUuids":["fff6"],
    // "solicitationServiceUuids":[],"serviceSolicitationUuids":[]}

    // Shelly 15 0xa90b0105000b01100a1897d6931744
    // [16:04:47.990] [bleShellyDiscover] Found peripheral 44:17:93:d6:97:1a (): {"localName":"","txPowerLevel":-1284976214,
    // "manufacturerData":{"type":"Buffer","data":[169,11,1,5,0,11,1,16,10,24,151,214,147,23,68]},"serviceData":[],"serviceUuids":[]}
    this.log.debug(`Found peripheral ${peripheral.address} (${peripheral.addressType}) name ${peripheral.advertisement.localName} connectable ${peripheral.connectable}`);
    this.log.debug(`- rssi ${peripheral.rssi} mtu ${peripheral.mtu} state ${peripheral.state} connectable ${peripheral.connectable} `, peripheral.services);
    this.log.debug(`- advertisement: ${JSON.stringify(peripheral.advertisement)}`);
    this.log.debug(`- serviceUuids: ${JSON.stringify(peripheral.advertisement.serviceUuids)}`);

    // console.log(peripheral.advertisement);
    if (!peripheral.connectable) {
      this.log.debug(`Peripheral ${peripheral.address} is not connectable ... ignoring`);
      return;
    }
    const manufacturerData = peripheral.advertisement.manufacturerData?.toString('hex');
    if (!manufacturerData || !manufacturerData.startsWith('a90b')) {
      this.log.debug(`Peripheral ${peripheral.address} is not a Shelly device ... ignoring`);
      return;
    }
    /*
    const matterServiceData = peripheral.advertisement.serviceData.find((serviceData) => serviceData.uuid === BLE_SHELLY_SERVICE_UUID);
    if (matterServiceData === undefined || matterServiceData.data.length !== 8) {
      this.log.info(`Peripheral ${peripheral.address} does not advertise Shelly Service ... ignoring`);
      return;
    }
    */

    if (!this.discoveredPeripherals.has(peripheral.address)) {
      this.log.warn(`Exploring peripheral ${peripheral.address} and adding to discovered devices ...`);
      this.discoveredPeripherals.set(peripheral.address, { peripheral, manufacturerData, serviceUuids: peripheral.advertisement.serviceUuids });
      //await this.stopScanning();
      await this.explore(peripheral);
      await this.startScanning();
    }
  }

  async explore(peripheral: Peripheral) {
    const entry = this.discoveredPeripherals.get(peripheral.address);

    // Connect to the peripheral
    await peripheral.connectAsync();
    this.log.warn(`Connected to ${peripheral.address}`);

    // Once connected, discover services
    const services = await peripheral.discoverServicesAsync([]);
    for (const service of services) {
      if (entry && !entry.serviceUuids.find((uuid) => uuid === service.uuid)) {
        entry.serviceUuids.push(service.uuid);
        this.log.info(`Added service ${service.uuid}`);
      }
      let serviceInfo = service.uuid;
      if (service.name) serviceInfo += ` (${service.name})`;
      this.log.info(`- discovered service ${serviceInfo}`);

      // Discover characteristics
      const characteristics = await service.discoverCharacteristicsAsync([]);
      for (const characteristic of characteristics) {
        let characteristicInfo = `  ${characteristic.uuid}`;
        if (characteristic.name) characteristicInfo += ` (${characteristic.name})`;
        if (characteristic.type) characteristicInfo += ` type: ${characteristic.type}`;
        this.log.info(`  - discovered characteristic ${characteristicInfo} properties ${characteristic.properties.join(', ')}`);
        if (characteristic.properties.includes('read')) {
          const data = await characteristic.readAsync();
          if (data) {
            const string = data.toString('ascii');
            this.log.info(`    - read ${string}`);
            if (entry && service.uuid === '1800' && characteristic.uuid === '2a00') {
              entry.name = string;
            }
          }
        }
        const descriptors = await characteristic.discoverDescriptorsAsync();
        for (const descriptor of descriptors) {
          this.log.info(`    - discovered descriptor ${descriptor.uuid} (${descriptor.name})`);
          const data = await descriptor.readValueAsync();
          if (data) {
            this.log.info(`      - read ${data.toString()}`);
          }
        }
        //console.log(characteristic);
      }
    }

    // Update the map
    if (entry) this.discoveredPeripherals.set(peripheral.address, entry);

    await peripheral.disconnectAsync();
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
await bleDiscover.startScanning();
