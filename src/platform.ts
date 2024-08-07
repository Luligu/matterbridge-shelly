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
  electricalSensor,
  ElectricalPowerMeasurement,
  ElectricalEnergyMeasurement,
  OccupancySensingCluster,
  IlluminanceMeasurementCluster,
  TemperatureMeasurementCluster,
} from 'matterbridge';
import { EveHistory, EveHistoryCluster } from 'matterbridge/history';
import { AnsiLogger, BLUE, CYAN, GREEN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, or, rs, wr, zb } from 'matterbridge/logger';
import { NodeStorage, NodeStorageManager } from 'matterbridge/storage';
import { hslColorToRgbColor, rgbColorToHslColor } from 'matterbridge/utils';

import path from 'path';

import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';

type ConfigDeviceIp = Record<string, string>;

// Shelly device id (e.g. shellyplus1pm-441793d69718)
type ShellyDeviceId = string;

function isValid(value: ShellyDataType, type: string): boolean {
  return value !== null && value !== undefined && typeof value === type;
}
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

    log.debug(`Initializing platform: ${idn}${this.config.name}${rs}${db}`);
    log.debug(`- username: ${CYAN}${config.username}`);
    log.debug(`- password: ${CYAN}${config.password}`);
    log.debug(`- mdnsDiscover: ${CYAN}${config.enableMdnsDiscover}`);
    log.debug(`- storageDiscover: ${CYAN}${config.enableStorageDiscover}`);
    log.debug(`- configDiscover: ${CYAN}${config.enableConfigDiscover}`);
    log.debug(`- resetStorageDiscover: ${CYAN}${config.resetStorageDiscover}`);
    log.debug(`- interfaceName: ${CYAN}${config.interfaceName}`);
    log.debug(`- debug: ${CYAN}${config.debug}`);
    log.debug(`- debugMdns: ${CYAN}${config.debugMdns}`);
    log.debug(`- debugCoap: ${CYAN}${config.debugCoap}`);
    log.debug(`- unregisterOnShutdown: ${CYAN}${config.unregisterOnShutdown}`);

    this.shelly = new Shelly(log, this.username, this.password);
    this.shelly.setLogLevel(log.logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean);
    this.shelly.dataPath = path.join(matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly');
    this.shelly.debugMdns = this.config.debugMdns as boolean;
    this.shelly.debugCoap = this.config.debugCoap as boolean;

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
      device.log.info(`Shelly added ${idn}${device.name}${rs} device id ${hk}${device.id}${rs}${nf} host ${zb}${device.host}${nf}`);
      device.log.info(`- gen: ${CYAN}${device.gen}${nf}`);
      device.log.info(`- mac: ${CYAN}${device.mac}${nf}`);
      device.log.info(`- model: ${CYAN}${device.model}${nf}`);
      device.log.info(`- firmware: ${CYAN}${device.firmware}${nf}`);
      if (device.profile) device.log.info(`- profile: ${CYAN}${device.profile}${nf}`);
      if (device.sleepMode) device.log.info(`- sleep: ${CYAN}${device.sleepMode}${nf}`);
      device.log.info('- components:');
      for (const [key, component] of device) {
        device.log.info(`  - ${CYAN}${key}${nf} (${GREEN}${component.name}${nf})`);
      }
      if (config.debug) device.logDevice();

      /*
      device.getComponent('sensor')?.logComponent();
      device.getComponent('lux')?.logComponent();
      device.getComponent('battery')?.logComponent();
      device.getComponent('motion')?.logComponent();
      device.getComponent('contact')?.logComponent();
      device.getComponent('vibration')?.logComponent();
      device.getComponent('flood')?.logComponent();
      */

      if (device.name === undefined || device.id === undefined || device.model === undefined || device.firmware === undefined) {
        this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} is not valid. Please put it in the blackList and open an issue.`);
        return;
      }
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

      mbDevice.addCommandHandler('identify', async ({ request, endpoint }) => {
        this.log.info(`Identify command received for endpoint ${endpoint.number} request ${debugStringify(request)}`);
      });

      const child = mbDevice.addChildDeviceTypeWithClusterServer('PowerSource', [powerSource], [PowerSource.Cluster.id]);
      const battery = device.getComponent('battery');
      if (battery) {
        if (battery.hasProperty('charging')) {
          child.addClusterServer(mbDevice.getDefaultPowerSourceRechargeableBatteryClusterServer());
        } else {
          child.addClusterServer(mbDevice.getDefaultPowerSourceReplaceableBatteryClusterServer());
        }
        battery.on('update', (component: string, property: string, value: ShellyDataType) => {
          this.shellyUpdateHandler(mbDevice, device, component, property, value);
        });
      } else {
        child.addClusterServer(mbDevice.getDefaultPowerSourceWiredClusterServer());
      }

      // Scan the device components
      for (const [key, component] of device) {
        if (component.name === 'Light' || component.name === 'Rgb') {
          const lightComponent = device.getComponent(key);
          if (lightComponent) {
            // Set the device type
            let deviceType = DeviceTypes.ON_OFF_LIGHT;
            if (lightComponent.hasProperty('brightness')) deviceType = DeviceTypes.DIMMABLE_LIGHT;
            if ((lightComponent.hasProperty('red') && lightComponent.hasProperty('green') && lightComponent.hasProperty('blue')) || lightComponent.hasProperty('rgb'))
              deviceType = DeviceTypes.COLOR_TEMPERATURE_LIGHT;
            // Set the clusterIds
            const clusterIds: ClusterId[] = [OnOff.Cluster.id];
            if (lightComponent.hasProperty('brightness')) clusterIds.push(LevelControl.Cluster.id);
            if ((lightComponent.hasProperty('red') && lightComponent.hasProperty('green') && lightComponent.hasProperty('blue')) || lightComponent.hasProperty('rgb'))
              clusterIds.push(ColorControl.Cluster.id);
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], clusterIds);
            this.configureColorControlCluster(child, true, false, false, ColorControl.ColorMode.CurrentHueAndCurrentSaturation);

            mbDevice.addFixedLabel('composed', component.name);

            // Set the onOff attribute
            const state = lightComponent.getValue('state');
            if (state !== undefined && typeof state === 'boolean') child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state);

            // Set the currentLevel attribute
            const level = lightComponent.getValue('brightness');
            if (level !== undefined && typeof level === 'number') {
              const matterLevel = Math.max(Math.min(Math.round((level as number) / 100) * 255, 255), 0);
              child.getClusterServer(LevelControlCluster)?.setCurrentLevelAttribute(matterLevel);
            }
            // TODO Set the currentHue and currentSaturation attribute
            // TODO Set the currentX and currentY attribute

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

            // Add the electrical EveHistory cluster
            if (
              config.exposePowerMeter === 'evehistory' &&
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

            // Add the electrical EveHistory cluster
            if (
              config.exposePowerMeter === 'evehistory' &&
              coverComponent.hasProperty('voltage') &&
              coverComponent.hasProperty('current') &&
              coverComponent.hasProperty('apower') &&
              coverComponent.hasProperty('aenergy')
            ) {
              child.addClusterServer(
                mbDevice.getDefaultStaticEveHistoryClusterServer(
                  coverComponent.getValue('voltage') as number,
                  coverComponent.getValue('current') as number,
                  coverComponent.getValue('apower') as number,
                  ((coverComponent.getValue('aenergy') as ShellyData).total as number) / 1000,
                ),
              );
            }

            // Set the WindowCovering attributes
            /*
            "positioning": true, // Gen 1 devices when positioning control is enabled (even if it is not calibrated)
            "pos_control": true, // Gen 2 devices
            "current_pos": 0 // Gen 1 and 2 devices 0-100
            */
            const position = coverComponent.hasProperty('current_pos') ? (coverComponent.getValue('current_pos') as number) : undefined;
            if (position !== undefined && position !== null && position >= 0 && position <= 100) {
              const matterPos = 10000 - Math.min(Math.max(Math.round(position * 100), 0), 10000);
              child.getClusterServer(WindowCovering.Complete)?.setCurrentPositionLiftPercent100thsAttribute(matterPos);
            }
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
            if (config.exposePowerMeter === 'matter13') {
              // Add the Matter 1.3 electricalSensor device type with the ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [electricalSensor], [ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id]);
              // Set the electrical attributes
              const epm = child.getClusterServer(ElectricalPowerMeasurement.Complete);
              const voltage = pmComponent.hasProperty('voltage') ? pmComponent.getValue('voltage') : undefined;
              if (voltage !== undefined) epm?.setVoltageAttribute(50);

              const current = pmComponent.hasProperty('current') ? pmComponent.getValue('current') : undefined;
              if (current !== undefined) epm?.setActiveCurrentAttribute(current as number);

              const power1 = pmComponent.hasProperty('power') ? pmComponent.getValue('power') : undefined; // Gen 1 devices
              if (power1 !== undefined) epm?.setActivePowerAttribute(power1 as number);
              const power2 = pmComponent.hasProperty('apower') ? pmComponent.getValue('apower') : undefined; // Gen 2 devices
              if (power2 !== undefined) epm?.setActivePowerAttribute(power2 as number);

              const eem = child.getClusterServer(ElectricalEnergyMeasurement.Complete);
              const energy1 = pmComponent.hasProperty('total') ? pmComponent.getValue('total') : undefined; // Gen 1 devices in watts
              if (energy1 !== undefined && energy1 !== null) eem?.setCumulativeEnergyImportedAttribute({ energy: (energy1 as number) / 1000 });
              const energy2 = pmComponent.hasProperty('aenergy') ? pmComponent.getValue('aenergy') : undefined; // Gen 2 devices in watts
              if (energy2 !== undefined && energy2 !== null) eem?.setCumulativeEnergyImportedAttribute({ energy: ((energy2 as ShellyData).total as number) / 1000 });
            } else if (config.exposePowerMeter === 'evehistory') {
              // Add the powerSource device type with the EveHistory cluster for HA
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
            }
            // Add event handler
            pmComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Input' && config.exposeInput !== 'disabled') {
          const inputComponent = device.getComponent(key);
          if (inputComponent && inputComponent?.hasProperty('state') && config.exposeInput === 'contact') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            mbDevice.addFixedLabel('composed', component.name);
            // Set the state attribute
            const state = inputComponent.getValue('state') as boolean;
            // TODO why? console.error(`***state: type ${typeof state} value ${state}`);
            if (state !== undefined && state !== null && typeof state === 'boolean') child.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(state);
            // Add event handler
            inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          } else if (inputComponent && inputComponent?.hasProperty('state') && config.exposeInput === 'momentary') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
            mbDevice.addFixedLabel('composed', component.name);
            // Set the state attribute
            const state = inputComponent.getValue('state') as boolean;
            if (state !== undefined && state !== null && typeof state === 'boolean')
              child.getClusterServer(SwitchCluster.with(Switch.Feature.MomentarySwitch))?.setCurrentPositionAttribute(state ? 1 : 0);
            // Add event handler
            inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          } else if (inputComponent && inputComponent?.hasProperty('state') && config.exposeInput === 'latching') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultLatchingSwitchClusterServer());
            mbDevice.addFixedLabel('composed', component.name);
            // Set the state attribute
            const state = inputComponent.getValue('state') as boolean;
            if (state !== undefined && state !== null && typeof state === 'boolean')
              child.getClusterServer(SwitchCluster.with(Switch.Feature.LatchingSwitch))?.setCurrentPositionAttribute(state ? 1 : 0);
            // Add event handler
            inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          } else if (inputComponent && inputComponent?.hasProperty('event') && config.exposeInputEvent !== 'disabled') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
            mbDevice.addFixedLabel('composed', component.name);
            // Set the current position to 0
            child.getClusterServer(SwitchCluster.with(Switch.Feature.MomentarySwitch))?.setCurrentPositionAttribute(0);
            // Add event handler
            inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Sensor' && config.exposeSensor !== 'disabled') {
          const sensorComponent = device.getComponent(key);
          if (sensorComponent?.hasProperty('contact_open') && config.exposeContact !== 'disabled') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(sensorComponent.getValue('contact_open') === false));
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
          if (sensorComponent?.hasProperty('motion') && config.exposeMotion !== 'disabled') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.OCCUPANCY_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultOccupancySensingClusterServer(sensorComponent.getValue('motion') as boolean));
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Vibration' && config.exposeVibration !== 'disabled') {
          const vibrationComponent = device.getComponent(key);
          if (vibrationComponent?.hasProperty('vibration')) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            vibrationComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Temperature' && config.exposeTemperature !== 'disabled') {
          const tempComponent = device.getComponent(key);
          if (tempComponent?.hasProperty('value') && typeof tempComponent.getValue('value') === 'number') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.TEMPERATURE_SENSOR], []);
            const matterTemp = Math.min(Math.max(Math.round((tempComponent.getValue('value') as number) * 100), -10000), 10000);
            child.addClusterServer(mbDevice.getDefaultTemperatureMeasurementClusterServer(matterTemp));
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            tempComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Flood' && config.exposeFlood !== 'disabled') {
          const floodComponent = device.getComponent(key);
          if (floodComponent?.hasProperty('flood') && typeof floodComponent.getValue('flood') === 'boolean') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(!(floodComponent.getValue('flood') as boolean)));
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            floodComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Lux' && config.exposeLux !== 'disabled') {
          const luxComponent = device.getComponent(key);
          if (luxComponent?.hasProperty('value')) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.LIGHT_SENSOR], []);
            const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(luxComponent.getValue('value') as number), 0xfffe), 0));
            child.addClusterServer(mbDevice.getDefaultIlluminanceMeasurementClusterServer(matterLux));
            mbDevice.addFixedLabel('composed', component.name);
            // Add event handler
            luxComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
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
        /*
        mbDevice.getAllClusterServers().forEach((clusterServer) => {
          this.log.warn(`***clusters: ${clusterServer.id}-${clusterServer.name}`);
        });
        */
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
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
      forgiveParseErrors: true,
    });
    this.nodeStorage = await this.nodeStorageManager.createStorage('devices');
    if (this.config.resetStorageDiscover === true) {
      this.config.resetStorageDiscover = false;
      this.log.info('Resetting the Shellies storage');
      await this.nodeStorage.clear();
      this.log.info('Reset the Shellies storage');
    } else {
      await this.loadStoredDevices();
    }

    // start Shelly mDNS device discoverer
    if (this.config.enableMdnsDiscover === true) {
      this.shelly.startMdns(10 * 60 * 1000, this.config.interfaceName as string, 'udp4', this.config.debugMdns as boolean);
    }

    // add all stored devices
    if (this.config.enableStorageDiscover === true) {
      this.log.info(`Loading from storage ${this.storedDevices.size} Shelly devices`);
      this.storedDevices.forEach(async (storedDevice) => {
        storedDevice.id = ShellyDevice.normalizeId(storedDevice.id).id;
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
      this.log.info(`Loading from config ${Object.entries(this.config.deviceIp as ConfigDeviceIp).length} Shelly devices`);
      Object.entries(this.config.deviceIp as ConfigDeviceIp).forEach(async ([id, host]) => {
        id = ShellyDevice.normalizeId(id).id;
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
    this.bridgedDevices.forEach(async (mbDevice) => {
      if (!mbDevice.serialNumber) return;
      this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} shelly ${hk}${mbDevice.serialNumber}${nf}`);
      const shellyDevice = this.shelly.getDevice(mbDevice.serialNumber);
      if (!shellyDevice) return;
      mbDevice.getChildEndpoints().forEach(async (childEndpoint) => {
        const label = mbDevice.getEndpointLabel(childEndpoint.number);
        if (label?.startsWith('switch') || label?.startsWith('relay') || label?.startsWith('light') || label?.startsWith('rgb')) {
          const switchComponent = shellyDevice.getComponent(label) as ShellySwitchComponent;
          this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}state ${YELLOW}${switchComponent.getValue('state')}${nf}`);
          if (typeof switchComponent.getValue('state') === 'boolean') childEndpoint.getClusterServer(OnOffCluster)?.setOnOffAttribute(switchComponent.getValue('state') as boolean);
        }
        if (label?.startsWith('light') || label?.startsWith('rgb')) {
          const lightComponent = shellyDevice.getComponent(label) as ShellyLightComponent;
          const level = lightComponent.getValue('brightness') as number;
          if (level !== undefined && typeof level === 'number') {
            const matterLevel = Math.max(Math.min(Math.round((level / 100) * 255), 255), 0);
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}brightness ${YELLOW}${matterLevel}${nf}`);
            childEndpoint.getClusterServer(LevelControlCluster)?.setCurrentLevelAttribute(matterLevel);
          }
        }
        if (label?.startsWith('cover') || label?.startsWith('roller')) {
          const coverComponent = shellyDevice.getComponent(label) as ShellyCoverComponent;
          const position = coverComponent.hasProperty('current_pos') ? (coverComponent.getValue('current_pos') as number) : undefined;
          if (position && position !== null && position >= 0 && position <= 100) {
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}current_pos ${YELLOW}${position}${nf}`);
            const matterPos = 10000 - Math.min(Math.max(Math.round(position * 100), 0), 10000);
            mbDevice.setWindowCoveringCurrentTargetStatus(matterPos, matterPos, WindowCovering.MovementStatus.Stopped, childEndpoint);
          } else {
            mbDevice.setWindowCoveringTargetAsCurrentAndStopped(childEndpoint);
          }
        }
        if (label?.startsWith('input')) {
          const inputComponent = shellyDevice.getComponent(label) as ShellyComponent;
          if (inputComponent.hasProperty('state') && typeof inputComponent.getValue('state') === 'boolean') {
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}state ${YELLOW}${inputComponent.getValue('state')}${nf}`);
            if (this.config.exposeInput === 'contact') childEndpoint.getClusterServer(OnOffCluster)?.setOnOffAttribute(inputComponent.getValue('state') as boolean);
            if (this.config.exposeInput === 'momentary' || this.config.exposeInput === 'latching')
              childEndpoint.getClusterServer(Switch.Complete)?.setCurrentPositionAttribute((inputComponent.getValue('state') as boolean) ? 1 : 0);
          }
        }
      });
    });
  }

  override async onShutdown(reason?: string) {
    this.log.info(`Shutting down platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

    this.shelly.destroy();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(
      `Changing logger level for platform ${idn}${this.config.name}${rs}${db} to ${logLevel} with debugMdns ${this.config.debugMdns} and debugCoap ${this.config.debugCoap}`,
    );
    this.shelly.setLogLevel(logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean);
  }

  private async saveStoredDevices(): Promise<boolean> {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return false;
    }
    this.log.debug(`Saving ${this.storedDevices.size} discovered Shelly devices to the storage`);
    await this.nodeStorage.set<DiscoveredDevice[]>('DeviceIdentifiers', Array.from(this.storedDevices.values()));
    return true;
  }

  private async loadStoredDevices(): Promise<boolean> {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return false;
    }
    const storedDevices = await this.nodeStorage.get<DiscoveredDevice[]>('DeviceIdentifiers', []);
    for (const device of storedDevices) this.storedDevices.set(device.id, device);
    this.log.debug(`Loaded ${this.storedDevices.size} discovered Shelly devices from the storage`);
    return true;
  }

  private async addDevice(deviceId: string, host: string) {
    if (this.shelly.hasDevice(deviceId) || this.shelly.hasDeviceHost(host)) {
      this.log.info(`Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf} already added`);
      return;
    }
    this.log.info(`Adding shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
    const log = new AnsiLogger({ logName: deviceId, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.log.logLevel });
    let device = await ShellyDevice.create(this.shelly, log, host);
    if (device) {
      await device.saveDevicePayloads(path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly'));
    } else {
      // this.log.warn(`Failed to create Shelly device ${hk}${deviceId}${wr} host ${zb}${host}${wr}`);
      const fileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${deviceId}.json`);
      device = await ShellyDevice.create(this.shelly, log, fileName);
      if (!device) return;
      this.log.warn(`Loaded from cache Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
      device.host = host;
      device.cached = true;
      device.online = false;
    }
    log.logName = device.name ?? device.id;
    await this.shelly.addDevice(device);
    this.shellyDevices.set(device.id, device);
  }

  // TODO remove and use matterbridge method
  isValidIpv4Address(ipv4Address: string): boolean {
    const ipv4Regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ipv4Address);
  }

  // TODO remove and use matterbridge method
  protected configureColorControlCluster(endpoint: Endpoint, hueSaturation: boolean, xy: boolean, colorTemperature: boolean, colorMode?: number) {
    endpoint.getClusterServer(ColorControlCluster)?.setFeatureMapAttribute({ hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature });
    endpoint.getClusterServer(ColorControlCluster)?.setColorCapabilitiesAttribute({ hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature });
    if (colorMode !== undefined && colorMode >= 0 && colorMode <= 2) {
      endpoint.getClusterServer(ColorControlCluster)?.setColorModeAttribute(colorMode);
      endpoint.getClusterServer(ColorControlCluster)?.setEnhancedColorModeAttribute(colorMode);
    }
  }

  // TODO remove and use matterbridge method
  protected configureColorControlMode(endpoint: Endpoint, colorMode?: number) {
    if (colorMode !== undefined && colorMode >= 0 && colorMode <= 2) {
      endpoint.getClusterServer(ColorControlCluster)?.setColorModeAttribute(colorMode);
      endpoint.getClusterServer(ColorControlCluster)?.setEnhancedColorModeAttribute(colorMode);
    }
  }

  // TODO remove and use matterbridge method
  protected triggerSwitchEvent(endpoint: Endpoint, event: string) {
    if (['Single', 'Double', 'Long'].includes(event)) {
      const cluster = endpoint.getClusterServer(
        SwitchCluster.with(
          Switch.Feature.MomentarySwitch,
          Switch.Feature.MomentarySwitchRelease,
          Switch.Feature.MomentarySwitchLongPress,
          Switch.Feature.MomentarySwitchMultiPress,
        ),
      );
      if (!cluster || !cluster.getFeatureMapAttribute().momentarySwitch) {
        this.log.error(`triggerSwitchEvent ${event} error: Switch cluster with MomentarySwitch not found on endpoint ${endpoint.name}:${endpoint.number}`);
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
    if (['Press', 'Release'].includes(event)) {
      const cluster = endpoint.getClusterServer(Switch.Complete);
      if (!cluster || !cluster.getFeatureMapAttribute().latchingSwitch) {
        this.log.error(`triggerSwitchEvent ${event} error: Switch cluster with LatchingSwitch not found on endpoint ${endpoint.name}:${endpoint.number}`);
        return;
      }
      if (event === 'Press') {
        cluster.setCurrentPositionAttribute(1);
        if (cluster.triggerSwitchLatchedEvent) cluster.triggerSwitchLatchedEvent({ newPosition: 1 });
        this.log.debug(`Trigger ${event} event for ${endpoint.name}:${endpoint.number}`);
      }
      if (event === 'Release') {
        cluster.setCurrentPositionAttribute(0);
        if (cluster.triggerSwitchLatchedEvent) cluster.triggerSwitchLatchedEvent({ newPosition: 0 });
        this.log.debug(`Trigger ${event} event for ${endpoint.name}:${endpoint.number}`);
      }
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
    const lightComponent = shellyDevice?.getComponent(componentName) as ShellyLightComponent;
    if (!lightComponent) {
      shellyDevice.log.error(`shellyCommandHandler error: component ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
      return false;
    }
    // Send On() Off() Toggle() command
    if (command === 'On') lightComponent.On();
    else if (command === 'Off') lightComponent.Off();
    else if (command === 'Toggle') lightComponent.Toggle();
    if (command === 'On' || command === 'Off' || command === 'Toggle')
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:${command}() for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);

    // Send Level() command
    if (command === 'Level' && level !== null && level !== undefined) {
      const shellyLevel = Math.max(Math.min(Math.round((level / 254) * 100), 100), 1);
      lightComponent?.Level(shellyLevel);
      shellyDevice.log.info(`Command ${hk}${componentName}${nf}:Level(${YELLOW}${shellyLevel}${nf}) for shelly device ${idn}${shellyDevice?.id}${rs}${nf}`);
    }

    // Send ColorRGB() command
    if (command === 'ColorRGB' && color !== undefined) {
      color.r = Math.max(Math.min(color.r, 255), 0);
      color.g = Math.max(Math.min(color.g, 255), 0);
      color.b = Math.max(Math.min(color.b, 255), 0);
      lightComponent?.ColorRGB(color.r, color.g, color.b);
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
    const shellyComponent = shellyDevice.getComponent(component);
    if (!shellyComponent) return;
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ` +
        `${hk}${shellyComponent.name}${db}:${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    // Update state
    if (
      (shellyComponent.name === 'Light' || shellyComponent.name === 'Rgb' || shellyComponent.name === 'Relay' || shellyComponent.name === 'Switch') &&
      property === 'state' &&
      typeof value === 'boolean'
    ) {
      endpoint.getClusterServer(OnOffCluster)?.setOnOffAttribute(value as boolean);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}OnOff-onOff${db} ${YELLOW}${value}${db}`);
    }
    // Update brightness
    if ((shellyComponent.name === 'Light' || shellyComponent.name === 'Rgb') && property === 'brightness' && typeof value === 'number') {
      const matterLevel = Math.max(Math.min(Math.round(((value as number) / 100) * 255), 255), 0);
      endpoint.getClusterServer(LevelControlCluster)?.setCurrentLevelAttribute(matterLevel);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}LevelControl-currentLevel${db} ${YELLOW}${matterLevel}${db}`);
    }
    // Update color gen 1
    if (shellyComponent.name === 'Light' && ['red', 'green', 'blue'].includes(property) && typeof value === 'number') {
      const red = property === 'red' ? (value as number) : (shellyComponent.getValue('red') as number);
      const green = property === 'green' ? (value as number) : (shellyComponent.getValue('green') as number);
      const blue = property === 'blue' ? (value as number) : (shellyComponent.getValue('blue') as number);
      const cluster = endpoint.getClusterServer(ColorControl.Complete);
      const hsl = rgbColorToHslColor({ r: red, g: green, b: blue });
      this.log.debug(`Color: R:${red} G:${green} B:${blue} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
      if (shellyDevice.colorUpdateTimeout) clearTimeout(shellyDevice.colorUpdateTimeout);
      shellyDevice.colorUpdateTimeout = setTimeout(() => {
        const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
        const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
        if (typeof hue === 'number') cluster?.setCurrentHueAttribute(hue);
        if (typeof saturation === 'number') cluster?.setCurrentSaturationAttribute(saturation);
        cluster?.setColorModeAttribute(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
        shellyDevice.log.info(
          `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}ColorControl.currentHue:${YELLOW}${hue}${db} ${hk}ColorControl.currentSaturation:${YELLOW}${saturation}${db}`,
        );
      }, 200);
    }
    // Update color gen 2/3
    if ((shellyComponent.name === 'Light' || shellyComponent.name === 'Rgb') && property === 'rgb' && value && Array.isArray(value)) {
      const cluster = endpoint.getClusterServer(ColorControl.Complete);
      const hsl = rgbColorToHslColor({ r: value[0], g: value[1], b: value[2] });
      this.log.debug(`RgbColorToHslColor: R:${value[0]} G:${value[1]} B:${value[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
      const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
      const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
      if (typeof hue === 'number') cluster?.setCurrentHueAttribute(hue);
      if (typeof saturation === 'number') cluster?.setCurrentSaturationAttribute(saturation);
      cluster?.setColorModeAttribute(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
      shellyDevice.log.info(
        `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}ColorControl.currentHue:${YELLOW}${hue}${db} ${hk}ColorControl.currentSaturation:${YELLOW}${saturation}${db}`,
      );
    }
    // Update state for Input
    if (shellyComponent.name === 'Input' && property === 'state' && typeof value === 'boolean') {
      if (this.config.exposeInput === 'contact') {
        endpoint.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(value as boolean);
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}BooleanState-stateValue${db} ${YELLOW}${value}${db}`);
      }
      if (this.config.exposeInput === 'momentary') {
        if ((value as boolean) === true) {
          this.triggerSwitchEvent(endpoint, 'Single');
          shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-currentPosition${db} ${YELLOW}${(value as boolean) ? 1 : 0}${db}`);
        }
      }
      if (this.config.exposeInput === 'latching') {
        this.triggerSwitchEvent(endpoint, (value as boolean) ? 'Press' : 'Release');
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-currentPosition${db} ${YELLOW}${(value as boolean) ? 1 : 0}${db}`);
      }
    }
    // Update event for Input
    if (shellyComponent.name === 'Input' && property === 'event_cnt' && typeof value === 'number') {
      const event = shellyComponent.getValue('event');
      if (!event) return;
      if (event === 'S') {
        this.triggerSwitchEvent(endpoint, 'Single');
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-triggerSwitchEvent${db} ${YELLOW}Single${db}`);
      }
      if (event === 'SS') {
        this.triggerSwitchEvent(endpoint, 'Double');
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-triggerSwitchEvent${db} ${YELLOW}Double${db}`);
      }
      if (event === 'L') {
        this.triggerSwitchEvent(endpoint, 'Long');
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-triggerSwitchEvent${db} ${YELLOW}Long${db}`);
      }
    }
    // Update for Battery
    if (shellyComponent.name === 'Battery' && property === 'level' && typeof value === 'number') {
      endpoint.getClusterServer(PowerSource.Complete)?.setBatPercentRemainingAttribute(Math.min(Math.max(value * 2, 0), 200));
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}PowerSource-batPercentRemaining${db} ${YELLOW}${value}${db}`);
    }
    if (shellyComponent.name === 'Battery' && property === 'voltage' && typeof value === 'number') {
      endpoint.getClusterServer(PowerSource.Complete)?.setBatVoltageAttribute(value / 1000);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}PowerSource-batVoltage${db} ${YELLOW}${value}${db}`);
    }
    if (shellyComponent.name === 'Battery' && property === 'charging' && typeof value === 'boolean') {
      endpoint.getClusterServer(PowerSource.Complete)?.setBatChargeStateAttribute(value ? PowerSource.BatChargeState.IsCharging : PowerSource.BatChargeState.IsNotCharging);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}PowerSource-batVoltage${db} ${YELLOW}${value}${db}`);
    }
    // Update for Motion
    if (shellyComponent.name === 'Sensor' && property === 'motion' && typeof value === 'boolean') {
      endpoint.getClusterServer(OccupancySensingCluster)?.setOccupancyAttribute({ occupied: value });
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}OccupancySensing-occupancy${db} ${YELLOW}${value}${db}`);
    }
    // Update for Contact
    if (shellyComponent.name === 'Sensor' && property === 'contact_open' && typeof value === 'boolean') {
      endpoint.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(!value);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}BooleanStateCluster-stateValue${db} ${YELLOW}${!value}${db}`);
    }
    // Update for Flood
    if (shellyComponent.name === 'Flood' && property === 'flood' && typeof value === 'boolean') {
      endpoint.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(!value);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}BooleanStateCluster-stateValue${db} ${YELLOW}${value}${db}`);
    }
    // Update for Illuminance
    if (shellyComponent.name === 'Lux' && property === 'value' && typeof value === 'number') {
      const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
      endpoint.getClusterServer(IlluminanceMeasurementCluster)?.setMeasuredValueAttribute(matterLux);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}IlluminanceMeasurement-measuredValue${db} ${YELLOW}${matterLux}${db}`);
    }
    // Update for Temperature
    if (shellyComponent.name === 'Temperature' && property === 'value' && typeof value === 'number') {
      const matterTemp = Math.min(Math.max(Math.round(value * 100), -10000), 10000);
      endpoint.getClusterServer(TemperatureMeasurementCluster)?.setMeasuredValueAttribute(matterTemp);
      shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}TemperatureMeasurement-measuredValue${db} ${YELLOW}${matterTemp / 100}${db}`);
    }
    // Update for vibration
    if (shellyComponent.name === 'Vibration' && property === 'vibration' && typeof value === 'boolean') {
      if (value) {
        this.triggerSwitchEvent(endpoint, 'Single');
        shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}Switch-triggerSwitchEvent${db} ${YELLOW}Single${db}`);
      }
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
      if (['state', 'current_pos', 'target_pos'].includes(property)) {
        const current = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
        const target = windowCoveringCluster.getTargetPositionLiftPercent100thsAttribute();
        const status = windowCoveringCluster.getOperationalStatusAttribute();
        const statusLookup = ['stopped', 'opening', 'closing', 'unknown'];
        shellyDevice.log.info(
          `${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}WindowCovering${db} current:${YELLOW}${current}${db} target:${YELLOW}${target}${db} status:${YELLOW}${statusLookup[status.global ?? 3]}${rs}`,
        );
      }
    }
    // Update energy from main components (gen 2 devices send power total inside the component not with meter)
    if (
      this.config.exposePowerMeter === 'evehistory' &&
      (shellyComponent.name === 'Light' ||
        shellyComponent.name === 'Relay' ||
        shellyComponent.name === 'Switch' ||
        shellyComponent.name === 'Cover' ||
        shellyComponent.name === 'Roller' ||
        shellyComponent.name === 'PowerMeter')
    ) {
      if ((property === 'power' || property === 'apower' || property === 'act_power') && isValid(value, 'number')) {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setConsumptionAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-consumption${db} ${YELLOW}${value}${db}`);
        if (property === 'act_power') return; // Skip the rest for PRO devices
        if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
        // Calculate current from power and voltage
        const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
        if (voltage) {
          let current = (value as number) / voltage;
          current = Math.round(current * 10000) / 10000;
          cluster?.setCurrentAttribute(current);
          if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-current${db} ${YELLOW}${current}${db}`);
        }
      }
      if (property === 'total' && isValid(value, 'number')) {
        let energy = (value as number) / 1000; // convert to kWh
        energy = Math.round(energy * 10000) / 10000;
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute(energy);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${energy}${db}`);
      }
      if (property === 'aenergy' && isValid(value, 'object')) {
        let energy = ((value as ShellyData).total as number) / 1000; // convert to kWh
        energy = Math.round(energy * 10000) / 10000;
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setTotalConsumptionAttribute(energy); // convert to kWh
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-totalConsumption${db} ${YELLOW}${energy}${db}`);
      }
      if (property === 'voltage' && isValid(value, 'number')) {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setVoltageAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-voltage${db} ${YELLOW}${value}${db}`);
      }
      if (property === 'current' && isValid(value, 'number')) {
        const cluster = endpoint.getClusterServer(EveHistoryCluster.with(EveHistory.Feature.EveEnergy));
        cluster?.setCurrentAttribute(value as number);
        if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-current${db} ${YELLOW}${value}${db}`);
        if (shellyComponent.hasProperty('act_power')) return; // Skip the rest for PRO devices
        if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
        // Calculate power from current and voltage
        const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
        if (voltage) {
          const power = (value as number) * voltage;
          cluster?.setConsumptionAttribute(power);
          if (cluster) shellyDevice.log.info(`${db}Update endpoint ${or}${endpoint.number}${db} attribute ${hk}EveHistory-consumption${db} ${YELLOW}${power}${db}`);
        }
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
