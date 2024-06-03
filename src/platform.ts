/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Matterbridge,
  MatterbridgeDevice,
  MatterbridgeDynamicPlatform,
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
  EveHistory,
  EveHistoryCluster,
  powerSource,
  bridgedNode,
  LevelControl,
  ColorControl,
  ClusterId,
  LevelControlCluster,
  getClusterNameById,
  ClusterRegistry,
} from 'matterbridge';
import { AnsiLogger, BLUE, TimestampFormat, db, debugStringify, dn, er, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';
import path from 'path';
import fetch from 'node-fetch';

import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyCoverComponent, ShellyData, ShellyDevice, ShellySwitchComponent } from './shellyDevice.js';

// import { CoapMessage, CoapServer } from './coapServer.js';

// Shellyies gen 1
// import shellies1g, { Device as Device1g } from 'shellies';

// Shellyies gen 2
// import { Device, DeviceId, DeviceIdentifiers, DeviceDiscoverer, Shellies, Switch, Cover, CharacteristicValue } from 'shellies-ng';

// import { MdnsScanner } from './mdnsScanner.js';

type ConfigDeviceIp = Record<string, string>;

// Shelly device id (e.g. shellyplus1pm-441793d69718)
type ShellyDeviceId = string;

/*
interface ShellyDevice {
  id: ShellyDeviceId; // ID: shellyplus1pm-441793d69718
  hostname: string; // IP address: 192.168.1.xxx
}
*/

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  public discoveredDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public storedDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public shellyDevices = new Map<ShellyDeviceId, ShellyDevice>();
  public bridgedDevices = new Map<ShellyDeviceId, MatterbridgeDevice>();

  // NodeStorageManager
  private nodeStorageManager?: NodeStorageManager;
  private nodeStorage?: NodeStorage;

  // Shelly
  private shelly: Shelly;
  /*
  // Shelly 1
  private shellies1g = shellies1g;
  // Shelly 2+
  private shellies?: Shellies;
  private mdnsDiscoverer?: MdnsDeviceDiscoverer;
  private storageDiscoverer?: StorageDeviceDiscoverer;
  private configDiscoverer?: ConfigDeviceDiscoverer;
  */

  // Config
  private username = '';
  private password = '';
  private whiteList: string[] = [];
  private blackList: string[] = [];
  private deviceIp: ConfigDeviceIp = {};
  // localConfig: PlatformConfig = {};

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    if (config.whiteList) this.whiteList = config.whiteList as string[];
    if (config.blackList) this.blackList = config.blackList as string[];
    if (config.deviceIp) this.deviceIp = config.deviceIp as ConfigDeviceIp;
    // this.localConfig = config;

    this.shelly = new Shelly(log);

    // handle Shelly add event
    this.shelly.on('add', async (device: ShellyDevice) => {
      this.log.info(`Shelly added gen ${BLUE}${device.gen}${nf} device ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf}`);
      this.log.info(`- mac: ${device.mac}`);
      this.log.info(`- model: ${device.model}`);
      this.log.info(`- firmware: ${device.firmware}`);
      if (device.profile) this.log.info(`- profile: ${device.profile}`);
      this.log.info('- components:');
      for (const [key, component] of device) {
        this.log.info(`  - ${component.name} (${key})`);
      }

      // console.log('Device:', device);

      // Create a new Matterbridge device for the switch
      const mbDevice = new MatterbridgeDevice(bridgedNode);
      mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        device.name,
        device.id,
        0xfff1,
        'Shelly',
        device.model,
        1, // Number(device.firmware.split('.')[0]),
        device.firmware,
      );
      // DEPRECATED mbDevice.createDefaultPowerSourceConfigurationClusterServer();
      const child = mbDevice.addChildDeviceTypeWithClusterServer('PowerSource', [powerSource], [PowerSource.Cluster.id]);
      child.addClusterServer(mbDevice.getDefaultPowerSourceWiredClusterServer());
      /*
      mbDevice.addDeviceType(powerSource);
      mbDevice.createDefaultPowerSourceWiredClusterServer(PowerSource.WiredCurrentType.Ac);
      */

      // Scan the device components
      for (const [key, component] of device) {
        if (component.name === 'Light') {
          const lightComponent = device.getComponent(key);
          if (lightComponent) {
            let deviceType = DeviceTypes.ON_OFF_LIGHT;
            if (lightComponent.hasProperty('brightness')) deviceType = DeviceTypes.DIMMABLE_LIGHT;
            if (lightComponent.hasProperty('color')) deviceType = DeviceTypes.COLOR_TEMPERATURE_LIGHT;
            const clusterId: ClusterId[] = [OnOff.Cluster.id];
            if (lightComponent.hasProperty('brightness')) clusterId.push(LevelControl.Cluster.id);
            if (lightComponent.hasProperty('color')) clusterId.push(ColorControl.Cluster.id);
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], clusterId);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the OnOff attribute
            const state = lightComponent.getValue('state');
            if (state !== undefined) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state as boolean);
            // Add command handlers
            mbDevice.addCommandHandler('on', async (data) => {
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Off', false);
            });
            mbDevice.addCommandHandler('moveToLevel', async ({ request, attributes, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              if (state !== undefined) this.shellySwitchCommandHandler(mbDevice, endpoint.number, device, component.id, 'On', state, request.level);
            });
            mbDevice.addCommandHandler('moveToLevelWithOnOff', async ({ request, attributes, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              if (state !== undefined) this.shellySwitchCommandHandler(mbDevice, endpoint.number, device, component.id, 'On', state, request.level);
            });
            /*
            // Add event handler
            switchComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              // console.log(characteristic, value);
              this.shellySwitchUpdateHandler(mbDevice, device, key, characteristic, value);
            });
            */
          }
        } else if (component.name === 'Switch' || component.name === 'Relay') {
          const switchComponent = device.getComponent(key) as ShellySwitchComponent;
          if (switchComponent) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [onOffSwitch], [OnOff.Cluster.id]);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the OnOff attribute
            const state = switchComponent.getValue('state');
            if (state !== undefined) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state as boolean);
            // Add command handlers
            mbDevice.addCommandHandler('on', async (data) => {
              // switchComponent.On();
              // switchComponent.logComponent();
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, switchComponent.id, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              // switchComponent.Off();
              // switchComponent.logComponent();
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, switchComponent.id, 'Off', false);
            });
            /*
            // Add event handler
            switchComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              // console.log(characteristic, value);
              this.shellySwitchUpdateHandler(mbDevice, device, key, characteristic, value);
            });
            */
          }
        } else if (component.name === 'Cover' || component.name === 'Roller') {
          const coverComponent = device.getComponent(key);
          if (coverComponent) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.WINDOW_COVERING], [WindowCovering.Cluster.id]);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the WindowCovering attributes
            mbDevice.setWindowCoveringTargetAsCurrentAndStopped(child);
            // Add command handlers
            mbDevice.addCommandHandler('upOrOpen', async (data) => {
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Open', 0);
            });
            mbDevice.addCommandHandler('downOrClose', async (data) => {
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Close', 10000);
            });
            mbDevice.addCommandHandler('stopMotion', async (data) => {
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Stop');
            });
            mbDevice.addCommandHandler('goToLiftPercentage', async (data) => {
              if (data.request.liftPercent100thsValue === 0) this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Open', 0);
              else if (data.request.liftPercent100thsValue === 10000) this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'Close', 10000);
              else this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, component.id, 'GoToPosition', data.request.liftPercent100thsValue);
            });
            /*
            // Add event handler
            coverComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              this.shellyCoverUpdateHandler(mbDevice, device, key, characteristic, value);
            });
            */
          }
        } else if (component.name === 'PowerMeter') {
          const pmComponent = device.getComponent(key);
          if (pmComponent) {
            ClusterRegistry.register(EveHistory.Complete);
            this.log.info('Added custom cluster:', getClusterNameById(EveHistoryCluster.id));
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.ON_OFF_PLUGIN_UNIT], [OnOff.Complete.id, EveHistory.Cluster.id]);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the electrical attributes
            const voltage = pmComponent.getValue('voltage');
            if (voltage !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setVoltageAttribute(voltage as number);
            const current = pmComponent.getValue('current');
            if (current !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setCurrentAttribute(current as number);
            const power = pmComponent.getValue('apower');
            if (power !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setConsumptionAttribute(power as number);
            const energy = pmComponent.getValue('aenergy');
            if (energy !== undefined && energy !== null)
              child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setTotalConsumptionAttribute((energy as ShellyData).total as number);
            // Add mode selection
            mbDevice.createDefaultModeSelectClusterServer(child);
            /*
            // Add event handler
            coverComponent.on('change', (characteristic: string, value: CharacteristicValue) => {
              this.shellyCoverUpdateHandler(mbDevice, device, key, characteristic, value);
            });
            */
          }
        }
      }
      // Check if we have a device to register with Matterbridge
      const endpoints = mbDevice.getChildEndpoints();
      if (endpoints.length > 0) {
        // Register the device with Matterbridge
        await this.registerDevice(mbDevice);
        // Save the MatterbridgeDevice in the bridgedDevices map
        this.bridgedDevices.set(device.id, mbDevice);
      } else {
        this.log.warn(`Device gen ${BLUE}${device.gen}${wr} device ${hk}${device.id}${rs}${wr} host ${zb}${device.host}${wr} has no components to add.`);
      }
    });

    this.log.info('Finished initializing platform:', this.config.name);
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');

    // create NodeStorageManager
    this.nodeStorageManager = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, 'matterbridge-shelly'),
      logging: false,
    });
    this.nodeStorage = await this.nodeStorageManager.createStorage('devices');
    await this.loadStoredDevices();

    // handle Shelly discovered event
    this.shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
      if (this.discoveredDevices.has(discoveredDevice.id)) {
        this.log.info(`**Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} already discovered`);
        return;
      }
      this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
      this.storedDevices.set(discoveredDevice.id, discoveredDevice);
      await this.saveStoredDevices();
      if (this.validateWhiteBlackList(discoveredDevice.id)) {
        await this.addDevice(discoveredDevice.id, discoveredDevice.host);
      }
    });

    // start Shelly mDNS device discoverer
    if (this.config.enableMdnsDiscover === true) {
      this.shelly.startMdns();
    }

    // add all stored devices
    if (this.config.enableStorageDiscover === true) {
      this.storedDevices.forEach(async (storedDevice) => {
        this.shelly.emit('discovered', storedDevice);
      });
    }

    // add all configured devices
    if (this.config.enableConfigDiscover === true) {
      Object.entries(this.config.deviceIp as Record<string, string>).forEach(async ([id, host]) => {
        const configDevice: DiscoveredDevice = { id, host, port: 0, gen: 0 };
        this.shelly.emit('discovered', configDevice);
      });
    }
  }

  override async onConfigure() {
    this.log.info('onConfigure called');
  }
  // 2024-05-31 14:04:04.815 DEBUG  InteractionServer    Subscribe to attributes:*/*/*, events:!*/*/*
  override async onShutdown(reason?: string) {
    this.log.info('onShutdown called with reason:', reason ?? 'none');

    this.shelly.destroy();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  public async saveStoredDevices() {
    this.log.debug(`Saving ${this.storedDevices.size} discovered Shelly devices to the storage`);
    await this.nodeStorage?.set<DiscoveredDevice[]>('DeviceIdentifiers', Array.from(this.storedDevices.values()));
  }

  private async loadStoredDevices(): Promise<boolean> {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return false;
    }
    const storedDevices = await this.nodeStorage.get<DiscoveredDevice[]>('DeviceIdentifiers', []);
    for (const device of storedDevices) {
      this.storedDevices.set(device.id, device);
    }
    this.log.debug(`Loaded ${this.storedDevices.size} discovered Shelly devices from the storage`);
    return true;
  }

  private async addDevice(deviceId: string, host: string) {
    if (this.shelly.hasDevice(deviceId) || this.shelly.hasDeviceHost(host)) {
      this.log.info(`Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf} already added`);
      return;
    }
    this.log.info(`**Adding shelly device ${deviceId} host ${host}`);
    const log = new AnsiLogger({ logName: deviceId, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
    const device = await ShellyDevice.create(this.shelly, log, host);
    if (!device) {
      this.log.error(`Failed to create Shelly device ${deviceId} host ${host}`);
      return;
    }
    log.setLogName(device.name ?? device.id);
    await this.shelly.addDevice(device);
    this.shellyDevices.set(device.id, device);
  }

  getEndpointLabel(matterbridgeDevice: MatterbridgeDevice, endpointNumber: EndpointNumber): string | undefined {
    const labelList = matterbridgeDevice.getChildEndpoint(endpointNumber)?.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
    if (!labelList) return undefined;
    for (const entry of labelList) {
      if (entry.label === 'endpointName') return entry.value;
    }
    return undefined;
  }

  private shellySwitchCommandHandler(
    matterbridgeDevice: MatterbridgeDevice,
    endpointNumber: EndpointNumber | undefined,
    shellyDevice: ShellyDevice,
    componentName: string | undefined,
    command: string,
    state: boolean,
    level?: number,
  ): boolean {
    // Get the matter endpoint
    if (!endpointNumber) {
      this.log.error(`shellyCommandHandler error: endpointNumber undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const endpoint = matterbridgeDevice.getChildEndpoint(endpointNumber);
    if (!endpoint) {
      this.log.error(`shellyCommandHandler error: endpoint undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Get the Shelly switch component
    componentName = this.getEndpointLabel(matterbridgeDevice, endpointNumber);
    if (!componentName) {
      this.log.error(`shellyCommandHandler error: endpointName undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const switchComponent = shellyDevice?.getComponent(componentName) as ShellySwitchComponent;
    if (!switchComponent) {
      this.log.error(`shellyCommandHandler error: switchComponent ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Set OnOffCluster onOff attribute
    const onOffCluster = endpoint.getClusterServer(OnOffCluster);
    if (!onOffCluster) {
      this.log.error('shellyCommandHandler error: cluster OnOffCluster not found');
      return false;
    }
    onOffCluster.setOnOffAttribute(state); // TODO remove
    if (state) switchComponent.On();
    else switchComponent.Off();
    shellyDevice.log.info(`Command ${componentName}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${onOffCluster.name}-onOff${nf}: ${state} `);
    // Set LevelControlCluster currentLevel attribute
    if (level !== undefined) {
      const levelControlCluster = endpoint.getClusterServer(LevelControlCluster);
      if (!levelControlCluster) {
        this.log.error('shellyCommandHandler error: cluster LevelControlCluster not found');
        return false;
      }
      levelControlCluster.setCurrentLevelAttribute(level); // TODO remove
      const shellyLevel = Math.max(Math.min((level / 254) * 100, 100), 1);
      switchComponent?.Level(shellyLevel);
      shellyDevice.log.info(`Command ${componentName}:Level(${shellyLevel}) for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${onOffCluster.name}-onOff${nf}: ${state} `);
    }
    return true;
  }

  private shellyCoverCommandHandler(
    matterbridgeDevice: MatterbridgeDevice,
    endpointNumber: EndpointNumber | undefined,
    shellyDevice: ShellyDevice,
    componentName: string | undefined,
    command: string,
    pos?: number,
  ): boolean {
    // Get the matter endpoint
    if (!endpointNumber) {
      this.log.error(`shellyCommandHandler error: endpointNumber undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const endpoint = matterbridgeDevice.getChildEndpoint(endpointNumber);
    if (!endpoint) {
      this.log.error(`shellyCommandHandler error: endpoint undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Get the Shelly switch component
    componentName = this.getEndpointLabel(matterbridgeDevice, endpointNumber);
    if (!componentName) {
      this.log.error(`shellyCommandHandler error: endpointName undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const coverComponent = shellyDevice?.getComponent(componentName) as ShellyCoverComponent;
    if (!coverComponent) {
      this.log.error(`shellyCommandHandler error: coverComponent ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Set WindowCoveringCluster attributes
    const coverCluster = endpoint.getClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
    );
    if (!coverCluster) {
      this.log.error('shellyCommandHandler error: cluster WindowCoveringCluster not found');
      return false;
    }
    if (command === 'Stop') {
      matterbridgeDevice.setWindowCoveringTargetAsCurrentAndStopped(endpoint);
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      coverComponent.Stop();
      shellyDevice.log.info(
        `Command ${componentName}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'Open') {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped, endpoint);
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      coverComponent.Open();
      shellyDevice.log.info(
        `Command ${componentName}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'Close') {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped, endpoint);
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      coverComponent.Close();
      shellyDevice.log.info(
        `Command ${componentName}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'GoToPosition' && pos !== undefined) {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(pos, pos, WindowCovering.MovementStatus.Stopped, endpoint);
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      coverComponent.GoToPosition(pos / 100);
      shellyDevice.log.info(
        `Command ${componentName}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    }
    return true;
  }
  /*
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
    if (!(shellyDevice instanceof Device) ) {
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
        if (value === 'open') {
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
  */

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
