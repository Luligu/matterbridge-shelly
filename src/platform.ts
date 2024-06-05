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
  Endpoint,
} from 'matterbridge';
import { AnsiLogger, BLUE, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';
import path from 'path';

import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';

type ConfigDeviceIp = Record<string, string>;

// Shelly device id (e.g. shellyplus1pm-441793d69718)
type ShellyDeviceId = string;

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

  // Config
  private username = '';
  private password = '';
  private whiteList: string[] = [];
  private blackList: string[] = [];

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    if (config.whiteList) this.whiteList = config.whiteList as string[];
    if (config.blackList) this.blackList = config.blackList as string[];

    this.shelly = new Shelly(log, this.username, this.password);

    // handle Shelly discovered event
    this.shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
      if (this.discoveredDevices.has(discoveredDevice.id)) {
        this.log.info(`Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} already discovered`);
        return;
      }
      this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
      this.storedDevices.set(discoveredDevice.id, discoveredDevice);
      await this.saveStoredDevices();
      if (this.validateWhiteBlackList(discoveredDevice.id)) {
        await this.addDevice(discoveredDevice.id, discoveredDevice.host);
      }
    });

    // handle Shelly add event
    this.shelly.on('add', async (device: ShellyDevice) => {
      device.log.info(`Shelly added gen ${BLUE}${device.gen}${nf} device ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf}`);
      device.log.info(`- mac: ${device.mac}`);
      device.log.info(`- model: ${device.model}`);
      device.log.info(`- firmware: ${device.firmware}`);
      if (device.profile) device.log.info(`- profile: ${device.profile}`);
      device.log.info('- components:');
      for (const [key, component] of device) {
        device.log.info(`  - ${component.name} (${key})`);
      }
      if (config.debug) device.logDevice();

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

      // Scan the device components
      for (const [key, component] of device) {
        if (component.name === 'Light') {
          const lightComponent = device.getComponent(key);
          if (lightComponent) {
            let deviceType = DeviceTypes.ON_OFF_LIGHT;
            if (lightComponent.hasProperty('brightness')) deviceType = DeviceTypes.DIMMABLE_LIGHT;
            if (lightComponent.hasProperty('color')) deviceType = DeviceTypes.COLOR_TEMPERATURE_LIGHT;
            const clusterIds: ClusterId[] = [OnOff.Cluster.id];
            if (lightComponent.hasProperty('brightness')) clusterIds.push(LevelControl.Cluster.id);
            if (lightComponent.hasProperty('color')) clusterIds.push(ColorControl.Cluster.id);
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], clusterIds);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the OnOff attribute
            const state = lightComponent.getValue('state');
            if (state !== undefined) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state as boolean);
            // Add command handlers
            mbDevice.addCommandHandler('on', async (data) => {
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, 'Off', false);
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mbDevice.addCommandHandler('moveToLevel', async ({ request, attributes, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              if (state !== undefined) this.shellySwitchCommandHandler(mbDevice, endpoint.number, device, 'On', state, request.level);
            });
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            mbDevice.addCommandHandler('moveToLevelWithOnOff', async ({ request, attributes, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              if (state !== undefined) this.shellySwitchCommandHandler(mbDevice, endpoint.number, device, 'On', state, request.level);
            });
            // Add event handler
            lightComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
              this.shellySwitchUpdateHandler(mbDevice, device, component, property, value);
            });
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
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellySwitchCommandHandler(mbDevice, data.endpoint.number, device, 'Off', false);
            });
            // Add event handler
            switchComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
              this.shellySwitchUpdateHandler(mbDevice, device, component, property, value);
            });
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
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'Open', 0);
            });
            mbDevice.addCommandHandler('downOrClose', async (data) => {
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'Close', 10000);
            });
            mbDevice.addCommandHandler('stopMotion', async (data) => {
              this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'Stop');
            });
            mbDevice.addCommandHandler('goToLiftPercentage', async (data) => {
              if (data.request.liftPercent100thsValue === 0) this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'Open', 0);
              else if (data.request.liftPercent100thsValue === 10000) this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'Close', 10000);
              else this.shellyCoverCommandHandler(mbDevice, data.endpoint.number, device, 'GoToPosition', data.request.liftPercent100thsValue);
            });
            // Add event handler
            coverComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
              this.shellyCoverUpdateHandler(mbDevice, device, component, property, value);
            });
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
            // Add event handler
            pmComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
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

    // start Shelly mDNS device discoverer
    if (this.config.enableMdnsDiscover === true) {
      this.shelly.startMdns(60 * 10);
    }

    // add all stored devices
    if (this.config.enableStorageDiscover === true) {
      this.storedDevices.forEach(async (storedDevice) => {
        this.shelly.emit('discovered', storedDevice);
      });
    }

    // add all configured devices
    if (this.config.enableConfigDiscover === true) {
      Object.entries(this.config.deviceIp as ConfigDeviceIp).forEach(async ([id, host]) => {
        const configDevice: DiscoveredDevice = { id, host, port: 0, gen: 0 };
        this.shelly.emit('discovered', configDevice);
      });
    }
  }

  override async onConfigure() {
    this.log.info('onConfigure called');
  }

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
    const log = new AnsiLogger({ logName: deviceId, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.config.debug === true });
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

  getChildEndpointWithLabel(matterbridgeDevice: MatterbridgeDevice, label: string): Endpoint | undefined {
    const endpoints = matterbridgeDevice.getChildEndpoints();
    for (const endpoint of endpoints) {
      const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) return undefined;
      let endpointName = '';
      for (const entry of labelList) {
        if (entry.label === 'endpointName') endpointName = entry.value;
      }
      if (endpointName === label) return endpoint;
    }
    return undefined;
  }

  private shellySwitchCommandHandler(
    matterbridgeDevice: MatterbridgeDevice,
    endpointNumber: EndpointNumber | undefined,
    shellyDevice: ShellyDevice,
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
    const componentName = this.getEndpointLabel(matterbridgeDevice, endpointNumber);
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
    const componentName = this.getEndpointLabel(matterbridgeDevice, endpointNumber);
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

  private shellyUpdateHandler(matterbridgeDevice: MatterbridgeDevice, shellyDevice: ShellyDevice, component: string, property: string, value: ShellyDataType) {
    const endpoint = this.getChildEndpointWithLabel(matterbridgeDevice, component);
    if (!endpoint) return;
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ` +
        `${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
  }

  private shellySwitchUpdateHandler(matterbridgeDevice: MatterbridgeDevice, shellyDevice: ShellyDevice, component: string, property: string, value: ShellyDataType): boolean {
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ${hk}${component}${db}:` +
        `${zb}${property}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    if (property !== 'state') return false;
    const endpoint = this.getChildEndpointWithLabel(matterbridgeDevice, component);
    if (endpoint) {
      const cluster = endpoint.getClusterServer(OnOffCluster);
      if (!cluster) {
        this.log.error('shellySwitchUpdateHandler error: OnOffCluster not found');
        return false;
      }
      cluster.setOnOffAttribute(value as boolean);
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}OnOff-onOff${db} for device ${dn}${shellyDevice.id}` +
          `:${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
      );
      return true;
    }
    this.log.error(`shellySwitchUpdateHandler error: endpointName ${component} not found`);
    return false;
  }

  private shellyCoverUpdateHandler(matterbridgeDevice: MatterbridgeDevice, shellyDevice: ShellyDevice, component: string, property: string, value: ShellyDataType): boolean {
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ${hk}${component}${db}:` +
        `${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    if (property !== 'state') return false;
    const endpoint = this.getChildEndpointWithLabel(matterbridgeDevice, component);
    if (endpoint) {
      const windowCoveringCluster = endpoint.getClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
      );
      if (!windowCoveringCluster) {
        this.log.error('shellyCoverUpdateHandler error: WindowCoveringCluster not found');
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
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}WindowCovering${db} for device ${dn}${shellyDevice.id}${db}` +
          ` ${hk}${component}${db}:${zb}${property}${db}::${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
      );
      return true;
    }
    this.log.error(`shellyCoverUpdateHandler error: endpointName ${component} not found`);
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
