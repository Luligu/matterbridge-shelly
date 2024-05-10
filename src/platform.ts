/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DeviceTypes, PlatformConfig, PlatformConfigValue, WindowCovering, WindowCoveringCluster } from 'matterbridge';
import { Matterbridge, MatterbridgeDevice, MatterbridgeDynamicPlatform } from 'matterbridge';
import { AnsiLogger, debugStringify, dn, hk, nf, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';

// import shellies, { Device } from 'shellies';

import { Device, DeviceId, DeviceIdentifiers, DeviceDiscoverer, MdnsDeviceDiscoverer, Shellies, WiFiAttributes, WiFi, Ethernet } from 'shellies-ng';

import path from 'path';

type DeviceIp = {
  [key: string]: string;
};

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  private shellyDevices: DeviceIdentifiers[] = [];
  private bridgedDevices: MatterbridgeDevice[] = [];

  // NodeStorageManager
  private nodeStorageManager?: NodeStorageManager;
  private nodeStorage?: NodeStorage;

  // Shelly
  private shellies?: Shellies;
  private mdnsDiscoverer?: MdnsDeviceDiscoverer;
  private storageDiscoverer?: StorageDeviceDiscoverer;
  private configDiscoverer?: ConfigDeviceDiscoverer;

  // Config
  private username = '';
  private password = '';
  private whiteList: string[] = [];
  private blackList: string[] = [];
  private deviceIp: DeviceIp = {};

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    if (config.whiteList) this.whiteList = config.whiteList as string[];
    if (config.blackList) this.blackList = config.blackList as string[];
    if (config.deviceIp) this.deviceIp = config.deviceIp as DeviceIp;

    // create Shelly client
    this.shellies = new Shellies();

    // Handle when a new device has been discovered
    this.shellies.on('add', async (device: Device) => {
      this.log.info(`Shellies discovered device with ID: ${device.id}, model: ${device.modelName} (${device.model})`);
      this.log.info(`- macAddress: ${device.macAddress}`);
      this.log.info(`- firmware: ${device.firmware.version} (${device.firmware.id})`);
      this.log.info('- components:');
      for (const [key, component] of device) {
        this.log.info(`  - ${component.name} (${key})`);
      }
      let hostname: string | undefined;
      if (device.hasComponent('wifi')) {
        const wifiComponent = device.getComponent('wifi') as WiFi;
        if (wifiComponent) {
          this.log.info('- WiFi IP address:', wifiComponent.sta_ip);
          this.log.info('- WiFi status:', wifiComponent.status);
          this.log.info('- WiFi SSID:', wifiComponent.ssid);
          this.log.info('- WiFi signal strength:', wifiComponent.rssi);
          if (wifiComponent.status === 'got ip' && wifiComponent.sta_ip) {
            hostname = wifiComponent.sta_ip;
          } else this.log.error('WiFi status is not "got ip" or IP address is not set');
        } else {
          this.log.error('Failed to retrieve WiFi component');
        }
      } else {
        this.log.debug('Device does not have a WiFi component');
      }
      if (device.hasComponent('eth')) {
        const ethComponent = device.getComponent('eth') as Ethernet;
        if (ethComponent) {
          this.log.info('- Ethernet IP address:', ethComponent.ip);
          if (ethComponent.ip) {
            hostname = ethComponent.ip;
          } else this.log.error('Ethernet IP address is not set');
        } else {
          this.log.error('Failed to retrieve Ethernet component');
        }
      } else {
        this.log.debug('Device does not have an Ethernet component');
      }
      if (hostname) {
        this.shellyDevices.push({ deviceId: device.id, hostname: hostname });
        await this.nodeStorage?.set<DeviceIdentifiers[]>('DeviceIdentifiers', this.shellyDevices);
        this.log.info(`**Stored deviceId: ${hk}${device.id}${nf} hostname: ${zb}${hostname}${nf}`);
      } else this.log.error('Failed to retrieve device hostname');

      // eslint-disable-next-line no-console
      // console.log('Device:', device);
    });

    // Handle remove device
    this.shellies.on('remove', (device: Device) => {
      this.log.warn(`Shellies removed device with ID: ${device.id}, model: ${device.modelName} (${device.model})`);
    });

    // Handle error
    this.shellies.on('error', (deviceId: DeviceId, error: Error) => {
      this.log.error('Shellies error occured:', error.message);
    });

    // Handle exclude
    this.shellies.on('exclude', (deviceId: DeviceId) => {
      this.log.warn(`Shellies exclude device with ID: ${deviceId}`);
    });

    // Handle unknown
    this.shellies.on('unknown', (deviceId: DeviceId, model: string, identifiers: DeviceIdentifiers) => {
      this.log.warn(`Shellies removed device with ID: ${deviceId}, model: ${model} hostname: ${identifiers.hostname}`);
    });

    this.log.info('Finished initializing platform:', this.config.name);
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');

    // create NodeStorageManager
    this.nodeStorageManager = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly'),
      logging: false,
    });
    this.nodeStorage = await this.nodeStorageManager.createStorage('devices');

    // create an mDNS device discoverer and register it with the shellies client
    if (this.config.enableMdnsDiscover === true) {
      this.log.info('Loading mdns discover...');
      this.mdnsDiscoverer = new MdnsDeviceDiscoverer();
      this.shellies?.registerDiscoverer(this.mdnsDiscoverer);
    }

    // create a storage device discoverer and register it with the shellies client
    this.storageDiscoverer = new StorageDeviceDiscoverer(this.shellyDevices, this.nodeStorage);
    this.shellies?.registerDiscoverer(this.storageDiscoverer);

    // create a config device discoverer and register it with the shellies client
    this.configDiscoverer = new ConfigDeviceDiscoverer(this.shellyDevices, this.config);
    this.shellies?.registerDiscoverer(this.configDiscoverer);

    // log errors
    this.mdnsDiscoverer?.on('error', (error: Error) => {
      this.log.error('An error occurred in the mDNS device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });
    this.storageDiscoverer.on('error', (error: Error) => {
      this.log.error('An error occurred in the storage device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });
    this.configDiscoverer.on('error', (error: Error) => {
      this.log.error('An error occurred in the config device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });

    // start discovering devices
    this.log.info('Discovering Shellies...');
    await this.mdnsDiscoverer?.start();
    await this.storageDiscoverer.start();
    await this.configDiscoverer.start();
  }

  override async onConfigure() {
    this.log.info('onConfigure called');
  }

  override async onShutdown(reason?: string) {
    this.log.info('onShutdown called with reason:', reason ?? 'none');

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  public validateWhiteBlackList(entityName: string) {
    if (this.whiteList.length > 0 && !this.whiteList.find((name) => name === entityName)) {
      this.log.warn(`Skipping ${dn}${entityName}${wr} because not in whitelist`);
      return false;
    }
    if (this.blackList.length > 0 && this.blackList.find((name) => name === entityName)) {
      this.log.warn(`Skipping ${dn}${entityName}${wr} because in blacklist`);
      return false;
    }
    return true;
  }
}

export class StorageDeviceDiscoverer extends DeviceDiscoverer {
  private shellyDevices: DeviceIdentifiers[] = [];
  private nodeStorage: NodeStorage;

  constructor(shellyDevices: DeviceIdentifiers[], nodeStorage: NodeStorage) {
    super();
    this.shellyDevices = shellyDevices;
    this.nodeStorage = nodeStorage;
  }

  async start() {
    this.shellyDevices = await this.nodeStorage.get<DeviceIdentifiers[]>('DeviceIdentifiers', []);
    this.shellyDevices.forEach((device) => {
      // eslint-disable-next-line no-console
      console.log(`${nf}**Storage deviceId: ${hk}${device.deviceId}${nf} hostname: ${zb}${device.hostname}${nf}`);
      this.handleDiscoveredDevice({ deviceId: device.deviceId, hostname: device.hostname });
    });
  }
}

export class ConfigDeviceDiscoverer extends DeviceDiscoverer {
  private shellyDevices: DeviceIdentifiers[] = [];
  private config: PlatformConfig;

  constructor(shellyDevices: DeviceIdentifiers[], config: PlatformConfig) {
    super();
    this.shellyDevices = shellyDevices;
    this.config = config;
  }

  async start() {
    if (!this.config.deviceIp) return;
    Object.entries(this.config.deviceIp as Record<string, PlatformConfigValue>).forEach(([key, value]) => {
      console.log(`${nf}**Config deviceId: ${hk}${key}${nf} hostname: ${zb}${value}${nf}`);
      this.handleDiscoveredDevice({ deviceId: key, hostname: value as string });
    });
  }
}
