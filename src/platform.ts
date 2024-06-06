import {
  Matterbridge,
  MatterbridgeDevice,
  MatterbridgeDynamicPlatform,
  DeviceTypes,
  EndpointNumber,
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
  BooleanStateCluster,
} from 'matterbridge';
import { AnsiLogger, BLUE, CYAN, GREEN, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
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

    log.info(
      `Initializing platform: ${this.config.name} ` +
        `with username: ${config.username} password: ${config.password} ` +
        `mdnsDiscover: ${config.enableMdnsDiscover} storageDiscover: ${config.enableStorageDiscover} configDiscover: ${config.enableConfigDiscover} ` +
        `resetStorageDiscover: ${config.resetStorageDiscover} debug: ${config.debug} unregisterOnShutdown: ${config.unregisterOnShutdown}`,
    );

    this.shelly = new Shelly(log, this.username, this.password, config.debug as boolean);

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
      device.log.info(`Shelly added gen ${CYAN}${device.gen}${nf} device ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf} name ${idn}${device.name}${rs}${nf}`);
      device.log.info(`- mac: ${CYAN}${device.mac}${nf}`);
      device.log.info(`- model: ${CYAN}${device.model}${nf}`);
      device.log.info(`- firmware: ${CYAN}${device.firmware}${nf}`);
      if (device.profile) device.log.info(`- profile: ${CYAN}${device.profile}${nf}`);
      device.log.info('- components:');
      for (const [key, component] of device) {
        device.log.info(`  - ${CYAN}${key}${nf} (${GREEN}${component.name}${nf})`);
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
              // this.shellyCoverUpdateHandler(mbDevice, device, component, property, value);
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
        } else if (component.name === 'Input') {
          const inputComponent = device.getComponent(key);
          if (inputComponent) {
            /*
            device.log.setLogDebug(true);
            inputComponent.logComponent();
            device.log.setLogDebug(false);
            */
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the state attribute
            const state = inputComponent.getValue('state');
            if (state !== undefined && typeof state === 'boolean') child.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(state as boolean);
            // Add event handler
            inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        }
      }
      // Check if we have a device to register with Matterbridge
      const endpoints = mbDevice.getChildEndpoints();
      if (endpoints.length > 1) {
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
    if (this.config.resetStorageDiscover === true) {
      this.config.resetStorageDiscover = false;
      await this.nodeStorage.clear();
      this.log.info('Resetting the Shellies storage');
    } else {
      await this.loadStoredDevices();
    }

    // start Shelly mDNS device discoverer
    if (this.config.enableMdnsDiscover === true) {
      this.shelly.startMdns(60 * 10);
    }

    // add all stored devices
    if (this.config.enableStorageDiscover === true) {
      this.storedDevices.forEach(async (storedDevice) => {
        if (storedDevice.id === undefined || storedDevice.host === undefined || !this.isValidIpv4Address(storedDevice.host)) {
          this.log.error(
            `Stored Shelly device id ${hk}${storedDevice.id}${er} host ${zb}${storedDevice.host}${er} is not valid. Please enable resetStorageDiscover in plugin config and restart.`,
          );
          return;
        }
        this.log.debug(`Loading from storage Shelly device ${hk}${storedDevice.id}${db} host ${zb}${storedDevice.host}${db}`);
        this.shelly.emit('discovered', storedDevice);
      });
    }

    // add all configured devices
    if (this.config.enableConfigDiscover === true) {
      Object.entries(this.config.deviceIp as ConfigDeviceIp).forEach(async ([id, host]) => {
        const configDevice: DiscoveredDevice = { id, host, port: 0, gen: 0 };
        if (configDevice.id === undefined || configDevice.host === undefined || !this.isValidIpv4Address(configDevice.host)) {
          this.log.error(`Config Shelly device id ${hk}${configDevice.id}${er} host ${zb}${configDevice.host}${er} is not valid. Please check the plugin config and restart.`);
          return;
        }
        this.log.debug(`Loading from config Shelly device ${hk}${configDevice.id}${db} host ${zb}${configDevice.host}${db}`);
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
    this.log.info(`Adding shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
    const log = new AnsiLogger({ logName: deviceId, logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: this.config.debug === true });
    const device = await ShellyDevice.create(this.shelly, log, host);
    if (!device) {
      this.log.error(`Failed to create Shelly device ${hk}${deviceId}${er} host ${zb}${host}${er}`);
      return;
    }
    log.setLogName(device.name ?? device.id);
    await this.shelly.addDevice(device);
    this.shellyDevices.set(device.id, device);
  }

  isValidIpv4Address(ipv4Address: string): boolean {
    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ipv4Address);
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
    const componentName = matterbridgeDevice.getEndpointLabel(endpointNumber);
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
    shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${onOffCluster.name}-onOff${nf}: ${state} `);
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
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:Level(${shellyLevel}) for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${onOffCluster.name}-onOff${nf}: ${state} `,
      );
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
    const componentName = matterbridgeDevice.getEndpointLabel(endpointNumber);
    if (!componentName) {
      this.log.error(`shellyCommandHandler error: endpointName undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const coverComponent = shellyDevice?.getComponent(componentName) as ShellyCoverComponent;
    if (!coverComponent) {
      this.log.error(`shellyCommandHandler error: coverComponent ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Matter uses 10000 = fully closed - 0 = fully opened
    // Shelly uses 0 = fully closed - 100 = fully opened
    const coverCluster = endpoint.getClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
    );
    if (!coverCluster) {
      this.log.error('shellyCommandHandler error: cluster WindowCoveringCluster not found');
      return false;
    }
    if (command === 'Stop') {
      matterbridgeDevice.setWindowCoveringTargetAsCurrentAndStopped(endpoint);
      coverComponent.Stop();
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'Open') {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped, endpoint);
      coverComponent.Open();
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'Close') {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped, endpoint);
      coverComponent.Close();
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:${command}() for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    } else if (command === 'GoToPosition' && pos !== undefined) {
      matterbridgeDevice.setWindowCoveringCurrentTargetStatus(pos, pos, WindowCovering.MovementStatus.Stopped, endpoint);
      const shellyPos = 100 - Math.max(Math.min(Math.round(pos / 100), 10000), 0);
      coverComponent.GoToPosition(shellyPos);
      const current = coverCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = coverCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = coverCluster.getOperationalStatusAttribute();
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:${command}(${shellyPos}) for endpoint ${or}${endpointNumber}${nf} attribute ${hk}${coverCluster.name}${nf} current:${current} target:${target} status:${status.global}`,
      );
    }
    return true;
  }

  private shellyUpdateHandler(matterbridgeDevice: MatterbridgeDevice, shellyDevice: ShellyDevice, component: string, property: string, value: ShellyDataType) {
    const endpoint = matterbridgeDevice.getChildEndpointWithLabel(component);
    if (!endpoint) return;
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ` +
        `${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    const shellyComponent = shellyDevice.getComponent(component);
    if (!shellyComponent) return;
    // Update state
    if ((shellyComponent.name === 'Light' || shellyComponent.name === 'Relay' || shellyComponent.name === 'Switch') && property === 'state') {
      const cluster = endpoint.getClusterServer(OnOffCluster);
      cluster?.setOnOffAttribute(value as boolean);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}OnOff-onOff${db} ${YELLOW}${value}${db}`);
    }
    // Update state for Input
    if (shellyComponent.name === 'Input' && property === 'state') {
      const cluster = endpoint.getClusterServer(BooleanStateCluster);
      cluster?.setStateValueAttribute(value as boolean);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}BooleanState-stateValue${db} ${YELLOW}${value}${db}`);
    }
    // Update brightness
    if (shellyComponent.name === 'Light' && property === 'brightness') {
      const cluster = endpoint.getClusterServer(LevelControlCluster);
      const matterLevel = Math.max(Math.min(((value as number) / 100) * 255, 255), 0);
      cluster?.setCurrentLevelAttribute(matterLevel);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}LevelControl-currentLevel${db} ${YELLOW}${matterLevel}${db}`);
    }
    // Update cover
    if (shellyComponent.name === 'Cover' || shellyComponent.name === 'Roller') {
      const windowCoveringCluster = endpoint.getClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
      );
      // Matter uses 10000 = fully closed - 0 = fully opened
      // Shelly uses 0 = fully closed - 100 = fully opened
      if (property === 'state') {
        // Gen 1 devices send stop
        if (value === 'stopped' || value === 'stop') {
          matterbridgeDevice.setWindowCoveringTargetAsCurrentAndStopped(endpoint);
        }
        // Gen 1 devices send close
        if (value === 'closed' || value === 'close') {
          matterbridgeDevice.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped, endpoint);
        }
        // Gen 1 devices send open
        if (value === 'open') {
          matterbridgeDevice.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped, endpoint);
        }
        if (value === 'opening') {
          windowCoveringCluster?.setTargetPositionLiftPercent100thsAttribute(0);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Opening, endpoint);
        }
        if (value === 'closing') {
          windowCoveringCluster?.setTargetPositionLiftPercent100thsAttribute(10000);
          matterbridgeDevice.setWindowCoveringStatus(WindowCovering.MovementStatus.Closing, endpoint);
        }
      } else if (property === 'current_pos' && value !== -1) {
        const matterPos = 10000 - Math.min(Math.max(Math.round((value as number) * 100), 0), 10000);
        matterbridgeDevice.setWindowCoveringCurrentTargetStatus(matterPos, matterPos, WindowCovering.MovementStatus.Stopped, endpoint);
      }
      const current = windowCoveringCluster?.getCurrentPositionLiftPercent100thsAttribute();
      const target = windowCoveringCluster?.getTargetPositionLiftPercent100thsAttribute();
      const status = windowCoveringCluster?.getOperationalStatusAttribute();
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}WindowCovering${db} current:${YELLOW}${current}${db} target:${YELLOW}${target}${db} status:${YELLOW}${status?.global}${rs}`,
      );
    }
    // Update energy
    if (shellyComponent.name === 'PowerMeter' && property === 'aenergy') {
      const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
      cluster?.setTotalConsumptionAttribute((value as ShellyData).total as number);
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${(value as ShellyData).total as number}${db}`,
      );
    }
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
