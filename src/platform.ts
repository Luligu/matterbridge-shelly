/**
 * This file contains the class ShellyPlatform.
 *
 * @file src\platform.ts
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
  BooleanStateCluster,
  ClusterRegistry,
  Endpoint,
  SwitchCluster,
  Switch,
  ColorControlCluster,
} from 'matterbridge';
import { AnsiLogger, BLUE, CYAN, GREEN, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, or, rs, wr, zb } from 'node-ansi-logger';
import { NodeStorage, NodeStorageManager } from 'node-persist-manager';
import path from 'path';

import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyCoverComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { hslColorToRgbColor, rgbColorToHslColor } from './colorUtils.js';

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

    log.info(`Initializing platform: ${idn}${this.config.name}${rs}${nf} v ${CYAN}${this.version}`);
    log.info(`- username: ${CYAN}${config.username}`);
    log.info(`- password: ${CYAN}${config.password}`);
    log.info(`- mdnsDiscover: ${CYAN}${config.enableMdnsDiscover}`);
    log.info(`- storageDiscover: ${CYAN}${config.enableStorageDiscover}`);
    log.info(`- configDiscover: ${CYAN}${config.enableConfigDiscover}`);
    log.info(`- resetStorageDiscover: ${CYAN}${config.resetStorageDiscover}`);
    log.info(`- debug: ${CYAN}${config.debug}`);
    log.info(`- unregisterOnShutdown: ${CYAN}${config.unregisterOnShutdown}`);

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
      device.log.info(`Shelly added ${idn}${device.name}${rs} gen ${CYAN}${device.gen}${nf} device id ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf}`);
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
      const mbDevice = new MatterbridgeDevice(bridgedNode, undefined, config.debug as boolean);
      mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        device.name,
        device.id,
        0xfff1,
        'Shelly',
        device.model,
        1, // Number(device.firmware.split('.')[0]),
        device.firmware,
      );
      const child = mbDevice.addChildDeviceTypeWithClusterServer('PowerSource', [powerSource], [PowerSource.Cluster.id]);
      child.addClusterServer(mbDevice.getDefaultPowerSourceWiredClusterServer());

      // Scan the device components
      for (const [key, component] of device) {
        if (component.name === 'Light') {
          const lightComponent = device.getComponent(key);
          if (lightComponent) {
            let deviceType = DeviceTypes.ON_OFF_LIGHT;
            if (lightComponent.hasProperty('brightness')) deviceType = DeviceTypes.DIMMABLE_LIGHT;
            if (lightComponent.hasProperty('red')) deviceType = DeviceTypes.COLOR_TEMPERATURE_LIGHT;
            const clusterIds: ClusterId[] = [OnOff.Cluster.id];
            if (lightComponent.hasProperty('brightness')) clusterIds.push(LevelControl.Cluster.id);
            if (lightComponent.hasProperty('red')) clusterIds.push(ColorControl.Cluster.id);
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], clusterIds);
            // child.addClusterServer(mbDevice.getDefaultXYColorControlClusterServer());
            mbDevice.addFixedLabel('composed', component.name);
            // Set the onOff attribute
            const state = lightComponent.getValue('state');
            if (state !== undefined) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state as boolean);
            // Set the currentLevel attribute
            const level = lightComponent.getValue('brightness');
            if (level !== undefined) {
              const matterLevel = Math.max(Math.min(Math.round((level as number) / 100) * 255, 255), 0);
              child.getClusterServer(LevelControlCluster)?.setCurrentLevelAttribute(matterLevel as number);
            }
            // Set the currentX and currentY attribute
            // TODO

            // Add command handlers from Matter
            mbDevice.addCommandHandler('on', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'Off', false);
            });
            mbDevice.addCommandHandler('toggle', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'Toggle', false);
            });
            mbDevice.addCommandHandler('moveToLevel', async ({ request, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              this.shellyLightCommandHandler(mbDevice, endpoint.number, device, 'Level', state, request.level);
            });
            mbDevice.addCommandHandler('moveToLevelWithOnOff', async ({ request, endpoint }) => {
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              this.shellyLightCommandHandler(mbDevice, endpoint.number, device, 'Level', state, request.level);
            });
            mbDevice.addCommandHandler('moveToHue', async ({ request, attributes, endpoint }) => {
              attributes.colorMode.setLocal(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              const level = child.getClusterServer(LevelControlCluster)?.getCurrentLevelAttribute();
              const saturation = child.getClusterServer(ColorControlCluster.with(ColorControl.Feature.HueSaturation))?.getCurrentSaturationAttribute() ?? 0;
              const rgb = hslColorToRgbColor((request.hue / 254) * 360, (saturation / 254) * 100, 50);
              this.log.warn(`***Sending command moveToHue => ColorRGB(${rgb.r},  ${rgb.g}, ${rgb.b})`);
              if (device.colorCommandTimeout) clearTimeout(device.colorCommandTimeout);
              device.colorCommandTimeout = setTimeout(() => {
                this.shellyLightCommandHandler(mbDevice, endpoint.number, device, 'ColorRGB', state, level, { r: rgb.r, g: rgb.g, b: rgb.b });
              }, 500);
            });
            mbDevice.addCommandHandler('moveToSaturation', async ({ request, attributes, endpoint }) => {
              attributes.colorMode.setLocal(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              const level = child.getClusterServer(LevelControlCluster)?.getCurrentLevelAttribute();
              const hue = child.getClusterServer(ColorControlCluster.with(ColorControl.Feature.HueSaturation))?.getCurrentHueAttribute() ?? 0;
              const rgb = hslColorToRgbColor((hue / 254) * 360, (request.saturation / 254) * 100, 50);
              this.log.warn(`***Sending command moveToSaturation => ColorRGB(${rgb.r},  ${rgb.g}, ${rgb.b})`);
              if (device.colorCommandTimeout) clearTimeout(device.colorCommandTimeout);
              device.colorCommandTimeout = setTimeout(() => {
                this.shellyLightCommandHandler(mbDevice, endpoint.number, device, 'ColorRGB', state, level, { r: rgb.r, g: rgb.g, b: rgb.b });
              }, 500);
            });
            mbDevice.addCommandHandler('moveToHueAndSaturation', async ({ request, attributes, endpoint }) => {
              attributes.colorMode.setLocal(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
              const state = child.getClusterServer(OnOffCluster)?.getOnOffAttribute();
              const level = child.getClusterServer(LevelControlCluster)?.getCurrentLevelAttribute();
              const rgb = hslColorToRgbColor((request.hue / 254) * 360, (request.saturation / 254) * 100, 50);
              this.shellyLightCommandHandler(mbDevice, endpoint.number, device, 'ColorRGB', state, level, { r: rgb.r, g: rgb.g, b: rgb.b });
            });

            // Add event handler from Shelly
            lightComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Switch' || component.name === 'Relay') {
          const switchComponent = device.getComponent(key) as ShellySwitchComponent;
          if (switchComponent) {
            let deviceType = onOffSwitch;
            if (config.exposeSwitch === 'light') deviceType = DeviceTypes.ON_OFF_LIGHT;
            if (config.exposeSwitch === 'outlet') deviceType = DeviceTypes.ON_OFF_PLUGIN_UNIT;
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], [OnOff.Cluster.id]);
            mbDevice.addFixedLabel('composed', component.name);
            // switchComponent.logComponent();
            if (
              switchComponent.hasProperty('voltage') &&
              switchComponent.hasProperty('current') &&
              switchComponent.hasProperty('apower') &&
              switchComponent.hasProperty('aenergy')
            ) {
              child.addClusterServer(
                mbDevice.getDefaultStaticEveHistoryClusterServer(
                  switchComponent.getValue('voltage') as number,
                  switchComponent.getValue('current') as number,
                  switchComponent.getValue('apower') as number,
                  ((switchComponent.getValue('aenergy') as ShellyData).total as number) / 1000,
                ),
              );
              // this.log.warn(`Added EveHistory cluster to ${device.id} component ${key}`);
            }
            // Set the OnOff attribute
            const state = switchComponent.getValue('state');
            if (state !== undefined) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state as boolean);
            // Add command handlers
            mbDevice.addCommandHandler('on', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'Off', false);
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
            if (coverComponent.hasProperty('voltage') && coverComponent.hasProperty('current') && coverComponent.hasProperty('apower') && coverComponent.hasProperty('aenergy')) {
              child.addClusterServer(
                mbDevice.getDefaultStaticEveHistoryClusterServer(
                  coverComponent.getValue('voltage') as number,
                  coverComponent.getValue('current') as number,
                  coverComponent.getValue('apower') as number,
                  ((coverComponent.getValue('aenergy') as ShellyData).total as number) / 1000,
                ),
              );
              // this.log.warn(`Added EveHistory cluster to ${device.id} component ${key}`);
            }

            // TODO: Add the WindowCovering attributes
            /*
            "pos_control": true,
            "current_pos": 0
            */
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
            });
          }
        } else if (component.name === 'PowerMeter' && config.exposePowerMeter !== 'disabled') {
          const pmComponent = device.getComponent(key);
          if (pmComponent) {
            mbDevice.addFixedLabel('composed', component.name);
            // Add the Matter 1.3 device type with the ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters
            // mbDevice.addChildDeviceTypeWithClusterServer('electricalSensor', [electricalSensor], [ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id]);
            // Add the custom EveHistory cluster for HA
            ClusterRegistry.register(EveHistory.Complete);
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [powerSource], [EveHistory.Cluster.id]);
            // Set the electrical attributes
            const voltage = pmComponent.hasProperty('voltage') ? pmComponent.getValue('voltage') : undefined;
            if (voltage !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setVoltageAttribute(voltage as number);

            const current = pmComponent.hasProperty('current') ? pmComponent.getValue('current') : undefined;
            if (current !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setCurrentAttribute(current as number);

            const power1 = pmComponent.hasProperty('power') ? pmComponent.getValue('power') : undefined; // Gen 1 devices
            if (power1 !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setConsumptionAttribute(power1 as number);
            const power2 = pmComponent.hasProperty('apower') ? pmComponent.getValue('apower') : undefined; // Gen 2 devices
            if (power2 !== undefined) child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setConsumptionAttribute(power2 as number);

            const energy1 = pmComponent.hasProperty('total') ? pmComponent.getValue('total') : undefined; // Gen 1 devices in watts
            if (energy1 !== undefined && energy1 !== null)
              child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setTotalConsumptionAttribute((energy1 as number) / 1000);
            const energy2 = pmComponent.hasProperty('aenergy') ? pmComponent.getValue('aenergy') : undefined; // Gen 2 devices in watts
            if (energy2 !== undefined && energy2 !== null)
              child.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy))?.setTotalConsumptionAttribute(((energy2 as ShellyData).total as number) / 1000);

            // Add event handler
            pmComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Input' && config.exposeInput !== 'disabled') {
          const inputComponent = device.getComponent(key);
          if (inputComponent && config.exposeInput === 'contact') {
            const deviceType = config.exposeInput === 'contact' ? DeviceTypes.CONTACT_SENSOR : DeviceTypes.GENERIC_SWITCH;
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], []);
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
  }

  override async onStart(reason?: string) {
    this.log.info(`Starting platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

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
      this.shelly.startMdns(60 * 10 /* , this.config.debug as boolean*/);
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
    this.log.info(`Configuring platform ${idn}${this.config.name}${rs}${nf}`);
  }

  override async onShutdown(reason?: string) {
    this.log.info(`Shutting down platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

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
    await device.saveDevicePayloads(path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly'));
    await this.shelly.addDevice(device);
    this.shellyDevices.set(device.id, device);
  }

  isValidIpv4Address(ipv4Address: string): boolean {
    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ipv4Address);
  }

  protected triggerSwitchEvent(endpoint: Endpoint, event: string) {
    const cluster = endpoint.getClusterServer(
      SwitchCluster.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress),
    );
    if (!cluster) {
      this.log.error(`triggerSwitchEvent error: Switch cluster not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return;
    }
    if (event === 'Single') {
      cluster.setCurrentPositionAttribute(1);
      cluster.triggerInitialPressEvent({ newPosition: 1 });
      cluster.setCurrentPositionAttribute(0);
      cluster.triggerShortReleaseEvent({ previousPosition: 1 });
      cluster.setCurrentPositionAttribute(0);
      cluster.triggerMultiPressCompleteEvent({ previousPosition: 1, totalNumberOfPressesCounted: 1 });
      this.log.debug(`Trigger 'Single press' event for ${endpoint.name}:${endpoint.number}`);
    }
    if (event === 'Double') {
      cluster.setCurrentPositionAttribute(1);
      cluster.triggerInitialPressEvent({ newPosition: 1 });
      cluster.setCurrentPositionAttribute(0);
      cluster.triggerShortReleaseEvent({ previousPosition: 1 });
      cluster.setCurrentPositionAttribute(1);
      cluster.triggerInitialPressEvent({ newPosition: 1 });
      cluster.triggerMultiPressOngoingEvent({ newPosition: 1, currentNumberOfPressesCounted: 2 });
      cluster.setCurrentPositionAttribute(0);
      cluster.triggerShortReleaseEvent({ previousPosition: 1 });
      cluster.triggerMultiPressCompleteEvent({ previousPosition: 1, totalNumberOfPressesCounted: 2 });
      this.log.debug(`Trigger 'Double press' event for ${endpoint.name}:${endpoint.number}`);
    }
    if (event === 'Long') {
      cluster.setCurrentPositionAttribute(1);
      cluster.triggerInitialPressEvent({ newPosition: 1 });
      cluster.triggerLongPressEvent({ newPosition: 1 });
      cluster.setCurrentPositionAttribute(0);
      cluster.triggerLongReleaseEvent({ previousPosition: 1 });
      this.log.debug(`Trigger 'Long press' event for ${endpoint.name}:${endpoint.number}`);
    }
  }

  private shellyLightCommandHandler(
    matterbridgeDevice: MatterbridgeDevice,
    endpointNumber: EndpointNumber | undefined,
    shellyDevice: ShellyDevice,
    command: string,
    state?: boolean,
    level?: number | null,
    color?: { r: number; g: number; b: number },
  ): boolean {
    // Get the matter endpoint
    if (!endpointNumber) {
      shellyDevice.log.error(`shellyCommandHandler error: endpointNumber undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const endpoint = matterbridgeDevice.getChildEndpoint(endpointNumber);
    if (!endpoint) {
      shellyDevice.log.error(`shellyCommandHandler error: endpoint not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Get the Shelly switch component
    const componentName = matterbridgeDevice.getEndpointLabel(endpointNumber);
    if (!componentName) {
      shellyDevice.log.error(`shellyCommandHandler error: componentName not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const switchComponent = shellyDevice?.getComponent(componentName) as ShellySwitchComponent;
    if (!switchComponent) {
      shellyDevice.log.error(`shellyCommandHandler error: component ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Send On() Off() Toggle() command
    if (command === 'On') switchComponent.On();
    else if (command === 'Off') switchComponent.Off();
    else if (command === 'Toggle') switchComponent.Toggle();
    if (command === 'On' || command === 'Off' || command === 'Toggle')
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);

    // Send Level() command
    if (command === 'Level' && level !== null && level !== undefined) {
      const shellyLevel = Math.max(Math.min(Math.round((level / 254) * 100), 100), 1);
      switchComponent?.Level(shellyLevel);
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:Level(${YELLOW}${shellyLevel}${nf}) for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
    }

    // Send ColorRGB() command
    if (command === 'ColorRGB' && color !== undefined) {
      color.r = Math.max(Math.min(color.r, 255), 0);
      color.g = Math.max(Math.min(color.g, 255), 0);
      color.b = Math.max(Math.min(color.b, 255), 0);
      switchComponent?.ColorRGB(color.r, color.g, color.b);
      shellyDevice.log.info(
        `Command ${hk}${componentName}${nf}:ColorRGB(${YELLOW}${color.r}${nf}, ${YELLOW}${color.g}${nf}, ${YELLOW}${color.b}${nf}) for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`,
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
      shellyDevice.log.error(`shellyCoverCommandHandler error: endpointNumber undefined for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const endpoint = matterbridgeDevice.getChildEndpoint(endpointNumber);
    if (!endpoint) {
      shellyDevice.log.error(`shellyCoverCommandHandler error: endpoint not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Get the Shelly cover component
    const componentName = matterbridgeDevice.getEndpointLabel(endpointNumber);
    if (!componentName) {
      shellyDevice.log.error(`shellyCoverCommandHandler error: endpointName not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    const coverComponent = shellyDevice?.getComponent(componentName) as ShellyCoverComponent;
    if (!coverComponent) {
      shellyDevice.log.error(`shellyCoverCommandHandler error: component ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Matter uses 10000 = fully closed   0 = fully opened
    // Shelly uses 0 = fully closed   100 = fully opened
    const coverCluster = endpoint.getClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
    );
    if (!coverCluster) {
      shellyDevice.log.error('shellyCoverCommandHandler error: cluster WindowCoveringCluster not found');
      return false;
    }
    if (command === 'Stop') {
      coverComponent.Stop();
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
    } else if (command === 'Open') {
      coverComponent.Open();
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
    } else if (command === 'Close') {
      coverComponent.Close();
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
    } else if (command === 'GoToPosition' && pos !== undefined) {
      const shellyPos = 100 - Math.max(Math.min(Math.round(pos / 100), 10000), 0);
      coverComponent.GoToPosition(shellyPos);
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}(${shellyPos}) for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
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
      const matterLevel = Math.max(Math.min(Math.round(((value as number) / 100) * 255), 255), 0);
      cluster?.setCurrentLevelAttribute(matterLevel);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}LevelControl-currentLevel${db} ${YELLOW}${matterLevel}${db}`);
    }
    // Update color
    if (shellyComponent.name === 'Light' && ['red', 'green', 'blue', 'white'].includes(property)) {
      const red = property === 'red' ? (value as number) : (shellyComponent.getValue('red') as number);
      const green = property === 'green' ? (value as number) : (shellyComponent.getValue('green') as number);
      const blue = property === 'blue' ? (value as number) : (shellyComponent.getValue('blue') as number);
      const cluster = endpoint.getClusterServer(ColorControl.Complete);
      const hsl = rgbColorToHslColor({ r: red, g: green, b: blue });
      this.log.warn(`Color: R:${red} G:${green} B:${blue} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
      if (shellyDevice.colorUpdateTimeout) clearTimeout(shellyDevice.colorUpdateTimeout);
      shellyDevice.colorUpdateTimeout = setTimeout(() => {
        const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
        const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
        cluster?.setCurrentHueAttribute(hue);
        cluster?.setCurrentSaturationAttribute(saturation);
        cluster?.setColorModeAttribute(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
        shellyDevice.log.info(
          `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}ColorControl.currentHue:${YELLOW}${hue}${db} ${hk}ColorControl.currentSaturation:${YELLOW}${saturation}${db}`,
        );
      }, 200);
    }
    // Update cover
    if (shellyComponent.name === 'Cover' || shellyComponent.name === 'Roller') {
      const windowCoveringCluster = endpoint.getClusterServer(
        WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
      );
      if (!windowCoveringCluster) {
        shellyDevice.log.error('shellyUpdateHandler error: cluster WindowCoveringCluster not found');
        return;
      }
      // Matter uses 10000 = fully closed   0 = fully opened
      // Shelly uses 0 = fully closed   100 = fully opened
      // Gen 2 open sequence: state:open state:opening current_pos:100 state:open
      // Gen 2 close sequence: state:close state:closing current_pos:0 state:close
      // Gen 2 stop sequence: state:stop current_pos:80 state:stopped
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
        windowCoveringCluster?.setCurrentPositionLiftPercent100thsAttribute(matterPos);
      } else if (property === 'target_pos' && value !== -1 && value !== null) {
        const matterPos = 10000 - Math.min(Math.max(Math.round((value as number) * 100), 0), 10000);
        windowCoveringCluster?.setTargetPositionLiftPercent100thsAttribute(matterPos);
      }
      const current = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
      const target = windowCoveringCluster.getTargetPositionLiftPercent100thsAttribute();
      const status = windowCoveringCluster.getOperationalStatusAttribute();
      const statusLookup = ['stopped', 'opening', 'closing', 'unknown'];
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}WindowCovering${db} current:${YELLOW}${current}${db} target:${YELLOW}${target}${db} status:${YELLOW}${statusLookup[status.global ?? 3]}${rs}`,
      );
    }
    // Update energy from main components (gen 2 devices send power total inside the component not with meter)
    if (
      shellyComponent.name === 'Light' ||
      shellyComponent.name === 'Relay' ||
      shellyComponent.name === 'Switch' ||
      shellyComponent.name === 'Cover' ||
      shellyComponent.name === 'Roller'
    ) {
      if (property === 'power' || property === 'apower') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setConsumptionAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-consumption${db} ${YELLOW}${value as number}${db}`);
        const voltage = shellyComponent.getValue('voltage') as number;
        if (voltage) {
          const current = (value as number) / voltage;
          cluster?.setCurrentAttribute(current as number);
          shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-current${db} ${YELLOW}${current as number}${db}`);
        }
      }
      if (property === 'total') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute((value as number) / 1000); // convert to kWh
        if (cluster)
          shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${(value as number) / 1000}${db}`);
      }
      if (property === 'aenergy') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute(((value as ShellyData).total as number) / 1000); // convert to kWh
        if (cluster)
          shellyDevice.log.info(
            `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${((value as ShellyData).total as number) / 1000}${db}`,
          );
      }
      if (property === 'voltage') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setVoltageAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-voltage${db} ${YELLOW}${value as number}${db}`);
      }
      if (property === 'current') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setCurrentAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-current${db} ${YELLOW}${value as number}${db}`);
      }
    }

    // Update energy from PowerMeter
    if (shellyComponent.name === 'PowerMeter') {
      if (property === 'power' || property === 'apower') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setConsumptionAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-consumption${db} ${YELLOW}${value as number}${db}`);
      }
      if (property === 'voltage') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setVoltageAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-voltage${db} ${YELLOW}${value as number}${db}`);
      }
      if (property === 'current') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setCurrentAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-current${db} ${YELLOW}${value as number}${db}`);
      }
      if (property === 'total') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute((value as number) / 1000); // convert to kWh
        if (cluster)
          shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${(value as number) / 1000}${db}`);
      }
      if (property === 'aenergy') {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute(((value as ShellyData).total as number) / 1000); // convert to kWh
        if (cluster)
          shellyDevice.log.info(
            `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${((value as ShellyData).total as number) / 1000}${db}`,
          );
      }
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
