/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  DeviceTypes,
  EndpointNumber,
  FixedLabelCluster,
  OnOff,
  OnOffCluster,
  PlatformConfig,
  PlatformConfigValue,
  PowerSource,
  WindowCovering,
  WindowCoveringCluster,
  onOffSwitch,
} from 'matterbridge';
import { Matterbridge, MatterbridgeDevice, MatterbridgeDynamicPlatform } from 'matterbridge';
import { AnsiLogger, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';

// import shellies, { Device } from 'shellies';

import { Device, DeviceId, DeviceIdentifiers, DeviceDiscoverer, MdnsDeviceDiscoverer, Shellies, WiFiAttributes, WiFi, Ethernet, Switch, Input } from 'shellies-ng';

import path from 'path';

type DeviceIp = {
  [key: string]: string;
};

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  private shellyDevices = new Map<DeviceId, DeviceIdentifiers>();
  private bridgedDevices = new Map<DeviceId, MatterbridgeDevice>();

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
      this.log.info(`Shellies discovered device with ID: ${idn}${device.id}${rs}${nf}, model: ${hk}${device.modelName}${nf} (${device.model})`);
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
          this.log.info('- WiFi IP address:', zb, wifiComponent.sta_ip, nf);
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
          this.log.info('- Ethernet IP address:', zb, ethComponent.ip, nf);
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
        this.shellyDevices.set(device.id, { deviceId: device.id, hostname: hostname });
        await this.saveShellyDevices();
        this.log.info(`Stored deviceId: ${hk}${device.id}${nf} hostname: ${zb}${hostname}${nf}`);
      } else {
        this.log.error('Failed to retrieve device hostname');
        return;
      }
      console.log('Device:', device);

      // Create a new Matterbridge device for the shelly device
      for (const [key, component] of device) {
        if (component.name === 'Input') {
          const inputComponent = device.getComponent(key) as Input;
          if (inputComponent) {
            this.log.info(`${hk}${device.id}${nf} - Input status:`, inputComponent.state);
          } else {
            this.log.error('Failed to retrieve Input component');
          }
        }
        if (component.name === 'Switch') {
          const switchComponent = device.getComponent(key) as Switch;
          if (switchComponent) {
            this.log.info(`${hk}${device.id}${nf} - Switch status:`, switchComponent.output);
            if (switchComponent.voltage !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch voltage:`, switchComponent.voltage);
            if (switchComponent.current !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch current:`, switchComponent.current);
            if (switchComponent.apower !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch power:`, switchComponent.apower);
            if (switchComponent.aenergy && switchComponent.aenergy.total !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch energy:`, switchComponent.aenergy.total);

            // Create a new Matterbridge device for the switch
            const switchDevice = new MatterbridgeDevice(DeviceTypes.BRIDGED_NODE);
            switchDevice.createDefaultIdentifyClusterServer();
            switchDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
              device.id,
              device.id,
              0xfff1,
              'Shelly',
              device.modelName,
              Number(device.firmware.version?.replace(/\D/g, '')),
              device.firmware.version,
            );
            switchDevice.createDefaultPowerSourceWiredClusterServer(PowerSource.WiredCurrentType.Ac);
            switchDevice.addFixedLabel('composed', component.name);
            const child = switchDevice.addChildDeviceTypeWithClusterServer(key, [onOffSwitch], [OnOff.Complete.id]);
            await this.registerDevice(switchDevice);
            switchDevice.addCommandHandler('on', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, 'on', data.endpoint.number, true);
            });
            switchDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, 'off', data.endpoint.number, false);
            });
            // Save the MatterbridgeDevice in the bridgedDevices map
            this.bridgedDevices.set(device.id, switchDevice);
          } else {
            this.log.error('Failed to retrieve Switch component');
          }
        }
      }
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
      this.log.warn(`Shellies unknown device with ID: ${deviceId}, model: ${model} hostname: ${identifiers.hostname}`);
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
    this.storageDiscoverer = new StorageDeviceDiscoverer(this.nodeStorage);
    this.shellies?.registerDiscoverer(this.storageDiscoverer);

    // create a config device discoverer and register it with the shellies client
    this.configDiscoverer = new ConfigDeviceDiscoverer(this.config);
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

    this.mdnsDiscoverer?.removeAllListeners();
    this.storageDiscoverer?.removeAllListeners();
    this.configDiscoverer?.removeAllListeners();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  private async saveShellyDevices() {
    await this.nodeStorage?.set<DeviceIdentifiers[]>('DeviceIdentifiers', Array.from(this.shellyDevices.values()));
  }

  private async loadShellyDevices() {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return;
    }
    const shellyDevices: DeviceIdentifiers[] = await this.nodeStorage.get<DeviceIdentifiers[]>('DeviceIdentifiers', []);
    return shellyDevices;
  }

  private shellySwitchCommandHandler(matterbridgeDevice: MatterbridgeDevice, command: string, endpointNumber: EndpointNumber | undefined, state: boolean): boolean {
    if (!endpointNumber) {
      this.log.error('shellyCommandHandler error: endpointNumber undefined');
      return false;
    }
    const endpoint = matterbridgeDevice.getChildEndpoint(endpointNumber);
    if (!endpoint) {
      this.log.error('shellyCommandHandler error: endpoint undefined');
      return false;
    }
    const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
    // this.log.debug('getChildStatePayload labelList:', labelList);
    if (!labelList) {
      this.log.error('shellyCommandHandler error: labelList undefined');
      return false;
    }
    let endpointName = '';
    for (const entry of labelList) {
      if (entry.label === 'endpointName') endpointName = entry.value;
    }
    if (endpointName === '') {
      this.log.error('shellyCommandHandler error: endpointName not found');
      return false;
    }
    const cluster = endpoint.getClusterServer(OnOffCluster);
    if (!cluster) {
      this.log.error('shellyCommandHandler error: cluster not found');
      return false;
    }
    cluster?.setOnOffAttribute(true);
    const shellyDevice = this.shellies?.get(matterbridgeDevice.serialNumber!);
    const switchComponent = shellyDevice?.getComponent(endpointName) as Switch;
    switchComponent?.set(state);
    if (this.shellies && shellyDevice && switchComponent)
      this.log.info(`Command ${command} called for endpoint: ${or}${endpointNumber}${nf} cluster: ${cluster.name} for shelly: ${shellyDevice?.id}`);
    else this.log.error(`Failed to send ${command} command for endpoint: ${or}${endpointNumber}${nf} cluster: ${cluster?.name} for shelly: ${shellyDevice?.id}`);
    return true;
  }

  private validateWhiteBlackList(entityName: string) {
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
  private nodeStorage: NodeStorage;

  constructor(nodeStorage: NodeStorage) {
    super();
    this.nodeStorage = nodeStorage;
  }

  async start() {
    const shellyDevices = await this.nodeStorage.get<DeviceIdentifiers[]>('DeviceIdentifiers', []);
    shellyDevices.forEach((device) => {
      // eslint-disable-next-line no-console
      console.log(`${nf}StorageDeviceDiscoverer deviceId: ${hk}${device.deviceId}${nf} hostname: ${zb}${device.hostname}${nf}`);
      this.handleDiscoveredDevice({ deviceId: device.deviceId, hostname: device.hostname });
    });
  }
}

export class ConfigDeviceDiscoverer extends DeviceDiscoverer {
  private config: PlatformConfig;

  constructor(config: PlatformConfig) {
    super();
    this.config = config;
  }

  async start() {
    if (!this.config.deviceIp) return;
    Object.entries(this.config.deviceIp as Record<string, PlatformConfigValue>).forEach(([key, value]) => {
      // eslint-disable-next-line no-console
      console.log(`${nf}ConfigDeviceDiscoverer deviceId: ${hk}${key}${nf} hostname: ${zb}${value}${nf}`);
      this.handleDiscoveredDevice({ deviceId: key, hostname: value as string });
    });
  }
}
