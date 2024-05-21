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
import { AnsiLogger, db, debugStringify, dn, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';

import { CoapMessage, CoapServer } from './coapScanner.js';

// Shellyies gen 1
import shellies1g, { Device as Device1g } from 'shellies';

// Shellyies gen 2
import { Device, DeviceId, DeviceIdentifiers, DeviceDiscoverer, Shellies, Switch, Cover, CharacteristicValue } from 'shellies-ng';

import path from 'path';
import fetch from 'node-fetch';

import { MdnsScanner } from './mdnsScanner.js';

type ConfigDeviceIp = Record<string, string>;

// Shelly device map
type ShellyDeviceId = string;

interface ShellyDevice {
  id: ShellyDeviceId; // ID: shellyplus1pm-441793d69718
  hostname: string; // IP address: 192.168.1.xxx
}

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  public shellyDevices = new Map<ShellyDeviceId, ShellyDevice>();
  public bridgedDevices = new Map<ShellyDeviceId, MatterbridgeDevice>();

  // NodeStorageManager
  private nodeStorageManager?: NodeStorageManager;
  private nodeStorage?: NodeStorage;

  // Shelly 1
  private shellies1g = shellies1g;
  // Shelly 2+
  private shellies?: Shellies;
  private mdnsDiscoverer?: MdnsDeviceDiscoverer;
  private storageDiscoverer?: StorageDeviceDiscoverer;
  private configDiscoverer?: ConfigDeviceDiscoverer;

  // Config
  private username = '';
  private password = '';
  private whiteList: string[] = [];
  private blackList: string[] = [];
  private deviceIp: ConfigDeviceIp = {};

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    if (config.whiteList) this.whiteList = config.whiteList as string[];
    if (config.blackList) this.blackList = config.blackList as string[];
    if (config.deviceIp) this.deviceIp = config.deviceIp as ConfigDeviceIp;

    // Use Shelly gen 1 client
    this.shellies1g.on('add', async (device: Device1g) => {
      this.log.info(`Shellies gen 1 added device with ID ${idn}${device.id}${rs}${nf}, host ${device.host} and type ${device.type}`);

      // console.log('Device:', device);
      this.log.info(`- macAddress: ${device.id}`);
      this.log.info(`- host: ${device.host}`);
      // this.log.info(`- status: ${debugStringify(await device.getStatus())}`);
      // this.log.info(`- settings: ${debugStringify(await device.getSettings())}`);
      this.log.info('- properties:');
      for (const [property, value] of device) {
        this.log.info(`  - ${property}: ${value}`);
      }

      // Create a new Matterbridge device for the switch
      const switchDevice = new MatterbridgeDevice(DeviceTypes.BRIDGED_DEVICE_WITH_POWERSOURCE_INFO);
      switchDevice.createDefaultBridgedDeviceBasicInformationClusterServer(device.id, device.id, 0xfff1, 'Shelly', device.modelName);
      switchDevice.createDefaultPowerSourceConfigurationClusterServer();
      switchDevice.createDefaultPowerSourceWiredClusterServer(PowerSource.WiredCurrentType.Ac);

      for (const [property, value] of device) {
        // this.log.info(`  - ${property}: ${value}`);
        if (property.startsWith('switch') || property.startsWith('relay')) {
          // Add a child enpoint for each switch
          const child = switchDevice.addChildDeviceTypeWithClusterServer(property, [onOffSwitch], [OnOff.Complete.id]);
          // Set the OnOff attribute
          child.getClusterServer(OnOffCluster)?.setOnOffAttribute(value);

          // Add event handler
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          device.on('change', (prop, newValue, oldValue) => {
            // this.log.info('', prop, 'changed from', oldValue, 'to', newValue);
            this.shellySwitchUpdateHandler(switchDevice, device, property, prop, newValue);
          });

          // Add command handlers http://192.168.1.219/light/0?brightness=100
          switchDevice.addCommandHandler('on', async (data) => {
            this.shellySwitchCommandHandler(switchDevice, device, 'on', data.endpoint.number, true);
          });
          switchDevice.addCommandHandler('off', async (data) => {
            this.shellySwitchCommandHandler(switchDevice, device, 'off', data.endpoint.number, false);
          });

          switchDevice.addFixedLabel('composed', 'Switch');
        }
      }

      device.on('offline', () => {
        this.log.warn('Device with ID', device.id, 'went offline');
      });

      // Register the device with Matterbridge
      await this.registerDevice(switchDevice);

      // Save the MatterbridgeDevice in the bridgedDevices map
      this.bridgedDevices.set(device.id, switchDevice);
    });

    // create Shelly gen 2 client
    this.shellies = new Shellies();
    this.shellies.on('add', async (device: Device) => {
      this.log.info(`Shellies gen 2 added device with ID: ${idn}${device.id}${rs}${nf}, model: ${hk}${device.modelName}${nf} (${device.model})`);
      this.log.info(`- macAddress: ${device.macAddress}`);
      this.log.info(`- firmware: ${device.firmware.version} (${device.firmware.id})`);
      this.log.info('- components:');
      for (const [key, component] of device) {
        this.log.info(`  - ${component.name} (${key})`);
      }

      // console.log('Device:', device);

      // Create a new Matterbridge device for the switch
      const switchDevice = new MatterbridgeDevice(DeviceTypes.BRIDGED_DEVICE_WITH_POWERSOURCE_INFO);
      switchDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        device.id,
        device.id,
        0xfff1,
        'Shelly',
        device.modelName,
        Number(device.firmware.version?.replace(/\D/g, '')),
        device.firmware.version,
      );
      switchDevice.createDefaultPowerSourceConfigurationClusterServer();
      switchDevice.createDefaultPowerSourceWiredClusterServer(PowerSource.WiredCurrentType.Ac);

      // Scan the device components
      for (const [key, component] of device) {
        if (component.name === 'Switch') {
          if (device.getComponent('cover:0')) continue;
          const switchComponent = device.getComponent(key) as Switch;
          if (switchComponent) {
            this.log.info(`${hk}${device.id}${nf} - Switch status: ${switchComponent.output}`);
            if (switchComponent.voltage !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch voltage: ${switchComponent.voltage}`);
            if (switchComponent.current !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch current: ${switchComponent.current}`);
            if (switchComponent.apower !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch power: ${switchComponent.apower}`);
            if (switchComponent.aenergy && switchComponent.aenergy.total !== undefined) this.log.info(`${hk}${device.id}${nf} - Switch energy: ${switchComponent.aenergy.total}`);

            // Add a child enpoint for each switch
            const child = switchDevice.addChildDeviceTypeWithClusterServer(key, [onOffSwitch], [OnOff.Complete.id]);
            // Set the OnOff attribute
            child.getClusterServer(OnOffCluster)?.setOnOffAttribute(switchComponent.output);

            // Add event handler
            switchComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              // console.log(characteristic, value);
              this.shellySwitchUpdateHandler(switchDevice, device, key, characteristic, value);
            });

            // Add command handlers
            switchDevice.addCommandHandler('on', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, device, 'on', data.endpoint.number, true);
            });
            switchDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, device, 'off', data.endpoint.number, false);
            });
          } else {
            this.log.error('Failed to retrieve Switch component');
          }
          switchDevice.addFixedLabel('composed', component.name);
        }
        if (component.name === 'Cover') {
          const coverComponent = device.getComponent(key) as Cover;
          if (coverComponent) {
            this.log.info(`${hk}${device.id}${nf} - Cover status: ${coverComponent.state}`);
            if (coverComponent.voltage !== undefined) this.log.info(`${hk}${device.id}${nf} - Cover voltage: ${coverComponent.voltage}`);
            if (coverComponent.current !== undefined) this.log.info(`${hk}${device.id}${nf} - Cover current: ${coverComponent.current}`);
            if (coverComponent.apower !== undefined) this.log.info(`${hk}${device.id}${nf} - Cover power: ${coverComponent.apower}`);
            if (coverComponent.aenergy && coverComponent.aenergy.total !== undefined) this.log.info(`${hk}${device.id}${nf} - Cover energy: ${coverComponent.aenergy.total}`);

            // Add a child enpoint for cover
            const child = switchDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.WINDOW_COVERING], [WindowCovering.Cluster.id]);
            // Set the WindowCovering attributes
            switchDevice.setWindowCoveringTargetAsCurrentAndStopped(child);
            /*
            const windowCoveringCluster = child.getClusterServer(
              WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
            );
            if (windowCoveringCluster) {
              const position = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
              if (position !== null) {
                windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(position);
                windowCoveringCluster.setOperationalStatusAttribute({
                  global: WindowCovering.MovementStatus.Stopped,
                  lift: WindowCovering.MovementStatus.Stopped,
                  tilt: 0,
                });
              }
            }
            */
            // Add event handler
            coverComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              this.log.info(`Change: ${characteristic}: ${value}`); // state: stopped opening closing
              this.shellyCoverUpdateHandler(switchDevice, device, key, characteristic, value);
            });
            /*
            // Add command handlers
            switchDevice.addCommandHandler('on', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, device, 'on', data.endpoint.number, true);
            });
            switchDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(switchDevice, device, 'off', data.endpoint.number, false);
            });
            */
          } else {
            this.log.error('Failed to retrieve Cover component');
          }
          switchDevice.addFixedLabel('composed', component.name);
        }
      }

      // Register the device with Matterbridge
      await this.registerDevice(switchDevice);

      // Save the MatterbridgeDevice in the bridgedDevices map
      this.bridgedDevices.set(device.id, switchDevice);
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
    await this.loadShellyDevices();

    // create an mDNS device discoverer and register it with the shellies client
    if (this.config.enableMdnsDiscover === true) {
      this.mdnsDiscoverer = new MdnsDeviceDiscoverer(this, this.log);
      this.shellies?.registerDiscoverer(this.mdnsDiscoverer);
    }

    // create a storage device discoverer and register it with the shellies client
    if (this.config.enableStorageDiscover === true) {
      this.storageDiscoverer = new StorageDeviceDiscoverer(this.log, this.nodeStorage);
      this.shellies?.registerDiscoverer(this.storageDiscoverer);
    }

    // create a config device discoverer and register it with the shellies client
    if (this.config.enableConfigDiscover === true) {
      this.configDiscoverer = new ConfigDeviceDiscoverer(this.log, this.config);
      this.shellies?.registerDiscoverer(this.configDiscoverer);
    }

    // log errors
    this.mdnsDiscoverer?.on('error', (error: Error) => {
      this.log.error('An error occurred in the mDNS device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });
    this.storageDiscoverer?.on('error', (error: Error) => {
      this.log.error('An error occurred in the storage device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });
    this.configDiscoverer?.on('error', (error: Error) => {
      this.log.error('An error occurred in the config device discovery service:', error.message);
      this.log.debug(error.stack || '');
    });

    // start discovering devices
    this.log.info('Discovering Shellies...');
    setTimeout(async () => {
      await this.mdnsDiscoverer?.start();
      await this.storageDiscoverer?.start();
      await this.configDiscoverer?.start();
      const server = new CoapServer();
      server.start((msg: CoapMessage) => {
        // this.log.info(`CoIoT message received from: ${msg.host}`);
        shellies1g._statusUpdateHandler(msg);
      }, false);
    }, 10000);
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

  public async saveShellyDevices() {
    this.log.info(`Saving ${this.shellyDevices.size} Shelly devices`);
    await this.nodeStorage?.set<ShellyDevice[]>('DeviceIdentifiers', Array.from(this.shellyDevices.values()));
  }

  private async loadShellyDevices(): Promise<boolean> {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return false;
    }
    const shellyDevices = await this.nodeStorage.get<ShellyDevice[]>('DeviceIdentifiers', []);
    for (const device of shellyDevices) {
      this.shellyDevices.set(device.id, device);
    }
    this.log.info(`Loaded ${this.shellyDevices.size} Shelly devices`);
    return true;
  }

  private shellySwitchUpdateHandler(
    matterbridgeDevice: MatterbridgeDevice,
    shellyDevice: Device | Device1g,
    switchId: string,
    characteristic: string,
    value: CharacteristicValue,
  ): boolean {
    this.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ${hk}${switchId}${db} ` +
        `${zb}${characteristic}${db}:${typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    if (!(shellyDevice instanceof Device) && !(characteristic.startsWith('switch') || characteristic.startsWith('relay'))) {
      return false;
    }
    if (shellyDevice instanceof Device && characteristic !== 'output') {
      return false;
    }
    const endpoints = matterbridgeDevice.getChildEndpoints();
    for (const endpoint of endpoints) {
      const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) {
        this.log.error('shellySwitchUpdateHandler error: labelList undefined');
        return false;
      }
      let endpointName = '';
      for (const entry of labelList) {
        if (entry.label === 'endpointName') endpointName = entry.value;
      }
      if (endpointName === switchId) {
        const cluster = endpoint.getClusterServer(OnOffCluster);
        if (!cluster) {
          this.log.error('shellySwitchUpdateHandler error: cluster not found');
          return false;
        }
        cluster.setOnOffAttribute(value as boolean);
        this.log.info(
          `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}OnOff-onOff${db} for device ${dn}${shellyDevice.id}${db}` +
            ` ${hk}${switchId}${db} ${zb}${characteristic}${db}:${rs}`,
          value,
        );
        return true;
      }
    }
    this.log.error(`shellySwitchUpdateHandler error: endpointName ${switchId} not found`);
    return false;
  }

  private shellySwitchCommandHandler(
    matterbridgeDevice: MatterbridgeDevice,
    shellyDevice: Device | Device1g,
    command: string,
    endpointNumber: EndpointNumber | undefined,
    state: boolean,
  ): boolean {
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
    if (!(shellyDevice instanceof Device)) {
      sendCommand(shellyDevice.host, endpointName.startsWith('switch') ? 'light' : 'relay', 0, state ? 'turn=on' : 'turn=off'); // Dimmer switch->light relay->relay
    }
    if (shellyDevice instanceof Device) {
      const switchComponent = shellyDevice?.getComponent(endpointName) as Switch;
      switchComponent?.set(state);
    }
    if (this.shellies && shellyDevice)
      this.log.info(
        `Command ${command} for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${cluster.name}-onOff${nf} ` +
          `for shelly device ${dn}${shellyDevice.id}${nf} component ${endpointName}${nf}`,
      );
    else
      this.log.error(
        `Failed to send ${command} command for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${cluster.name}-onOff${nf} ` +
          `for shelly device ${dn}${shellyDevice?.id}${nf} component ${endpointName}${nf}`,
      );
    return true;
  }

  private shellyCoverUpdateHandler(
    matterbridgeDevice: MatterbridgeDevice,
    shellyDevice: Device | Device1g,
    switchId: string,
    characteristic: string,
    value: CharacteristicValue,
  ): boolean {
    this.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ${hk}${switchId}${db} ` +
        `${zb}${characteristic}${db}:${typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    if (!(shellyDevice instanceof Device) /* && !(characteristic.startsWith('switch') || characteristic.startsWith('relay'))*/) {
      return false;
    }
    if (shellyDevice instanceof Device && characteristic !== 'state') {
      return false;
    }
    const endpoints = matterbridgeDevice.getChildEndpoints();
    for (const endpoint of endpoints) {
      const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) {
        this.log.error('shellySwitchUpdateHandler error: labelList undefined');
        return false;
      }
      let endpointName = '';
      for (const entry of labelList) {
        if (entry.label === 'endpointName') endpointName = entry.value;
      }
      if (endpointName === switchId) {
        const windowCoveringCluster = endpoint.getClusterServer(
          WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
        );
        if (!windowCoveringCluster) {
          this.log.error('shellySwitchUpdateHandler error: cluster not found');
          return false;
        }
        if (value === 'stopped') {
          matterbridgeDevice.setWindowCoveringTargetAsCurrentAndStopped(endpoint);
        }
        if (value === 'closed') {
          matterbridgeDevice.setWindowCoveringTargetAndCurrentPosition(10000, endpoint);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Stopped, endpoint);
        }
        if (value === 'opened') {
          matterbridgeDevice.setWindowCoveringTargetAndCurrentPosition(0, endpoint);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Stopped, endpoint);
        }
        if (value === 'opening') {
          windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(0);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening, endpoint);
        }
        if (value === 'closing') {
          windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(10000);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Closing, endpoint);
        }
        this.log.info(
          `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}WindowCovering${db} for device ${dn}${shellyDevice.id}${db}` +
            ` ${hk}${switchId}${db} ${zb}${characteristic}${db}:${rs}`,
          value,
        );
        return true;
      }
    }
    this.log.error(`shellySwitchUpdateHandler error: endpointName ${switchId} not found`);
    return false;
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

export class MdnsDeviceDiscoverer extends DeviceDiscoverer {
  private mdnsScanner: MdnsScanner;
  private log: AnsiLogger;
  private timeout: number;
  private platform: ShellyPlatform;

  constructor(platform: ShellyPlatform, log: AnsiLogger, timeout = 600) {
    super();
    this.platform = platform;
    this.log = log;
    this.timeout = timeout;
    this.mdnsScanner = new MdnsScanner();
  }

  async start() {
    this.mdnsScanner.start(
      async (id: string, host: string, gen: number) => {
        // We get id: shellydimmer2-98CDAC0D01BB host: 192.168.1.219 gen:1
        // We get id: shellyplus1pm-441793d69718 host: 192.168.1.217 gen:2
        const shellyData = (await getShelly(host)) as { type: string; model: string; mac: string };
        // if (shellyData) console.log(shellyData);
        if (gen === 1) {
          if (shellyData) {
            this.log.info(`mdnsScanner discovered shelly gen 1 ${id} model ${shellyData.type} mac ${shellyData.mac} host ${host}`);
            this.platform.shellyDevices.set(id, { id, hostname: host });
            await this.platform.saveShellyDevices();
            // We need type SHDM-2 mac 98CDAC0D01BB host 192.168.1.219
            const device = shellies1g.createDevice(shellyData.type, shellyData.mac, host);
            if (!shellies1g.hasDevice(device)) shellies1g.addDevice(device);
          }
        }
        if (gen === 2 || gen === 3) {
          if (shellyData) {
            this.log.info(`mdnsScanner discovered shelly gen ${gen} ${id} model ${shellyData.model} mac ${shellyData.mac} host ${host}`);
            this.platform.shellyDevices.set(id, { id, hostname: host });
            await this.platform.saveShellyDevices();
            // We need deviceId shellyplus1pm-441793d69718 hostname 192.168.1.217
            this.handleDiscoveredDevice({ deviceId: id, hostname: host });
          }
        }
      },
      this.timeout, // In seconds
      false,
    );
  }

  async stop() {
    this.mdnsScanner.stop();
  }
}

export class StorageDeviceDiscoverer extends DeviceDiscoverer {
  private nodeStorage: NodeStorage;
  private log: AnsiLogger;

  constructor(log: AnsiLogger, nodeStorage: NodeStorage) {
    super();
    this.log = log;
    this.nodeStorage = nodeStorage;
  }

  async start() {
    const shellyDevices = await this.nodeStorage.get<ShellyDevice[]>('DeviceIdentifiers', []);
    shellyDevices.forEach(async (device) => {
      this.log.info(`${nf}StorageDeviceDiscoverer deviceId: ${hk}${device.id}${nf} hostname: ${zb}${device.hostname}${nf}`);
      const shellyData = (await getShelly(device.hostname)) as { type: string; model: string; mac: string; gen: number };
      // if (shellyData) console.log(shellyData);
      if (!shellyData) {
        this.log.error(`Failed to retrieve shelly data for device ${device.id}`);
        return;
      }
      if (shellyData.gen === undefined) {
        // We need type SHDM-2 mac 98CDAC0D01BB host 192.168.1.219
        const device1g = shellies1g.createDevice(shellyData.type, shellyData.mac, device.hostname);
        if (!shellies1g.hasDevice(device1g)) shellies1g.addDevice(device1g);
      }
      if (shellyData.gen === 2 || shellyData.gen === 3) {
        // We need deviceId shellyplus1pm-441793d69718 hostname 192.168.1.217
        this.handleDiscoveredDevice({ deviceId: device.id, hostname: device.hostname });
      }
    });
  }
}

export class ConfigDeviceDiscoverer extends DeviceDiscoverer {
  private config: PlatformConfig;
  private log: AnsiLogger;

  constructor(log: AnsiLogger, config: PlatformConfig) {
    super();
    this.log = log;
    this.config = config;
  }

  async start() {
    if (!this.config.deviceIp) return;
    Object.entries(this.config.deviceIp as Record<string, PlatformConfigValue>).forEach(async ([key, value]) => {
      this.log.info(`${nf}ConfigDeviceDiscoverer deviceId: ${hk}${key}${nf} hostname: ${zb}${value}${nf}`);
      const shellyData = (await getShelly(value as string)) as { type: string; model: string; mac: string; gen: number };
      // if (shellyData) console.log(shellyData);
      if (!shellyData) {
        this.log.error(`Failed to retrieve shelly data for device ${key}`);
        return;
      }
      if (shellyData.gen === undefined) {
        // We need type SHDM-2 mac 98CDAC0D01BB host 192.168.1.219
        const device1g = shellies1g.createDevice(shellyData.type, shellyData.mac, value as string);
        if (!shellies1g.hasDevice(device1g)) shellies1g.addDevice(device1g);
      }
      if (shellyData.gen === 2 || shellyData.gen === 3) {
        // We need deviceId shellyplus1pm-441793d69718 hostname 192.168.1.217
        this.handleDiscoveredDevice({ deviceId: key, hostname: value as string });
      }
    });
  }
}

async function sendCommand(hostname: string, service: string, index: number, command: string): Promise<unknown | null> {
  try {
    // Replace the URL with your target URL
    const response = await fetch(`http://${hostname}/${service}/${index}?${command}`);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('Error fetching shelly:');
      return null;
    }
    const data = await response.json();

    // console.log(data);
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching shelly:', error);
    return null;
  }
}

async function getShelly(hostname: string): Promise<unknown | null> {
  try {
    // Replace the URL with your target URL
    const response = await fetch(`http://${hostname}/shelly`);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('Error fetching shelly:');
      return null;
    }
    const data = await response.json();

    // console.log(data);
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching shelly:', error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getSettings(hostname: string): Promise<unknown | null> {
  try {
    // Replace the URL with your target URL
    const response = await fetch(`http://${hostname}/settings`);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('Error fetching settings:');
      return null;
    }
    const data = await response.json();

    // console.log(data);
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching settings:', error);
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getStatus(hostname: string): Promise<unknown | null> {
  try {
    // Replace the URL with your target URL
    const response = await fetch(`http://${hostname}/status`);
    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.error('Error fetching status:');
      return null;
    }
    const data = await response.json();

    // console.log(data);
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching status:', error);
    return null;
  }
}
