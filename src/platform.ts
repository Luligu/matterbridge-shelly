/**
 * This file contains the class ShellyPlatform.
 *
 * @file src\platform.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 2.0.4
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// Matterbridge imports
import {
  Matterbridge,
  MatterbridgeDynamicPlatform,
  PlatformConfig,
  onOffSwitch,
  powerSource,
  bridgedNode,
  electricalSensor,
  DeviceTypeDefinition,
  onOffLight,
  onOffOutlet,
  thermostatDevice,
  modeSelect,
  coverDevice,
  genericSwitch,
  contactSensor,
  lightSensor,
  occupancySensor,
  temperatureSensor,
  humiditySensor,
  dimmableLight,
  colorTemperatureLight,
  MatterbridgeEndpoint,
  waterLeakDetector,
  smokeCoAlarm,
} from 'matterbridge';
import {
  hslColorToRgbColor,
  rgbColorToHslColor,
  isValidIpv4Address,
  isValidString,
  isValidNumber,
  isValidBoolean,
  isValidArray,
  isValidObject,
  waiter,
  xyColorToRgbColor,
  miredToKelvin,
  kelvinToRGB,
} from 'matterbridge/utils';

// Logger imports
import { AnsiLogger, CYAN, GREEN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, nt, rs, wr, zb } from 'matterbridge/logger';

// Storage imports
import { NodeStorage, NodeStorageManager } from 'matterbridge/storage';

// @matter imports
import { AtLeastOne, NumberTag } from 'matterbridge/matter';
import { VendorId, Semtag } from 'matterbridge/matter/types';
import {
  BridgedDeviceBasicInformation,
  OnOff,
  PowerSource,
  WindowCovering,
  ColorControl,
  LevelControl,
  BooleanState,
  OccupancySensing,
  IlluminanceMeasurement,
  TemperatureMeasurement,
  RelativeHumidityMeasurement,
  ElectricalPowerMeasurement,
  ElectricalEnergyMeasurement,
  Thermostat,
  Switch,
  ModeSelect,
  SmokeCoAlarm,
} from 'matterbridge/matter/clusters';

// Node.js imports
import path from 'node:path';
import * as fs from 'node:fs';
import os from 'node:os';

// Shelly imports
import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyDevice } from './shellyDevice.js';
import { isCoverComponent, isLightComponent, isSwitchComponent, ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyDataType, ShellyDeviceId, ShellyEvent } from './shellyTypes.js';
import { shellyCoverCommandHandler, shellyIdentifyCommandHandler, shellyLightCommandHandler, shellySwitchCommandHandler } from './platformCommandHadlers.js';
import { shellyUpdateHandler } from './platformUpdateHandler.js';

export interface ShellyPlatformConfig {
  name: string;
  type: string;
  version: string;
  username: string;
  password: string;
  switchList: string[];
  lightList: string[];
  inputContactList: string[];
  inputMomentaryList: string[];
  inputLatchingList: string[];
  blackList: string[];
  whiteList: string[];
  entityBlackList: string[];
  deviceEntityBlackList: Record<string, string[]>;
  nocacheList: string[];
  enableMdnsDiscover: boolean;
  enableStorageDiscover: boolean;
  resetStorageDiscover: boolean;
  enableBleDiscover: boolean;
  failsafeCount: number;
  postfix: string;
  expertMode: boolean;
  firstRun?: boolean;
  debug: boolean;
  debugMdns: boolean;
  debugCoap: boolean;
  debugWs: boolean;
  unregisterOnShutdown: boolean;
}

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  public discoveredDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public storedDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public changedDevices = new Map<ShellyDeviceId, ShellyDeviceId>();
  public gatewayDevices = new Map<ShellyDeviceId, ShellyDeviceId>();
  public bridgedDevices = new Map<ShellyDeviceId, MatterbridgeEndpoint>();
  public bluBridgedDevices = new Map<string, MatterbridgeEndpoint>();

  // NodeStorageManager
  private nodeStorageManager?: NodeStorageManager;
  private nodeStorage?: NodeStorage;

  // Shelly
  private shelly: Shelly;

  // Config
  private username = '';
  private password = '';
  private postfix;
  private failsafeCount;
  private firstRun = false;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: ShellyPlatformConfig) {
    super(matterbridge, log, config as unknown as PlatformConfig);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('2.2.5')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "2.2.5". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend."`,
      );
    }

    // Validate the config
    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    this.postfix = (config.postfix as string) ?? '';
    if (!isValidString(this.postfix, 0, 3)) this.postfix = '';
    this.failsafeCount = (config.failsafeCount as number) ?? 0;
    if (!isValidNumber(this.failsafeCount, 0)) this.failsafeCount = 0;

    // Cleanup the old config format
    {
      const config = this.config as PlatformConfig;
      if (config.exposeSwitch !== undefined) delete config.exposeSwitch;
      if (config.outletList !== undefined) delete config.outletList;
      if (config.exposeInput !== undefined) delete config.exposeInput;
      if (config.exposeInputEvent !== undefined) delete config.exposeInputEvent;
      if (config.inputEventList !== undefined) {
        if (isValidArray(config.inputEventList, 1)) config.inputMomentaryList = config.inputEventList;
        delete config.inputEventList;
      }
      if (config.exposePowerMeter !== undefined) delete config.exposePowerMeter;
      if (config.enableConfigDiscover !== undefined) delete config.enableConfigDiscover;
      if (config.deviceIp !== undefined) delete config.deviceIp;
    }

    // First config setup
    if (config.firstRun === undefined) {
      config.firstRun = true;
      this.firstRun = true;
      if (!isValidArray(config.whiteList, 1) && !isValidArray(config.blackList, 1) && !isValidArray(config.entityBlackList, 1) && !isValidObject(config.deviceEntityBlackList, 1))
        config.expertMode = false;
      else config.expertMode = true;
      // If not already set by the user
      if (!isValidArray(config.entityBlackList, 1)) config.entityBlackList = ['Lux', 'Illuminance', 'Vibration', 'Button'];
    }
    // Expert mode setup
    if (config.expertMode === false) {
      const shelly = matterbridge.plugins.get('matterbridge-shelly');
      if (shelly && shelly.schemaJson && isValidObject(shelly.schemaJson.properties, 1)) {
        const properties = shelly.schemaJson.properties as Record<string, object>;
        delete properties.switchList;
        delete properties.lightList;
        delete properties.inputContactList;
        delete properties.inputLatchingList;
        delete properties.inputMomentaryList;
        delete properties.inputLatchingList;
        delete properties.addDevice;
        delete properties.removeDevice;
        delete properties.scanNetwork;
        delete properties.entityBlackList;
        delete properties.deviceEntityBlackList;
        delete properties.nocacheList;
        delete properties.deviceIp;
        delete properties.enableMdnsDiscover;
        delete properties.enableStorageDiscover;
        delete properties.resetStorageDiscover;
        delete properties.enableConfigDiscover;
        delete properties.enableBleDiscover;
        delete properties.failsafeCount;
        delete properties.postfix;
        delete properties.debug;
        delete properties.debugMdns;
        delete properties.debugCoap;
        delete properties.debugWs;
        delete properties.unregisterOnShutdown;
      }
    }

    log.debug(`Initializing platform: ${idn}${config.name}${rs}${db} v.${CYAN}${config.version}`);
    log.debug(`- username: ${CYAN}${config.username ? '********' : 'undefined'}`);
    log.debug(`- password: ${CYAN}${config.password ? '********' : 'undefined'}`);
    log.debug(`- mdnsDiscover: ${CYAN}${config.enableMdnsDiscover}`);
    log.debug(`- storageDiscover: ${CYAN}${config.enableStorageDiscover}`);
    log.debug(`- bleDiscover: ${CYAN}${config.enableBleDiscover}`);
    log.debug(`- resetStorage: ${CYAN}${config.resetStorageDiscover}`);
    log.debug(`- postfix: ${CYAN}${config.postfix}`);
    log.debug(`- failsafeCount: ${CYAN}${config.failsafeCount}`);
    log.debug(`- expertMode: ${CYAN}${config.expertMode}`);
    log.debug(`- debug: ${CYAN}${config.debug}`);
    log.debug(`- debugMdns: ${CYAN}${config.debugMdns}`);
    log.debug(`- debugCoap: ${CYAN}${config.debugCoap}`);
    log.debug(`- debugWs: ${CYAN}${config.debugWs}`);
    log.debug(`- unregisterOnShutdown: ${CYAN}${config.unregisterOnShutdown}`);

    // Set the entity selection map for the device selection in the frontend
    const entities = [
      { name: 'Relay', description: 'Output component of switches gen 1', icon: 'component' },
      { name: 'Switch', description: 'Output component of switches gen 2+', icon: 'component' },
      { name: 'Light', description: 'Output component of lights', icon: 'component' },
      { name: 'Rgb', description: 'Output component of lights gen 2+', icon: 'component' },
      { name: 'Input', description: 'Input component of WiFi devices', icon: 'component' },
      { name: 'Roller', description: 'Window covering component of switches gen 1', icon: 'component' },
      { name: 'Cover', description: 'Window covering component of switches gen 2+', icon: 'component' },
      { name: 'PowerMeter', description: 'Electrical measurements component', icon: 'component' },
      { name: 'Button', description: 'Button component of BLU devices', icon: 'component' },
      { name: 'Temperature', description: 'Temperature component', icon: 'component' },
      { name: 'Humidity', description: 'Humidity component', icon: 'component' },
      { name: 'Flood', description: 'Flood component of flood sensors', icon: 'component' },
      { name: 'Motion', description: 'Motion component of motion sensors', icon: 'component' },
      { name: 'Lux', description: 'Illuminance component of illuminance sensors gen 1', icon: 'component' },
      { name: 'Illuminance', description: 'Illuminance component of illuminance sensors BLU and gen 2+', icon: 'component' },
      { name: 'Contact', description: 'Contact component', icon: 'component' },
      { name: 'Vibration', description: 'Vibration component of vibration sensors', icon: 'component' },
      { name: 'Battery', description: 'Battery component of battery powered devices gen 1', icon: 'component' },
      { name: 'Devicepower', description: 'Battery component of battery powered devices gen 2+', icon: 'component' },
      { name: 'PowerSource', description: 'Matter component to select wired or battery powered devices', icon: 'matter' },
    ];
    for (const entity of entities) {
      this.setSelectEntity(entity.name, entity.description, entity.icon);
    }

    this.shelly = new Shelly(log, this.username, this.password);
    this.shelly.setLogLevel(log.logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean, this.config.debugWs as boolean);
    this.shelly.dataPath = path.join(matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly');
    this.shelly.interfaceName = matterbridge.mdnsInterface;
    this.shelly.ipv4Address = matterbridge.systemInformation.ipv4Address;
    this.shelly.ipv6Address = matterbridge.systemInformation.ipv6Address;
    // Log network interfaces
    const networkInterfaces = os.networkInterfaces();
    const availableAddresses = Object.entries(networkInterfaces);
    for (const [ifaceName, ifaces] of availableAddresses) {
      if (ifaces && ifaces.length > 0) {
        this.log.debug(`Network interface: ${CYAN}${ifaceName}${db}:`);
        ifaces.forEach((iface) => {
          this.log.debug(
            `- ${CYAN}${iface.family}${db} address ${CYAN}${iface.address}${db} netmask ${CYAN}${iface.netmask}${db} mac ${CYAN}${iface.mac}${db} scopeid ${CYAN}${iface.scopeid}${db} ${iface.internal ? 'internal' : 'external'}`,
          );
        });
      }
    }
    this.log.debug(
      `Shelly platform v.${CYAN}${this.config.version}${db} interface ${CYAN}${this.shelly.interfaceName}${db} ipv4 ${CYAN}${this.shelly.ipv4Address}${db} ipv6 ${CYAN}${this.shelly.ipv6Address}${db}`,
    );

    // handle Shelly discovered event (called from mDNS scanner)
    this.shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
      if (discoveredDevice.port === 9000) {
        this.log.warn(
          `Shelly device ${hk}${discoveredDevice.id}${wr} host ${zb}${discoveredDevice.host}${wr} has been discovered on port ${discoveredDevice.port}. Unofficial Shelly firmware are not supported.`,
        );
        return;
      }
      if (discoveredDevice.id.startsWith('shellyspot2') || discoveredDevice.id.startsWith('shellypresence') || discoveredDevice.id.startsWith('shellysense')) {
        this.log.info(`Shelly device ${hk}${discoveredDevice.id}${wr} host ${zb}${discoveredDevice.host}${wr} is not supported.`);
        return;
      }
      if (this.discoveredDevices.has(discoveredDevice.id)) {
        const stored = this.storedDevices.get(discoveredDevice.id);
        if (stored?.host !== discoveredDevice.host) {
          this.log.warn(`Shelly device ${hk}${discoveredDevice.id}${wr} host ${zb}${discoveredDevice.host}${wr} has been discovered with a different host.`);
          this.log.warn(`Setting the new address for shelly device ${hk}${discoveredDevice.id}${wr} from ${zb}${stored?.host}${wr} to ${zb}${discoveredDevice.host}${wr}...`);
          this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
          this.storedDevices.set(discoveredDevice.id, discoveredDevice);
          this.changedDevices.set(discoveredDevice.id, discoveredDevice.id);
          await this.saveStoredDevices();
          if (this.bridgedDevices.has(discoveredDevice.id)) {
            const bridgedDevice = this.bridgedDevices.get(discoveredDevice.id) as MatterbridgeEndpoint;
            bridgedDevice.configUrl = 'http://' + discoveredDevice.host;
          }
          if (this.shelly.hasDevice(discoveredDevice.id)) {
            const device = this.shelly.getDevice(discoveredDevice.id) as ShellyDevice;
            device.host = discoveredDevice.host;
            if (device.gen === 1) {
              this.shelly.coapServer.registerDevice(device.host, device.id, true); // No await do it in the background
            } else {
              device.wsClient?.stop();
              device.wsClient?.setHost(device.host);
              device.wsClient?.start();
            }
            device.log.warn(`Shelly device ${hk}${discoveredDevice.id}${wr} host ${zb}${discoveredDevice.host}${wr} updated`);
          } else {
            await this.addDevice(discoveredDevice.id, discoveredDevice.host);
          }
        } else {
          this.log.info(`Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} already discovered`);
        }
      } else {
        this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
        this.storedDevices.set(discoveredDevice.id, discoveredDevice);
        await this.saveStoredDevices();
        if (discoveredDevice.gen === 1) this.shelly.coapServer.registerDevice(discoveredDevice.host, discoveredDevice.id, false); // No await do it in the background
        await this.addDevice(discoveredDevice.id, discoveredDevice.host);
      }
      // Mark the device as seen
      if (this.shelly.hasDevice(discoveredDevice.id)) {
        const device = this.shelly.getDevice(discoveredDevice.id);
        if (device) device.lastseen = Date.now();
      }
      // On the first run or after if expertMode is false, add the devices with only inputs to the inputMomentaryList
      if (
        (this.firstRun === true || config.expertMode === false) &&
        (discoveredDevice.id.includes('shellybutton1') ||
          discoveredDevice.id.includes('shellyix3') ||
          discoveredDevice.id.includes('shellyplusi4') ||
          discoveredDevice.id.includes('shellyi4g3'))
      ) {
        if (!config.inputMomentaryList) config.inputMomentaryList = [];
        if (!config.inputMomentaryList.includes(discoveredDevice.id)) {
          config.inputMomentaryList.push(discoveredDevice.id);
          this.log.info(`Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} added to inputMomentaryList`);
        }
        const shelly = this.matterbridge.plugins.get('matterbridge-shelly');
        if (shelly) this.matterbridge.plugins.saveConfigFromJson(shelly, this.config);
      }
      /*
      // On the first run or after if expertMode is false, add the trv gateway devices to the nocacheList
      if ((this.firstRun === true || config.expertMode === false) && discoveredDevice.id.includes('shellyblugwg3')) {
        if (!config.nocacheList) config.nocacheList = [];
        if (!config.nocacheList.includes(discoveredDevice.id)) {
          config.nocacheList.push(discoveredDevice.id);
          this.log.info(`Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} added to nocacheList`);
        }
        const shelly = this.matterbridge.plugins.get('matterbridge-shelly');
        if (shelly) this.matterbridge.plugins.saveConfigFromJson(shelly, this.config);
      }
      */
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

      // Validate the device data
      if (
        !isValidString(device.name, 1) ||
        !isValidString(device.id, 1) ||
        !isValidString(device.host, 1) ||
        !isValidNumber(device.gen, 1, 4) ||
        !isValidString(device.mac, 1) ||
        !isValidString(device.model, 1) ||
        !isValidString(device.firmware, 1) ||
        !isValidNumber(device.getComponentNames().length, 1)
      ) {
        this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} is not valid. Please put it in the blackList and open an issue.`);
        return;
      }

      // Scan the device for paired BLU devices
      if (config.enableBleDiscover === true) {
        if (device.bthomeDevices.size && device.bthomeSensors.size) {
          this.log.info(`Shelly device ${hk}${device.id}${nf} host ${zb}${device.host}${nf} is a ble gateway. Adding paired BLU devices...`);
          this.gatewayDevices.set(device.id, device.id);

          // Register the BLU devices
          for (const [, bthomeDevice] of device.bthomeDevices) {
            // Set the device in the selectDevice map for the frontend device selection
            this.setSelectDevice(bthomeDevice.addr, bthomeDevice.name, 'http://' + device.host, 'ble');
            if (!this.validateDevice([bthomeDevice.addr, bthomeDevice.name])) continue;
            await this.addBluDevice(device, bthomeDevice);
          }

          // BLU observer bthome device updates
          device.on('bthomedevice_update', (addr: string, rssi: number, packet_id: number, last_updated_ts: number) => {
            if (!isValidString(addr, 11) || !isValidNumber(rssi, -100, 0) || !isValidNumber(packet_id, 0) || !isValidNumber(last_updated_ts)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (bthomeDevice && !this.validateDevice([bthomeDevice.addr, bthomeDevice.name], false)) return;
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer device update message for BLU device ${idn}${blu.deviceName ?? addr}${rs}${db}: rssi ${YELLOW}${rssi}${db} packet_id ${YELLOW}${packet_id}${db} last_updated ${YELLOW}${device.getLocalTimeFromLastUpdated(last_updated_ts)}${db}`,
            );
          });

          // BLU observer bthome sensor updates
          device.on('bthomesensor_update', (addr: string, sensorName: string, sensorIndex: number, value: ShellyDataType) => {
            if (!isValidString(addr, 11) || !isValidString(sensorName, 6) || !isValidNumber(sensorIndex, 0, 3)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (bthomeDevice && !this.validateDevice([bthomeDevice.addr, bthomeDevice.name], false)) return;
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer sensor update message for BLU device ${idn}${blu.deviceName ?? addr}${rs}${db}: sensor ${YELLOW}${sensorName}${db} index ${YELLOW}${sensorIndex}${db} value ${YELLOW}${value}${db}`,
            );
            if (blu && sensorName === 'Battery' && isValidNumber(value, 0, 100)) {
              blu.setAttribute(PowerSource.Cluster.id, 'batPercentRemaining', value * 2, blu.log);
              if (value < 10) blu.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, blu.log);
              else if (value < 20) blu.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, blu.log);
              else blu.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, blu.log);
            }
            if (blu && sensorName === 'Temperature' && isValidNumber(value, -100, 100)) {
              if (bthomeDevice.model === 'Shelly BLU Trv' && sensorIndex === 0) blu.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', value * 100, blu.log);
              else if (bthomeDevice.model === 'Shelly BLU Trv' && sensorIndex === 1) blu.setAttribute(Thermostat.Cluster.id, 'localTemperature', value * 100, blu.log);
              else {
                const child = blu.getChildEndpointByName('Temperature');
                child?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', value * 100, blu.log);
              }
            }
            if (blu && sensorName === 'Humidity' && isValidNumber(value, 0, 100)) {
              const child = blu.getChildEndpointByName('Humidity');
              child?.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', value * 100, blu.log);
            }
            if (blu && sensorName === 'Illuminance' && isValidNumber(value, 0, 10000) && this.validateEntity(bthomeDevice.addr, 'Illuminance')) {
              const child = blu.getChildEndpointByName('Illuminance');
              const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
              child?.setAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue', matterLux, blu.log);
            }
            if (blu && sensorName === 'Motion' && isValidBoolean(value)) {
              const child = blu.getChildEndpointByName('Motion');
              child?.setAttribute(OccupancySensing.Cluster.id, 'occupancy', { occupied: value }, blu.log);
            }
            if (blu && sensorName === 'Contact' && isValidBoolean(value)) {
              const child = blu.getChildEndpointByName('Contact');
              child?.setAttribute(BooleanState.Cluster.id, 'stateValue', !value, blu.log);
            }
          });

          // BLU observer bthome events
          device.on('bthome_event', (event: ShellyEvent) => {
            if (!isValidObject(event)) return;
            device.log.info(`${idn}BLU${rs}${db} observer home event message: ${debugStringify(event)}${db}`);
            if (event.event === 'device_discovered') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} discovered a new BLU device`);
            }
            if (event.event === 'discovery_done') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} discovery done`);
            }
            if (event.event === 'associations_done') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} paired a new BLU device`);
            }
          });

          // BLU observer bthome device events
          device.on('bthomedevice_event', (addr: string, event: ShellyEvent) => {
            if (!isValidString(addr, 11) || !isValidObject(event, 3)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (bthomeDevice && !this.validateDevice([bthomeDevice.addr, bthomeDevice.name], false)) return;
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(`${idn}BLU${rs}${db} observer device event message for BLU device ${idn}${blu?.deviceName ?? addr}${rs}${db}: event ${debugStringify(event)}${db}`);
            if (event.event === 'ota_begin') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is starting OTA`);
            }
            if (event.event === 'ota_progress') {
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} OTA is progressing`);
            }
            if (event.event === 'ota_success') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} finished succesfully OTA`);
            }
            if (event.event === 'config_changed') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} changed BTHome device configuration`);
              device.fetchUpdate().then(() => {
                device.updateBTHomeComponents();
                device.saveDevicePayloads(this.shelly.dataPath);
              });
            }
          });

          // BLU observer bthome sensor events
          device.on('bthomesensor_event', (addr: string, sensorName: string, sensorIndex: number, event: ShellyEvent) => {
            if (!isValidString(addr, 11) || !isValidString(sensorName, 6) || !isValidNumber(sensorIndex, 0, 3) || !isValidObject(event, 3)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (bthomeDevice && !this.validateDevice([bthomeDevice.addr, bthomeDevice.name], false)) return;
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer sensor event message for BLU device ${idn}${blu?.deviceName ?? addr}${rs}${db}: sensor ${YELLOW}${sensorName}${db} index ${YELLOW}${sensorIndex}${db} event ${debugStringify(event)}${db}`,
            );
            let buttonEndpoint: MatterbridgeEndpoint | undefined;
            if (bthomeDevice.model === 'Shelly BLU RC Button 4') {
              buttonEndpoint = blu.getChildEndpointByName('Button' + sensorIndex);
            } else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') {
              buttonEndpoint = blu.getChildEndpointByName('Button' + sensorIndex);
            } else if (bthomeDevice.model === 'Shelly BLU Button1') {
              buttonEndpoint = blu;
            } else {
              buttonEndpoint = blu.getChildEndpointByName('Button');
            }
            if (!buttonEndpoint) {
              if (['Shelly BLU Button1', 'Shelly BLU RC Button 4', 'Shelly BLU Wall Switch 4'].includes(bthomeDevice.model))
                blu.log.warn(`Shelly device ${idn}${blu?.deviceName ?? addr}${rs}${wr} child endpoint for button not found`);
              return;
            }
            if (sensorName === 'Button' /* && isValidString(event, 9) && this.validateEntity(bthomeDevice.addr, 'Button')*/) {
              if (event.event === 'single_push') {
                buttonEndpoint?.triggerSwitchEvent('Single', blu.log);
              } else if (event.event === 'double_push') {
                buttonEndpoint?.triggerSwitchEvent('Double', blu.log);
              } else if (event.event === 'long_push') {
                buttonEndpoint?.triggerSwitchEvent('Long', blu.log);
              }
            }
          });
        } else {
          this.gatewayDevices.delete(device.id);
        }
      }

      // Validate the device again to check if the device is a BLU gateway that has been added only to discover BLU devices
      if (!this.validateDevice([device.id, device.mac, device.name])) return;

      // Create a new Matterbridge device
      const deviceTypes: AtLeastOne<DeviceTypeDefinition> = [bridgedNode];
      if (this.validateEntity(device.id, 'PowerSource')) deviceTypes.push(powerSource);
      const mbDevice = new MatterbridgeEndpoint(deviceTypes, { uniqueStorageKey: device.name }, config.debug as boolean);
      mbDevice.configUrl = `http://${device.host}`;
      mbDevice.log.logName = device.name;
      mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        device.name,
        device.id + (this.postfix ? '-' + this.postfix : ''),
        0xfff1,
        'Shelly',
        device.model,
        1, // Number(device.firmware.split('.')[0]),
        device.firmware,
      );
      // Set the device in the selectDevice map for the frontend device selection
      this.setSelectDevice(device.id, device.name, 'http://' + device.host, 'wifi', []); // We clear the entities!

      // Set the powerSource cluster
      if (this.validateEntity(device.id, 'PowerSource')) {
        const batteryComponent = device.getComponent('battery');
        const devicepowerComponent = device.getComponent('devicepower:0');
        if (batteryComponent) {
          let level = batteryComponent.hasProperty('level') ? batteryComponent.getValue('level') : undefined;
          level = isValidNumber(level, 0, 100) ? level : undefined;
          let status = PowerSource.BatChargeLevel.Ok;
          if (level && level < 10) status = PowerSource.BatChargeLevel.Critical;
          else if (level && level < 20) status = PowerSource.BatChargeLevel.Warning;
          let voltage = batteryComponent.hasProperty('voltage') ? batteryComponent.getValue('voltage') : undefined;
          voltage = isValidNumber(voltage, 0, 12) ? Math.round(voltage * 1000) : undefined;
          if (batteryComponent.hasProperty('charging')) {
            mbDevice.createDefaultPowerSourceRechargeableBatteryClusterServer(level, status, voltage);
          } else {
            mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer(level, status, voltage);
          }
          batteryComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
            shellyUpdateHandler(this, mbDevice, device, component, property, value, 'PowerSource');
          });
        } else if (devicepowerComponent) {
          if (devicepowerComponent.hasProperty('battery') && isValidObject(devicepowerComponent.getValue('battery'), 2)) {
            const battery = devicepowerComponent.getValue('battery') as { V: number; percent: number };
            if (isValidNumber(battery.V, 0, 12) && isValidNumber(battery.percent, 0, 100)) {
              mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer(
                battery.percent,
                battery.percent > 20 ? PowerSource.BatChargeLevel.Ok : PowerSource.BatChargeLevel.Critical,
                battery.V * 1000,
              );
            }
          }
          devicepowerComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
            shellyUpdateHandler(this, mbDevice, device, component, property, value, 'PowerSource');
          });
        } else {
          mbDevice.createDefaultPowerSourceWiredClusterServer();
        }
      }

      // Set the composed name at gui
      const names = device.getComponentNames();
      if (names.includes('Light') || names.includes('Rgb')) {
        mbDevice.addFixedLabel('composed', 'Light');
      } else if (names.includes('Switch') || names.includes('Relay')) {
        mbDevice.addFixedLabel('composed', 'Switch');
      } else if (names.includes('Cover') || names.includes('Roller')) {
        mbDevice.addFixedLabel('composed', 'Cover');
      } else if (names.includes('PowerMeter')) {
        mbDevice.addFixedLabel('composed', 'PowerMeter');
      } else if (names.includes('Input')) {
        mbDevice.addFixedLabel('composed', 'Input');
      } else if (names.includes('Blugw')) {
        mbDevice.addFixedLabel('composed', 'BLU Gateway');
      } else {
        mbDevice.addFixedLabel('composed', 'Sensor');
      }

      // Scan the device components
      for (const [key, component] of device) {
        // Set selectDevice entities for the device. The setSelectDevice has already been added in addDevice.
        if (!['ble', 'cloud', 'coiot', 'mqtt', 'sys', 'sntp', 'wifi_ap', 'wifi_sta', 'wifi_sta1', 'ws', 'eth'].includes(component.id)) {
          this.setSelectDeviceEntity(device.id, component.name, 'All the device ' + component.name + ' components', 'component');
          this.setSelectDeviceEntity(device.id, component.id, 'Device ' + component.id + ' component', 'component');
        }

        // Validate the component against the component black list
        if (!this.validateEntity(device.id, component.name)) continue;
        if (!this.validateEntity(device.id, key)) continue;

        if (component.name === 'Ble') {
          // Add event handler from Shelly
          component.on('event', (component: string, event: string, data: ShellyEvent) => {
            this.log.debug(`Received event ${CYAN}${event}${db} from component ${CYAN}${component}${db}: ${debugStringify(data)}`);
          });
        } else if (component.name === 'Sys') {
          // Add update handler from Shelly
          component.on('update', (component: string, property: string, value: ShellyDataType) => {
            device.log.debug(
              `Received update component ${CYAN}${component}${db} property ${CYAN}${property}${db}: ${isValidObject(value) || isValidArray(value) ? debugStringify(value) : value}`,
            );
            if (property === 'cfg_rev') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              if (!device.id.startsWith('shellyblugwg3')) {
                // Special case for BLU Gateway Gen 3 TRV that sends cfg_rev when the temperature is changed
                device.log.notice(
                  `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} sent config changed rev: ${CYAN}${value}${nt}`,
                );
                device.log.notice(`If the configuration on shelly device ${idn}${device.name}${rs}${nt} has changed, please restart matterbridge for the change to take effect.`);
              }
            }
          });
          // Add event handler from Shelly
          component.on('event', (component: string, event: string, data: ShellyEvent) => {
            device.log.debug(`Received event ${CYAN}${event}${db} from component ${CYAN}${component}${db}: ${debugStringify(data)}`);
            // component_added is triggered by a gateway when a component is added
            if (event === 'component_added') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(
                `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} added a component: ${CYAN}${data.target}${nt}.`,
              );
              device.log.notice(`Please restart matterbridge for the change to take effect.`);
              this.matterbridge.frontend.wssSendRestartRequired();
            }
            // component_removed is triggered by a gateway when a component is removed
            if (event === 'component_removed') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(
                `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} removed a component: ${CYAN}${data.target}${nt}.`,
              );
              device.log.notice(`Please restart matterbridge for the change to take effect.`);
              this.matterbridge.frontend.wssSendRestartRequired();
            }
            // scheduled_restart is for restart and for reset
            if (event === 'scheduled_restart') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(
                `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is restarting in ${CYAN}${data.time_ms}${nt} ms`,
              );
              device.log.notice(`If the configuration on shelly device ${idn}${device.name}${rs}${nt} has changed, please restart matterbridge for the change to take effect.`);
            }
            if (event === 'config_changed') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(
                `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} sent config changed rev: ${CYAN}${data.cfg_rev}${nt}`,
              );
              device.log.notice(`If the configuration on shelly device ${idn}${device.name}${rs}${nt} has changed, please restart matterbridge for the change to take effect.`);
            }
            if (event === 'ota_begin') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is starting OTA`);
            }
            if (event === 'ota_progress') {
              device.log.notice(
                `Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} OTA is progressing: ${CYAN}${data.progress_percent}${nt}%`,
              );
            }
            if (event === 'ota_success') {
              if (!device.sleepMode) this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} finished succesfully OTA`);
              device.log.notice(`The firmware on shelly device ${idn}${device.name}${rs}${nt} has changed, please restart matterbridge for the change to take effect.`);
            }
            if (event === 'sleep') {
              device.log.info(`Shelly device ${idn}${device.name}${rs}${nf} id ${hk}${device.id}${nf} host ${zb}${device.host}${nf} is sleeping`);
            }
          });
        } else if (isLightComponent(component)) {
          // Set the device type and clusters based on the light component properties
          let deviceType = onOffLight;
          if (component.hasProperty('brightness')) {
            deviceType = dimmableLight;
          }
          if (
            (component.hasProperty('red') && component.hasProperty('green') && component.hasProperty('blue') && device.profile !== 'white') ||
            (component.hasProperty('temp') && device.profile !== 'color') ||
            component.hasProperty('rgb')
          ) {
            deviceType = colorTemperatureLight;
          }
          const tagList = this.addTagList(component);
          const child = mbDevice.addChildDeviceType(
            key,
            this.hasElectricalMeasurements(device, component) ? [deviceType, electricalSensor] : [deviceType],
            tagList ? { tagList } : undefined,
            config.debug as boolean,
          );
          child.log.logName = `${device.name} ${key}`;
          child.createDefaultIdentifyClusterServer();
          child.createDefaultGroupsClusterServer();
          child.createDefaultOnOffClusterServer();
          if (deviceType.code === dimmableLight.code || deviceType.code === colorTemperatureLight.code) child.createDefaultLevelControlClusterServer();
          if (deviceType.code === colorTemperatureLight.code) {
            if (component.hasProperty('temp') && component.hasProperty('mode')) child.createHsColorControlClusterServer();
            else if (component.hasProperty('temp') && !component.hasProperty('mode')) child.createCtColorControlClusterServer();
            else child.createHsColorControlClusterServer();
          }

          // Add the electrical measurementa cluster on the same endpoint
          this.addElectricalMeasurements(mbDevice, child, device, component);

          // Add command handlers from Matter
          child.addCommandHandler('identify', async ({ request }) => {
            shellyIdentifyCommandHandler(child, component, request);
          });
          child.addCommandHandler('on', async () => {
            shellyLightCommandHandler(child, component, 'On');
          });
          child.addCommandHandler('off', async () => {
            shellyLightCommandHandler(child, component, 'Off');
          });
          child.addCommandHandler('toggle', async () => {
            shellyLightCommandHandler(child, component, 'Toggle');
          });
          child.addCommandHandler('moveToLevel', async ({ request }) => {
            shellyLightCommandHandler(child, component, 'Level', request.level);
          });
          child.addCommandHandler('moveToLevelWithOnOff', async ({ request }) => {
            shellyLightCommandHandler(child, component, 'Level', request.level);
          });
          child.addCommandHandler('moveToHue', async ({ request }) => {
            child.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, child.log);
            const saturation = child.getAttribute(ColorControl.Cluster.id, 'currentSaturation', child.log);
            const rgb = hslColorToRgbColor((request.hue / 254) * 360, (saturation / 254) * 100, 50);
            mbDevice.log.debug(`Sending command moveToHue => ColorRGB(${rgb.r},  ${rgb.g}, ${rgb.b})`);
            if (device.colorCommandTimeout) clearTimeout(device.colorCommandTimeout);
            device.colorCommandTimeout = setTimeout(() => {
              shellyLightCommandHandler(child, component, 'ColorRGB', undefined, { r: rgb.r, g: rgb.g, b: rgb.b });
            }, 500);
          });
          child.addCommandHandler('moveToSaturation', async ({ request }) => {
            child.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, child.log);
            const hue = child.getAttribute(ColorControl.Cluster.id, 'currentHue', child.log);
            const rgb = hslColorToRgbColor((hue / 254) * 360, (request.saturation / 254) * 100, 50);
            mbDevice.log.debug(`Sending command moveToSaturation => ColorRGB(${rgb.r},  ${rgb.g}, ${rgb.b})`);
            if (device.colorCommandTimeout) clearTimeout(device.colorCommandTimeout);
            device.colorCommandTimeout = setTimeout(() => {
              shellyLightCommandHandler(child, component, 'ColorRGB', undefined, { r: rgb.r, g: rgb.g, b: rgb.b });
            }, 500);
          });
          child.addCommandHandler('moveToHueAndSaturation', async ({ request }) => {
            child.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, child.log);
            const rgb = hslColorToRgbColor((request.hue / 254) * 360, (request.saturation / 254) * 100, 50);
            shellyLightCommandHandler(child, component, 'ColorRGB', undefined, { r: rgb.r, g: rgb.g, b: rgb.b });
          });
          child.addCommandHandler('moveToColor', async ({ request }) => {
            child.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentXAndCurrentY, child.log);
            const rgb = xyColorToRgbColor(request.colorX / 65536, request.colorY / 65536);
            shellyLightCommandHandler(child, component, 'ColorRGB', undefined, { r: rgb.r, g: rgb.g, b: rgb.b });
          });
          child.addCommandHandler('moveToColorTemperature', async ({ request }) => {
            child.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.ColorTemperatureMireds, child.log);
            if (component.hasProperty('temp')) {
              shellyLightCommandHandler(child, component, 'ColorTemp', undefined, undefined, request.colorTemperatureMireds);
            } else {
              const rgb = kelvinToRGB(miredToKelvin(request.colorTemperatureMireds));
              shellyLightCommandHandler(child, component, 'ColorRGB', undefined, { r: rgb.r, g: rgb.g, b: rgb.b });
            }
          });

          // Add event handler from Shelly
          component.on('update', (component: string, property: string, value: ShellyDataType) => {
            shellyUpdateHandler(this, mbDevice, device, component, property, value);
          });
        } else if (isSwitchComponent(component) && device.profile !== 'cover') {
          let deviceType = onOffOutlet;
          if (config.switchList && (config.switchList as string[]).includes(device.id)) deviceType = onOffSwitch;
          if (config.lightList && (config.lightList as string[]).includes(device.id)) deviceType = onOffLight;

          const tagList = this.addTagList(component);
          const child = mbDevice.addChildDeviceType(
            key,
            this.hasElectricalMeasurements(device, component) ? [deviceType, electricalSensor] : [deviceType],
            tagList ? { tagList } : undefined,
            config.debug as boolean,
          );
          child.log.logName = `${device.name} ${key}`;
          child.createDefaultIdentifyClusterServer();
          child.createDefaultGroupsClusterServer();
          child.createDefaultOnOffClusterServer();

          // Add the electrical measurementa cluster on the same endpoint
          this.addElectricalMeasurements(mbDevice, child, device, component);

          // Add command handlers
          child.addCommandHandler('identify', async ({ request }) => {
            shellyIdentifyCommandHandler(child, component, request);
          });
          child.addCommandHandler('on', async () => {
            shellySwitchCommandHandler(child, component, 'On');
          });
          child.addCommandHandler('off', async () => {
            shellySwitchCommandHandler(child, component, 'Off');
          });
          child.addCommandHandler('toggle', async () => {
            shellySwitchCommandHandler(child, component, 'Toggle');
          });

          // Add event handler
          component.on('update', (component: string, property: string, value: ShellyDataType) => {
            shellyUpdateHandler(this, mbDevice, device, component, property, value);
          });
        } else if (isCoverComponent(component) && device.profile !== 'switch') {
          const tagList = this.addTagList(component);
          const child = mbDevice.addChildDeviceType(
            key,
            this.hasElectricalMeasurements(device, component) ? [coverDevice, electricalSensor] : [coverDevice],
            tagList ? { tagList } : undefined,
            config.debug as boolean,
          );
          child.log.logName = `${device.name} ${key}`;
          child.createDefaultIdentifyClusterServer();
          child.createDefaultWindowCoveringClusterServer();

          // Add the electrical measurementa cluster on the same endpoint
          this.addElectricalMeasurements(mbDevice, child, device, component);

          // Add command handlers
          child.addCommandHandler('identify', async ({ request }) => {
            shellyIdentifyCommandHandler(child, component, request);
          });
          child.addCommandHandler('upOrOpen', async () => {
            child.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', 0, child.log);
            shellyCoverCommandHandler(child, component, 'Open', 0);
          });
          child.addCommandHandler('downOrClose', async () => {
            child.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', 10000, child.log);
            shellyCoverCommandHandler(child, component, 'Close', 10000);
          });
          child.addCommandHandler('stopMotion', async () => {
            shellyCoverCommandHandler(child, component, 'Stop');
          });
          child.addCommandHandler('goToLiftPercentage', async ({ request }) => {
            child.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', request.liftPercent100thsValue, child.log);
            if (request.liftPercent100thsValue === 0) shellyCoverCommandHandler(child, component, 'Open', 0);
            else if (request.liftPercent100thsValue === 10000) shellyCoverCommandHandler(child, component, 'Close', 10000);
            else shellyCoverCommandHandler(child, component, 'GoToPosition', request.liftPercent100thsValue);
          });
          // Add event handler
          component.on('update', (component: string, property: string, value: ShellyDataType) => {
            shellyUpdateHandler(this, mbDevice, device, component, property, value);
          });
        } else if (component.name === 'PowerMeter') {
          const pmComponent = device.getComponent(key);
          if (pmComponent) {
            const tagList = this.addTagList(component);
            // Add the Matter 1.3 electricalSensor device type with the ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters
            const child = mbDevice.addChildDeviceTypeWithClusterServer(
              key,
              [electricalSensor],
              [ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id],
              tagList ? { tagList } : undefined,
              config.debug as boolean,
            );
            child.log.logName = `${device.name} ${key}`;
            device.log.debug(
              `Added ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters to endpoint ${hk}${child.name}${db} component ${hk}${component.name}:${component.id}${db}`,
            );
            // Add event handler
            pmComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Input') {
          const tagList = this.addTagList(component);
          // Skip the input component if it is disabled in Gen 2/3 devices
          if (component.hasProperty('enable') && component.getValue('enable') === false) continue;
          if (component.hasProperty('state') && config.inputContactList && (config.inputContactList as string[]).includes(device.id)) {
            const state = component.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceType(key, [contactSensor], tagList ? { tagList } : undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              // Set the state attribute
              child.createDefaultBooleanStateClusterServer(state);
              child.addRequiredClusterServers();
              // Add event handler
              component.on('update', (component: string, property: string, value: ShellyDataType) => {
                shellyUpdateHandler(this, mbDevice, device, component, property, value);
              });
            }
          } else if (component?.hasProperty('state') && config.inputMomentaryList && (config.inputMomentaryList as string[]).includes(device.id)) {
            const state = component.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceType(key, [genericSwitch], tagList ? { tagList } : undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              child.createDefaultSwitchClusterServer();
              child.addRequiredClusterServers();
              // Add event handler
              component.on('update', (component: string, property: string, value: ShellyDataType) => {
                shellyUpdateHandler(this, mbDevice, device, component, property, value);
              });
            }
          } else if (component?.hasProperty('state') && config.inputLatchingList && (config.inputLatchingList as string[]).includes(device.id)) {
            const state = component.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceType(key, [genericSwitch], tagList ? { tagList } : undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              child.createDefaultLatchingSwitchClusterServer();
              child.addRequiredClusterServers();
              // Add event handler
              component.on('update', (component: string, property: string, value: ShellyDataType) => {
                shellyUpdateHandler(this, mbDevice, device, component, property, value);
              });
            }
          } else if (component?.hasProperty('event') && config.inputMomentaryList && (config.inputMomentaryList as string[]).includes(device.id)) {
            // Gen 1 devices input event
            const event = component.getValue('event') as boolean;
            if (isValidString(event)) {
              const child = mbDevice.addChildDeviceType(key, [genericSwitch], tagList ? { tagList } : undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              child.createDefaultSwitchClusterServer();
              child.addRequiredClusterServers();
              // Add event handler
              component.on('update', (component: string, property: string, value: ShellyDataType) => {
                shellyUpdateHandler(this, mbDevice, device, component, property, value);
              });
            }
          }
          if (
            component &&
            component.hasProperty('state') &&
            component.getValue('state') === null &&
            component.hasProperty('type') &&
            component.getValue('type') === 'button' &&
            config.inputMomentaryList &&
            (config.inputMomentaryList as string[]).includes(device.id)
          ) {
            // Gen 2/3 devices with Input type=button
            const child = mbDevice.addChildDeviceType(key, [genericSwitch], tagList ? { tagList } : undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultSwitchClusterServer();
            child.addRequiredClusterServers();
            component.on('event', (component: string, event: string) => {
              if (isValidString(component, 7) && isValidString(event, 9, 11) && device.getComponent(component)) {
                device.log.info(`${db}Shelly event ${hk}${component}${db}:${zb}${event}${db} for device ${idn}${device.id}${rs}${db}`);
                const endpoint = mbDevice.getChildEndpointByName(component);
                if (!endpoint) {
                  device.log.error(`getChildEndpointByName(${component}) for device ${idn}${device.id}${rs} failed`);
                  return;
                }
                if (event === 'single_push') endpoint.triggerSwitchEvent('Single', device.log);
                if (event === 'double_push') endpoint.triggerSwitchEvent('Double', device.log);
                if (event === 'long_push') endpoint.triggerSwitchEvent('Long', device.log);
              }
            });
          }
        } else if (component.name === 'Sensor') {
          const sensorComponent = device.getComponent(key);
          if (sensorComponent?.hasProperty('contact_open')) {
            const child = mbDevice.addChildDeviceType(key, [contactSensor], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultBooleanStateClusterServer(sensorComponent.getValue('contact_open') === false);
            child.addRequiredClusterServers();
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
          if (sensorComponent?.hasProperty('motion')) {
            const child = mbDevice.addChildDeviceType(key, [occupancySensor], undefined, config.debug as boolean);
            child.createDefaultOccupancySensingClusterServer(sensorComponent.getValue('motion') === true);
            child.addRequiredClusterServers();
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Vibration') {
          const vibrationComponent = device.getComponent(key);
          if (vibrationComponent?.hasProperty('vibration') && isValidBoolean(vibrationComponent.getValue('vibration'))) {
            const child = mbDevice.addChildDeviceType(key, [genericSwitch], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultSwitchClusterServer();
            child.addRequiredClusterServers();
            // Add event handler
            vibrationComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Temperature') {
          const tempComponent = device.getComponent(key);
          if (tempComponent?.hasProperty('value') && isValidNumber(tempComponent.getValue('value'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [temperatureSensor], [], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            const matterTemp = Math.min(Math.max(Math.round((tempComponent.getValue('value') as number) * 100), -10000), 10000);
            child.createDefaultTemperatureMeasurementClusterServer(matterTemp);
            // Add event handler
            tempComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          } else if (tempComponent?.hasProperty('tC') && isValidNumber(tempComponent.getValue('tC'), -100, 100)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [temperatureSensor], [], undefined, config.debug as boolean);
            const matterTemp = Math.min(Math.max(Math.round((tempComponent.getValue('tC') as number) * 100), -10000), 10000);
            child.createDefaultTemperatureMeasurementClusterServer(matterTemp);
            child.log.logName = `${device.name} ${key}`;
            // Add event handler
            tempComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Humidity') {
          const humidityComponent = device.getComponent(key);
          if (humidityComponent?.hasProperty('value') && isValidNumber(humidityComponent.getValue('value'), 0, 100)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [humiditySensor], [], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            const matterHumidity = Math.min(Math.max(Math.round((humidityComponent.getValue('value') as number) * 100), 0), 10000);
            child.createDefaultRelativeHumidityMeasurementClusterServer(matterHumidity);
            // Add event handler
            humidityComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
          if (humidityComponent?.hasProperty('rh') && isValidNumber(humidityComponent.getValue('rh'), 0, 100)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [humiditySensor], [], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            const matterHumidity = Math.min(Math.max(Math.round((humidityComponent.getValue('rh') as number) * 100), 0), 10000);
            child.createDefaultRelativeHumidityMeasurementClusterServer(matterHumidity);
            // Add event handler
            humidityComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Illuminance') {
          const illuminanceComponent = device.getComponent(key);
          if (illuminanceComponent?.hasProperty('lux') && isValidNumber(illuminanceComponent.getValue('lux'), 0, 10000)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [lightSensor], [], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(illuminanceComponent.getValue('lux') as number), 0xfffe), 0));
            child.createDefaultIlluminanceMeasurementClusterServer(matterLux);
            // Add event handler
            illuminanceComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Thermostat') {
          const thermostatComponent = device.getComponent(key);
          // Thermostat component Gen1 (shellytrv model SHTRV-01)
          if (
            device.gen === 1 &&
            thermostatComponent?.hasProperty('target_t') &&
            thermostatComponent?.hasProperty('tmp') &&
            isValidObject(thermostatComponent.getValue('target_t'), 4) &&
            isValidObject(thermostatComponent.getValue('tmp'), 3)
          ) {
            const target = thermostatComponent.getValue('target_t') as { enabled: boolean; value: number; value_op: number; units: string };
            const current = thermostatComponent.getValue('tmp') as { value: number; units: string; is_valid: boolean };
            const child = mbDevice.addChildDeviceType(key, [thermostatDevice], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultIdentifyClusterServer();
            child.createDefaultHeatingThermostatClusterServer(current.value, target.value, 4, 31);
            child.subscribeAttribute(
              Thermostat.Cluster.id,
              'occupiedHeatingSetpoint',
              (newValue: number, oldValue: number) => {
                if (isValidNumber(newValue, 4 * 100, 31 * 100) && isValidNumber(oldValue, 4 * 100, 31 * 100) && newValue !== oldValue) {
                  mbDevice.log.info(`Thermostat occupiedHeatingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                  if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                  device.thermostatSetpointTimeout = setTimeout(() => {
                    mbDevice.log.info(`Setting thermostat occupiedHeatingSetpoint to ${newValue / 100}`);
                    ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, `settings/thermostats/0?target_t=${newValue / 100}`);
                  }, 2000);
                }
              },
              mbDevice.log,
            );
            child.subscribeAttribute(
              Thermostat.Cluster.id,
              'systemMode',
              (newValue: number, oldValue: number) => {
                mbDevice.log.info(`Thermostat systemMode changed from ${oldValue} to ${newValue}`);
                if (
                  isValidNumber(newValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
                  isValidNumber(oldValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
                  oldValue !== newValue
                ) {
                  if (device.thermostatSystemModeTimeout) clearTimeout(device.thermostatSystemModeTimeout);
                  device.thermostatSystemModeTimeout = setTimeout(() => {
                    // Thermostat.SystemMode.Heat && newValue === Thermostat.SystemMode.Off
                    mbDevice.log.info(`Setting thermostat systemMode to ${newValue}`);
                    if (newValue === Thermostat.SystemMode.Off) {
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, `settings/thermostats/0?target_t_enabled=false`);
                    } else if (newValue === Thermostat.SystemMode.Heat) {
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, `settings/thermostats/0?target_t_enabled=true`);
                    }
                  }, 5000);
                }
              },
              mbDevice.log,
            );
            // Add command handlers
            child.addCommandHandler('identify', async ({ request }) => {
              shellyIdentifyCommandHandler(child, component, request);
            });
            // Add event handler
            thermostatComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
          // Thermostat component Gen2+
          if (
            device.gen > 1 &&
            thermostatComponent?.hasProperty('enable') &&
            thermostatComponent?.hasProperty('type') &&
            thermostatComponent?.hasProperty('target_C') &&
            thermostatComponent?.hasProperty('current_C') &&
            isValidBoolean(thermostatComponent.getValue('enable')) &&
            isValidString(thermostatComponent.getValue('type')) &&
            isValidNumber(thermostatComponent.getValue('target_C'), 5, 35) &&
            isValidNumber(thermostatComponent.getValue('current_C'), 5, 35)
          ) {
            let child: MatterbridgeEndpoint;
            if (thermostatComponent.getValue('type') === 'heating') {
              child = mbDevice.addChildDeviceType(key, [thermostatDevice], undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              child.createDefaultIdentifyClusterServer();
              child.createDefaultHeatingThermostatClusterServer(thermostatComponent.getValue('current_C') as number, thermostatComponent.getValue('target_C') as number, 5, 35);
              child.subscribeAttribute(
                Thermostat.Cluster.id,
                'occupiedHeatingSetpoint',
                (newValue: number, oldValue: number) => {
                  if (isValidNumber(newValue, 5 * 100, 35 * 100) && isValidNumber(oldValue, 5 * 100, 35 * 100) && newValue !== oldValue) {
                    mbDevice.log.info(`Thermostat occupiedHeatingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                    if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                    device.thermostatSetpointTimeout = setTimeout(() => {
                      mbDevice.log.info(`Setting thermostat occupiedHeatingSetpoint to ${newValue / 100}`);
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, target_C: newValue / 100 } });
                    }, 5000);
                  }
                },
                mbDevice.log,
              );
            } else if (thermostatComponent.getValue('type') === 'cooling') {
              child = mbDevice.addChildDeviceType(key, [thermostatDevice], undefined, config.debug as boolean);
              child.log.logName = `${device.name} ${key}`;
              child.createDefaultIdentifyClusterServer();
              child.createDefaultCoolingThermostatClusterServer(thermostatComponent.getValue('current_C') as number, thermostatComponent.getValue('target_C') as number, 5, 35);
              child.subscribeAttribute(
                Thermostat.Cluster.id,
                'occupiedCoolingSetpoint',
                (newValue: number, oldValue: number) => {
                  if (isValidNumber(newValue, 5 * 100, 35 * 100) && isValidNumber(oldValue, 5 * 100, 35 * 100) && newValue !== oldValue) {
                    mbDevice.log.info(`Thermostat occupiedCoolingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                    if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                    device.thermostatSetpointTimeout = setTimeout(() => {
                      mbDevice.log.info(`Setting thermostat occupiedCoolingSetpoint to ${newValue / 100}`);
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, target_C: newValue / 100 } });
                    }, 5000);
                  }
                },
                mbDevice.log,
              );
            } else {
              this.log.error(`Thermostat type ${thermostatComponent.getValue('type')} not supported`);
              continue;
            }
            child.subscribeAttribute(
              Thermostat.Cluster.id,
              'systemMode',
              (newValue: number, oldValue: number) => {
                mbDevice.log.info(`Thermostat systemMode changed from ${oldValue} to ${newValue}`);
                if (
                  isValidNumber(newValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
                  isValidNumber(oldValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
                  oldValue !== newValue
                ) {
                  if (device.thermostatSystemModeTimeout) clearTimeout(device.thermostatSystemModeTimeout);
                  device.thermostatSystemModeTimeout = setTimeout(() => {
                    // Thermostat.SystemMode.Heat && newValue === Thermostat.SystemMode.Off
                    mbDevice.log.info(`Setting thermostat systemMode to ${newValue}`);
                    if (newValue === Thermostat.SystemMode.Off) {
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, enable: false } });
                    } else if (newValue === Thermostat.SystemMode.Heat) {
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, enable: true } });
                    } else if (newValue === Thermostat.SystemMode.Cool) {
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, enable: true } });
                    }
                  }, 5000);
                }
              },
              mbDevice.log,
            );
            // Add command handlers
            child.addCommandHandler('identify', async ({ request }) => {
              shellyIdentifyCommandHandler(child, component, request);
            });
            // Add event handler
            thermostatComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Flood') {
          const floodComponent = device.getComponent(key);
          if (floodComponent?.hasProperty('flood') && isValidBoolean(floodComponent.getValue('flood'))) {
            // const child = mbDevice.addChildDeviceType(key, [contactSensor], undefined, config.debug as boolean);
            const child = mbDevice.addChildDeviceType(key, [waterLeakDetector], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            // child.createDefaultBooleanStateClusterServer(!(floodComponent.getValue('flood') as boolean));
            child.createDefaultBooleanStateClusterServer(floodComponent.getValue('flood') as boolean); // Water Leak Detector: true = leak, false = no leak
            child.addRequiredClusterServers();
            // Add event handler
            floodComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Gas') {
          const gasComponent = device.getComponent(key);
          if (gasComponent?.hasProperty('sensor_state') && isValidString(gasComponent.getValue('alarm_state'))) {
            const child = mbDevice.addChildDeviceType(key, [contactSensor], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultBooleanStateClusterServer(gasComponent.getValue('alarm_state') === 'none');
            child.addRequiredClusterServers();
            // Add event handler
            gasComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Smoke') {
          const smokeComponent = device.getComponent(key);
          if (smokeComponent?.hasProperty('alarm') && isValidBoolean(smokeComponent.getValue('alarm'))) {
            // const child = mbDevice.addChildDeviceType(key, [contactSensor], undefined, config.debug as boolean);
            const child = mbDevice.addChildDeviceType(key, [smokeCoAlarm], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            // child.createDefaultBooleanStateClusterServer(!smokeComponent.getValue('alarm') as boolean);
            child.createSmokeOnlySmokeCOAlarmClusterServer(smokeComponent.getValue('alarm') ? SmokeCoAlarm.AlarmState.Critical : SmokeCoAlarm.AlarmState.Normal);
            child.addRequiredClusterServers();
            // Add event handler
            smokeComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Lux') {
          const luxComponent = device.getComponent(key);
          if (luxComponent?.hasProperty('value') && isValidNumber(luxComponent.getValue('value'), 0)) {
            const child = mbDevice.addChildDeviceType(key, [lightSensor], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(luxComponent.getValue('value') as number), 0xfffe), 0));
            child.createDefaultIlluminanceMeasurementClusterServer(matterLux);
            child.addRequiredClusterServers();
            // Add event handler
            luxComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              shellyUpdateHandler(this, mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Blugw') {
          const blugwComponent = device.getComponent(key);
          if (blugwComponent?.hasProperty('sys_led_enable') && isValidBoolean(blugwComponent.getValue('sys_led_enable'))) {
            const child = mbDevice.addChildDeviceType(key, [modeSelect], undefined, config.debug as boolean);
            child.log.logName = `${device.name} ${key}`;
            child.createDefaultModeSelectClusterServer(
              'System LED',
              [
                { label: 'enabled', mode: 1, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 1 }] },
                { label: 'disabled', mode: 2, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 2 }] },
              ],
              blugwComponent.getValue('sys_led_enable') ? 1 : 2,
              blugwComponent.getValue('sys_led_enable') ? 1 : 2,
            );
            // Add command handlers
            child.addCommandHandler('changeToMode', async ({ request }) => {
              this.log.debug(`***changeToMode: request ${JSON.stringify(request)}`);
              if (isValidNumber(request.newMode, 1, 2)) {
                child.setAttribute(ModeSelect.Cluster.id, 'currentMode', request.newMode, mbDevice.log);
                await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Blugw.SetConfig', { config: { sys_led_enable: request.newMode === 1 } });
              }
            });
            // Add event handler
            blugwComponent.on('event', async (component: string, event: string) => {
              if (isValidString(component, 5) && isValidString(event, 14) && component === 'blugw' && event === 'config_changed') {
                const blugw = await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Blugw.GetConfig');
                const child = mbDevice.getChildEndpointByName('blugw');
                if (isValidObject(blugw, 1) && isValidBoolean(blugw.sys_led_enable))
                  child?.setAttribute(ModeSelect.Cluster.id, 'currentMode', blugw.sys_led_enable ? 1 : 0, mbDevice.log);
              }
            });
          }
        } /* else if (component.name === 'Ble' && config.exposeBle !== 'disabled') {
          const bleComponent = device.getComponent(key);
          if (bleComponent?.hasProperty('enable') && isValidBoolean(bleComponent.getValue('enable'))) {
            const child = mbDevice.addChildDeviceType(key, [modeSelect]);
            child.addClusterServer(
              mbDevice.getDefaultModeSelectClusterServer(
                'Bluetooth',
                [
                  { label: 'disabled', mode: 0, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 0 }] },
                  { label: 'enabled', mode: 1, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 1 }] },
                ],
                bleComponent.getValue('enable') ? 1 : 0,
                bleComponent.getValue('enable') ? 1 : 0,
              ),
            );
            // Add command handlers
            mbDevice.addCommandHandler('changeToMode', async (data) => {
              if (isValidObject(data, 4) && isValidNumber(data.request?.newMode, 0, 1) && isValidNumber(data.endpoint?.number)) {
                const endpoint = mbDevice.getChildEndpoint(data.endpoint.number);
                const componentName = endpoint?.uniqueStorageKey;
                if (componentName === 'ble') await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Ble.SetConfig', { config: { enable: data.request.newMode === 1 } });
              }
            });
            // Add event handler
            bleComponent.on('event', async (component: string, event: string) => {
              if (isValidString(component, 3) && isValidString(event, 14) && component === 'ble' && event === 'config_changed') {
                const ble = await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Ble.GetConfig');
                const endpoint = mbDevice.getChildEndpointByName('ble');
                if (isValidObject(ble, 1) && isValidBoolean(ble.enable)) mbDevice.setAttribute(ModeSelectCluster.id, 'currentMode', ble.enable ? 1 : 0, mbDevice.log, endpoint);
              }
            });
          }
        }*/
      }

      // Register with Matterbridge
      try {
        // Register the device with Matterbridge
        await this.registerDevice(mbDevice);

        // Save the MatterbridgeDevice in the bridgedDevices map
        this.bridgedDevices.set(device.id, mbDevice);

        // Add online/offline event handlers
        device.on('online', () => {
          mbDevice.log.notice(`Device ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is online`);
          if (mbDevice.maybeNumber) {
            mbDevice.setAttribute('BridgedDeviceBasicInformation', 'reachable', true, mbDevice.log);
            mbDevice.triggerEvent(BridgedDeviceBasicInformation.Cluster.id, 'reachableChanged', { reachableNewValue: true }, mbDevice.log);
          }
        });
        device.on('offline', () => {
          mbDevice.log.warn(`Device ${hk}${device.id}${wr} host ${zb}${device.host}${wr} is offline`);
          if (mbDevice.maybeNumber) {
            mbDevice.setAttribute('BridgedDeviceBasicInformation', 'reachable', false, mbDevice.log);
            mbDevice.triggerEvent(BridgedDeviceBasicInformation.Cluster.id, 'reachableChanged', { reachableNewValue: false }, mbDevice.log);
          }
        });
      } catch (error) {
        this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} failed to register with Matterbridge: ${error}`);
      }
    });
  }

  override async onStart(reason?: string) {
    this.log.info(`Starting platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

    // Create NodeStorageManager
    this.nodeStorageManager = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, 'matterbridge-shelly'),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
      forgiveParseErrors: true,
    });
    this.nodeStorage = await this.nodeStorageManager.createStorage('devices');

    // Reset the storage if requested or load the stored devices
    if (this.config.resetStorageDiscover === true) {
      this.config.resetStorageDiscover = false;

      this.log.info('Resetting the select...');
      await this.clearSelect();

      this.log.info('Resetting the Shellies cache...');
      const storedDevices = await this.nodeStorage.get<DiscoveredDevice[]>('DeviceIdentifiers', []);
      for (const device of storedDevices) {
        const fileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${device.id}.json`);
        try {
          this.log.debug(`Deleting cache file: ${fileName}`);
          fs.unlinkSync(fileName);
          this.log.debug(`Deleted cache file: ${fileName}`);
        } catch (error) {
          this.log.debug(`****Failed to delete cache for device ${device.id} file ${fileName} error: ${error}`);
        }
      }

      this.log.info('Resetting the Shellies storage...');
      await this.nodeStorage.clear();
      this.storedDevices.clear();
      this.changedDevices.clear();
      this.gatewayDevices.clear();
      await this.nodeStorage.set<DiscoveredDevice[]>('DeviceIdentifiers', []);
      await this.nodeStorage.set<string[]>('ChangedDevices', []);
      await this.nodeStorage.set<string[]>('GatewayDevices', []);
      this.log.info('Reset of Shellies storage done!');
    } else {
      await this.loadStoredDevices();
    }

    // Load the changed Shelly devices from previous session
    const changedDevices = await this.nodeStorage.get<string[]>('ChangedDevices', []);
    this.log.info(`Found ${CYAN}${changedDevices.length}${nf} changed Shelly devices in the storage:`);
    for (const device of changedDevices) this.log.debug(`- device id ${hk}${device}${db}`);
    this.log.info(`Loading ${CYAN}${changedDevices.length}${nf} changed Shelly devices from the storage...`);
    for (const device of changedDevices) {
      this.log.debug(`Loaded changed device id ${hk}${device}${db} from the storage`);
      this.changedDevices.set(device, device);
    }
    this.log.info(`Loaded ${CYAN}${this.changedDevices.size}${nf} changed Shelly devices from the storage`);

    // Load the gateway Shelly devices from previous session
    const gatewayDevices = await this.nodeStorage.get<string[]>('GatewayDevices', []);
    this.log.info(`Found ${CYAN}${gatewayDevices.length}${nf} gateway Shelly devices in the storage:`);
    for (const device of gatewayDevices) this.log.debug(`- device id ${hk}${device}${db}`);
    this.log.info(`Loading ${CYAN}${gatewayDevices.length}${nf} gateway Shelly devices from the storage...`);
    for (const device of gatewayDevices) {
      this.log.debug(`Loaded gateway device id ${hk}${device}${db} from the storage`);
      this.gatewayDevices.set(device, device);
    }
    this.log.info(`Loaded ${CYAN}${this.gatewayDevices.size}${nf} gateway Shelly devices from the storage`);

    // Add all stored devices
    if (this.config.enableStorageDiscover === true) {
      this.log.info(`Found ${CYAN}${this.storedDevices.size}${nf} stored Shelly devices in the storage:`);
      for (const storedDevice of this.storedDevices.values())
        this.log.debug(
          `- stored Shelly device id ${hk}${storedDevice.id}${db} host ${zb}${storedDevice.host}${db} port ${CYAN}${storedDevice.port}${db} gen ${CYAN}${storedDevice.gen}${db}`,
        );
      this.log.info(`Loading from storage ${this.storedDevices.size} Shelly devices`);
      for (const storedDevice of this.storedDevices.values()) {
        if (storedDevice.id.startsWith('shellyspot2') || storedDevice.id.startsWith('shellypresence') || storedDevice.id.startsWith('shellysense')) {
          this.log.info(`Stored Shelly device id ${hk}${storedDevice.id}${er} host ${zb}${storedDevice.host}${er} is not supported.`);
          continue;
        }
        storedDevice.id = ShellyDevice.normalizeId(storedDevice.id).id;
        if (storedDevice.id === undefined || storedDevice.host === undefined || !isValidIpv4Address(storedDevice.host)) {
          this.log.error(`Stored Shelly device id ${hk}${storedDevice.id}${er} host ${zb}${storedDevice.host}${er} is not valid. Please remove it from the storage.`);
          continue;
        }
        this.log.debug(
          `Loading from storage Shelly device ${hk}${storedDevice.id}${db} host ${zb}${storedDevice.host}${db} port ${CYAN}${storedDevice.port}${db} gen ${CYAN}${storedDevice.gen}${db}`,
        );
        // Add the device to the discoveredDevices map
        this.discoveredDevices.set(storedDevice.id, storedDevice);
        const device = await this.addDevice(storedDevice.id, storedDevice.host);
        // Update the device generation in the storage
        if (device) {
          storedDevice.gen = device.gen;
        }
      }
      this.log.info(`Loaded from storage ${this.storedDevices.size} Shelly devices`);
      await this.saveStoredDevices();
    }

    // start Shelly mDNS device discoverer if enabled
    if (this.config.enableMdnsDiscover === true) {
      this.shelly.mdnsScanner.start(0, 10 * 60 * 1000, this.config.interfaceName as string | undefined, 'udp4', this.config.debugMdns as boolean);
    }

    // Start the CoAP server
    this.shelly.coapServer.start();

    // Start the WebSocket server
    this.shelly.wsServer.start();

    // Wait for the failsafe count to be met
    if (this.failsafeCount > 0 && this.bridgedDevices.size + this.bluBridgedDevices.size < this.failsafeCount) {
      this.log.notice(`Waiting for the configured number of ${this.bridgedDevices.size + this.bluBridgedDevices.size}/${this.failsafeCount} devices to be loaded.`);
      /* prettier-ignore */
      const isSafe = await waiter('failsafeCount', () => this.bridgedDevices.size + this.bluBridgedDevices.size >= this.failsafeCount, false, 55000, 1000, this.config.debug as boolean);
      if (!isSafe) {
        throw new Error(
          `The plugin did not add the configured number of ${this.failsafeCount} devices. Registered ${this.bridgedDevices.size + this.bluBridgedDevices.size} devices.`,
        );
      } else {
        this.log.notice(`The plugin added the configured number of ${this.failsafeCount} devices.`);
      }
    }

    // Clear the firstRun flag
    if (this.firstRun === true) {
      this.log.notice(`Platform first configuration terminated`);
      this.config.firstRun = false;
    }

    this.log.info(`Started platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);
  }

  override async onConfigure() {
    await super.onConfigure();

    this.log.info(`Configuring platform ${idn}${this.config.name}${rs}${nf}`);
    for (const mbDevice of this.bridgedDevices.values()) {
      if (!mbDevice.serialNumber) {
        this.log.error(`Shelly device ${dn}${mbDevice.deviceName}${er} has no serial number`);
        return;
      }
      const serial = isValidString(this.config.postfix, 1, 3) ? mbDevice.serialNumber.replace('-' + this.config.postfix, '') : mbDevice.serialNumber;
      this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} shelly ${hk}${serial}${nf}`);
      const shellyDevice = this.shelly.getDevice(serial);
      if (!shellyDevice) {
        this.log.error(`Shelly device with serial number ${hk}${serial}${er} not found`);
        return;
      }
      // Set configUrl for the device
      mbDevice.configUrl = `http://${shellyDevice.host}`;
      this.log.debug(`Configuring device ${dn}${mbDevice.deviceName}${db} configUrl ${YELLOW}${mbDevice.configUrl}${db}`);

      for (const childEndpoint of mbDevice.getChildEndpoints()) {
        const label = childEndpoint.uniqueStorageKey;
        if (!label) return;
        // Configure the cluster OnOff attribute onOff
        if (label.startsWith('switch') || label.startsWith('relay') || label.startsWith('light') || label.startsWith('rgb')) {
          const switchComponent = shellyDevice.getComponent(label) as ShellySwitchComponent;
          this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}state ${YELLOW}${switchComponent.getValue('state')}${nf}`);
          const state = switchComponent.getValue('state');
          if (isValidBoolean(state)) {
            await childEndpoint.setAttribute(OnOff.Cluster.id, 'onOff', state, shellyDevice.log);
          }
        }
        // Configure the cluster LevelControl attribute currentLevel
        if (label.startsWith('light') || label.startsWith('rgb')) {
          const lightComponent = shellyDevice.getComponent(label) as ShellyLightComponent;
          const level = lightComponent.getValue('brightness') as number;
          if (isValidNumber(level, 1, 100)) {
            const matterLevel = Math.max(Math.min(Math.round((level / 100) * 254), 254), 1);
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}brightness ${YELLOW}${matterLevel}${nf}`);
            await childEndpoint.setAttribute(LevelControl.Cluster.id, 'currentLevel', matterLevel, shellyDevice.log);
          }
          // Configure the cluster ColorControl attribute currentHue, currentSaturation and colorMode
          if (lightComponent.hasProperty('red') && lightComponent.hasProperty('green') && lightComponent.hasProperty('blue') && shellyDevice.profile !== 'white') {
            const red = lightComponent.getValue('red') as number;
            const green = lightComponent.getValue('green') as number;
            const blue = lightComponent.getValue('blue') as number;
            if (isValidNumber(red, 0, 255) && isValidNumber(green, 0, 255) && isValidNumber(blue, 0, 255)) {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}rgb ${YELLOW}${red},${green},${blue}${nf}`);
              const hsl = rgbColorToHslColor({ r: red, g: green, b: blue });
              this.log.debug(`ColorRgbToHsl: R:${red} G:${green} B:${blue} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
              const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
              const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
              if (isValidNumber(hue, 0, 254)) await childEndpoint.setAttribute(ColorControl.Cluster.id, 'currentHue', hue, shellyDevice.log);
              if (isValidNumber(saturation, 0, 254)) await childEndpoint.setAttribute(ColorControl.Cluster.id, 'currentSaturation', saturation, shellyDevice.log);
              await childEndpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log);
            }
          }
          if (lightComponent.hasProperty('temp') && shellyDevice.profile !== 'color') {
            await childEndpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.ColorTemperatureMireds, shellyDevice.log);
          }
          if (lightComponent.hasProperty('rgb') && shellyDevice.profile !== 'white') {
            const rgb = lightComponent.getValue('rgb') as object;
            if (isValidArray(rgb, 3, 3) && isValidNumber(rgb[0], 0, 255) && isValidNumber(rgb[1], 0, 255) && isValidNumber(rgb[2], 0, 255)) {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}rgb ${YELLOW}${rgb[0]},${rgb[1]},${rgb[2]}${nf}`);
              const hsl = rgbColorToHslColor({ r: rgb[0], g: rgb[1], b: rgb[2] });
              this.log.debug(`ColorRgbToHsl: R:${rgb[0]} G:${rgb[1]} B:${rgb[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
              const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
              const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
              if (isValidNumber(hue, 0, 254)) await childEndpoint.setAttribute(ColorControl.Cluster.id, 'currentHue', hue, shellyDevice.log);
              if (isValidNumber(saturation, 0, 254)) await childEndpoint.setAttribute(ColorControl.Cluster.id, 'currentSaturation', saturation, shellyDevice.log);
              await childEndpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log);
            }
          }
        }
        // Configure the cluster WindowCovering attribute currentPositionLiftPercent100ths
        if (label.startsWith('cover') || label.startsWith('roller')) {
          const coverComponent = shellyDevice.getComponent(label) as ShellyCoverComponent;
          const position = coverComponent.hasProperty('current_pos') ? (coverComponent.getValue('current_pos') as number) : undefined;
          if (isValidNumber(position, 0, 100)) {
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}current_pos ${YELLOW}${position}${nf}`);
            const matterPos = 10000 - Math.min(Math.max(Math.round(position * 100), 0), 10000);
            await childEndpoint.setWindowCoveringCurrentTargetStatus(matterPos, matterPos, WindowCovering.MovementStatus.Stopped);
          } else {
            await childEndpoint.setWindowCoveringTargetAsCurrentAndStopped();
          }
        }
        // Configure the cluster Thermostat attribute occupiedHeatingSetpoint occupiedCoolingSetpoint
        if (label.startsWith('thermostat')) {
          const thermostatComponent = shellyDevice.getComponent(label) as ShellyCoverComponent;
          const target = thermostatComponent.hasProperty('target_C') ? (thermostatComponent.getValue('target_C') as number) : undefined;
          if (isValidNumber(target, 5, 35)) {
            if (thermostatComponent.getValue('type') === 'heating') {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}occupiedHeatingSetpoint ${YELLOW}${target}${nf}`);
              await childEndpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', target * 100, shellyDevice.log);
            } else if (thermostatComponent.getValue('type') === 'cooling') {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}occupiedCoolingSetpoint ${YELLOW}${target}${nf}`);
              await childEndpoint.setAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', target * 100, shellyDevice.log);
            }
          }
        }
        // Update the electrical attributes
        if (childEndpoint.getDeviceTypes().includes(electricalSensor)) {
          const component = shellyDevice.getComponent(label);
          if (!component) return;
          this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} electrical component ${hk}${label}${nf}`);
          for (const property of component.properties) {
            if (!['voltage', 'current', 'power', 'apower', 'act_power', 'total', 'aenergy', 'total_act_energy'].includes(property.key)) continue;
            shellyUpdateHandler(this, mbDevice, shellyDevice, component.id, property.key, property.value);
          }
        }
      }
      if (shellyDevice.bthomeDevices.size > 0) {
        shellyDevice.log.info(`Configuring BLE devices paired to ${hk}${shellyDevice.id}${nf}...`);
        shellyDevice.bthomeDevices.forEach((bthomeDevice) => {
          const blu = this.bluBridgedDevices.get(bthomeDevice.addr);
          if (!blu) return;
          blu.log.debug(
            `Configuring BLE device id ${CYAN}${bthomeDevice.id}${db} key ${CYAN}${bthomeDevice.key}${db} addr ${CYAN}${bthomeDevice.addr}${db} model ${CYAN}${bthomeDevice.model}${db}`,
          );
          shellyDevice.bthomeSensors.forEach(async (bthomeSensor) => {
            if (bthomeSensor.addr !== bthomeDevice.addr) return;
            blu.log.debug(
              `Configuring BLE sensor id ${CYAN}${bthomeSensor.id}${db} key ${CYAN}${bthomeSensor.key}${db} addr ${CYAN}${bthomeSensor.addr}${db} ` +
                `sensorId ${CYAN}${bthomeSensor.sensorId}-${shellyDevice.getBTHomeObjIdText(bthomeSensor.sensorId)}${db} sensorIdx ${CYAN}${bthomeSensor.sensorIdx}${db} value ${CYAN}${bthomeSensor.value}${db}`,
            );
            shellyDevice.emit('bthomesensor_update', bthomeSensor.addr, shellyDevice.getBTHomeObjIdText(bthomeSensor.sensorId), bthomeSensor.sensorIdx, bthomeSensor.value);
          });
        });
      }
    }
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);
    this.log.info(`Shutting down platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

    if (this.nodeStorage) {
      this.log.info(`Saving ${CYAN}${this.changedDevices.size}${nf} changed Shelly devices to the storage`);
      await this.nodeStorage.set<string[]>('ChangedDevices', Array.from(this.changedDevices.values()));
      this.log.info(`Saving ${CYAN}${this.gatewayDevices.size}${nf} gateway Shelly devices to the storage`);
      await this.nodeStorage.set<string[]>('GatewayDevices', Array.from(this.gatewayDevices.values()));
    } else {
      this.log.error('NodeStorage is not initialized');
      return;
    }

    this.shelly.removeAllListeners();
    this.shelly.destroy();

    this.discoveredDevices.clear();
    this.storedDevices.clear();
    this.changedDevices.clear();
    this.gatewayDevices.clear();
    this.bridgedDevices.clear();
    this.bluBridgedDevices.clear();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(
      `Changing logger level for platform ${idn}${this.config.name}${rs}${db} to ${logLevel} with debugMdns ${this.config.debugMdns}, debugCoap ${this.config.debugCoap} and debugWs ${this.config.debugWs}`,
    );
    this.shelly.setLogLevel(logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean, this.config.debugWs as boolean);
    this.bridgedDevices.forEach((device) => (device.log.logLevel = logLevel));
    this.bluBridgedDevices.forEach((bluDevice) => (bluDevice.log.logLevel = logLevel));
  }

  override async onAction(action: string, value?: string) {
    if (action === 'addDevice' && value && isValidString(value)) {
      value = value.replace('http://', '').replace('https://', '').replaceAll('/', '');
      if (!isValidIpv4Address(value)) {
        this.log.error(`Failed to add device on IP address ${value}. Please check the IP address.`);
        return;
      }
      this.log.info(`Adding device on IP address ${zb}${value}${nf}`);
      const device = await ShellyDevice.create(this.shelly, this.log, value);
      if (device) {
        this.discoveredDevices.set(device.id, { id: device.id, host: device.host, port: 80, gen: device.gen });
        this.storedDevices.set(device.id, { id: device.id, host: device.host, port: 80, gen: device.gen });
        await this.saveStoredDevices();
        await this.addDevice(device.id, device.host);
        device.destroy();
      } else {
        this.log.error(`Failed to add device on IP address ${zb}${value}${er}`);
      }
    }
    if (action === 'removeDevice' && value && isValidString(value)) {
      value = value.trim();
      if (this.shelly.hasDevice(value)) {
        this.log.warn(`Removing device id ${hk}${value}${wr} while it is still in use. Please blacklist the device first and restart before removing it.`);
        (this.config as unknown as ShellyPlatformConfig).blackList.push(value);
        this.shelly.getDevice(value)?.destroy();
        this.shelly.removeDevice(value);
        this.matterbridge.frontend.wssSendRestartRequired();
      }
      this.log.info(`Removing device id ${hk}${value}${nf}`);
      this.storedDevices.delete(value);
      this.changedDevices.delete(value);
      this.gatewayDevices.delete(value);
      if (this.nodeStorage) {
        await this.nodeStorage.set<DiscoveredDevice[]>('DeviceIdentifiers', Array.from(this.storedDevices.values()));
        await this.nodeStorage.set<string[]>('ChangedDevices', Array.from(this.changedDevices.values()));
        await this.nodeStorage.set<string[]>('GatewayDevices', Array.from(this.gatewayDevices.values()));
      }
      const fileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${value}.json`);
      try {
        this.log.debug(`Deleting cache file: ${fileName}`);
        fs.unlinkSync(fileName);
        this.log.debug(`Deleted cache file: ${fileName}`);
        this.log.info(`Removed cache file for device id ${hk}${value}${nf}`);
      } catch (error) {
        this.log.debug(`****Failed to delete cache for device ${value} file ${fileName} error: ${error}`);
      }
      this.selectDevice.delete(value);
      this.log.debug(`Deleted select for device: ${value}`);
      this.log.info(`Removed device id ${hk}${value}${nf}`);
    }
    if (action === 'scanNetwork') {
      this.log.info(`Scanning the network for Shelly devices`);
      this.shelly.mdnsScanner.sendQuery();
    }
  }

  private addTagList(component: ShellyComponent): Semtag[] | undefined {
    if (this.matterbridge.edge) return undefined;
    // Add the tagList to the descriptor cluster
    let tagList: Semtag | undefined;
    if (component.index === 0) tagList = { mfgCode: null, namespaceId: NumberTag.Zero.namespaceId, tag: NumberTag.Zero.tag, label: component.id };
    else if (component.index === 1) tagList = { mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag: NumberTag.One.tag, label: component.id };
    else if (component.index === 2) tagList = { mfgCode: null, namespaceId: NumberTag.Two.namespaceId, tag: NumberTag.Two.tag, label: component.id };
    else if (component.index === 3) tagList = { mfgCode: null, namespaceId: NumberTag.Three.namespaceId, tag: NumberTag.Three.tag, label: component.id };
    return tagList ? [tagList] : undefined;
  }

  private hasElectricalMeasurements(shelly: ShellyDevice, component: ShellyComponent) {
    // Check if PowerMetering is enabled
    if (isValidArray(this.config.entityBlackList, 1) && this.config.entityBlackList.includes('PowerMeter')) {
      return false;
    }
    // Check if the component has electricalSensor
    if (component.hasProperty('voltage') || component.hasProperty('current') || component.hasProperty('apower') || component.hasProperty('aenergy')) {
      return true;
    }
    return false;
  }

  // Add electrical measurements to the child endpoint of the switch light cover component
  private addElectricalMeasurements(device: MatterbridgeEndpoint, endpoint: MatterbridgeEndpoint, shelly: ShellyDevice, component: ShellyComponent) {
    // Check if PowerMetering is enabled
    if (isValidArray(this.config.entityBlackList, 1) && this.config.entityBlackList.includes('PowerMeter')) {
      return;
    }
    // Add the Matter 1.3 electricalSensor device type and the PowerTopology, ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters on the same endpoint
    if (component.hasProperty('voltage') || component.hasProperty('current') || component.hasProperty('apower') || component.hasProperty('aenergy')) {
      shelly.log.debug(`Adding ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters to endpoint ${hk}${endpoint.name}${db} component ${hk}${component.id}${db}`);
      endpoint.createDefaultPowerTopologyClusterServer();
      endpoint.createDefaultElectricalPowerMeasurementClusterServer();
      endpoint.createDefaultElectricalEnergyMeasurementClusterServer();
    }
  }

  private async saveStoredDevices(): Promise<boolean> {
    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return false;
    }
    this.log.debug(`Saving ${CYAN}${this.storedDevices.size}${db} discovered Shelly devices to the storage`);
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
    this.log.debug(`Loaded ${CYAN}${this.storedDevices.size}${db} discovered Shelly devices from the storage`);
    return true;
  }

  // Called from onStart to add a device from storedDevice, from discovered shelly event and from onAction()
  private async addDevice(deviceId: string, host: string): Promise<ShellyDevice | undefined> {
    if (this.shelly.hasDevice(deviceId) || this.shelly.hasDeviceHost(host)) {
      this.log.info(`Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf} already added`);
      return;
    }
    this.log.info(`Adding shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
    const log = new AnsiLogger({ logName: deviceId, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.log.logLevel });
    const cacheFileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${deviceId}.json`);
    let device: ShellyDevice | undefined;

    let loadFromCache = true;
    if (isValidArray(this.config.nocacheList, 1) && this.config.nocacheList.includes(deviceId)) {
      loadFromCache = false;
      this.log.debug(`Adding with nocacheList Shelly device ${hk}${deviceId}${db} host ${zb}${host}${db}`);
    }
    if (this.changedDevices.has(deviceId)) {
      this.changedDevices.delete(deviceId);
      loadFromCache = false;
      this.log.debug(`Adding with changedDevices Shelly device ${hk}${deviceId}${db} host ${zb}${host}${db}`);
    }

    if (loadFromCache && fs.existsSync(cacheFileName)) {
      this.log.info(`Loading from cache Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
      device = await ShellyDevice.create(this.shelly, log, cacheFileName);
      if (device) {
        this.log.info(`Loaded from cache Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
        device.setHost(host); // Set the real host for device and wsClient
        device.cached = true;
        device.online = true;
      }
    } else {
      this.log.info(`Creating Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
      device = await ShellyDevice.create(this.shelly, log, host);
      if (device) {
        this.log.info(`Created Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
        await device.saveDevicePayloads(this.shelly.dataPath);
      } else {
        // This fix when the device is not reachable but the cache file exist: like config changed from sleep mode devices
        if (fs.existsSync(cacheFileName)) {
          device = await ShellyDevice.create(this.shelly, log, cacheFileName);
          if (device) {
            this.log.info(`Loaded from cache (device unreachable) Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
            device.setHost(host); // Set the real host for device and wsClient
            device.cached = true;
            device.online = true;
          }
        }
      }
    }
    if (!device) {
      this.log.error(
        `Failed to create Shelly device ${hk}${deviceId}${er} host ${zb}${host}${er} (loadFromCache: ${loadFromCache} cacheFileExist: ${fs.existsSync(cacheFileName)})`,
      );
      return;
    }

    // Set the device in the selectDevice map for the frontend device selection
    this.setSelectDevice(device.id, device.name, 'http://' + host, 'wifi');

    // Destroy the device if it is not a gateway device and it is not validated
    if (!this.gatewayDevices.has(device.id) && !this.validateDevice([device.id, device.mac, device.name])) {
      device.destroy();
      return;
    }

    log.logName = device.name ?? device.id;
    await this.shelly.addDevice(device);
    return device;
  }

  private async addBluDevice(
    gateway: ShellyDevice,
    bthomeDevice: {
      id: number;
      key: string;
      name: string;
      addr: string;
      model: string;
      type: string;
      blutrv_id: number;
      packet_id: number;
      rssi: number;
      last_updated_ts: number;
    },
  ): Promise<void> {
    this.log.info(
      `- ${idn}${bthomeDevice.name}${rs}${nf} address ${CYAN}${bthomeDevice.addr}${nf} id ${CYAN}${bthomeDevice.id}${nf} ` +
        `model ${CYAN}${bthomeDevice.model}${nf} (${CYAN}${bthomeDevice.type}${nf})`,
    );
    let definition: AtLeastOne<DeviceTypeDefinition> | undefined;
    if (bthomeDevice.model === 'Shelly BLU DoorWindow') definition = [bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU Motion') definition = [bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU Button1') definition = [genericSwitch, bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU HT') definition = [bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU RC Button 4') definition = [bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') definition = [bridgedNode, powerSource];
    else if (bthomeDevice.model === 'Shelly BLU Trv') definition = [thermostatDevice, bridgedNode, powerSource];
    else this.log.error(`Shelly device ${hk}${gateway.id}${er} host ${zb}${gateway.host}${er} has an unknown BLU device model ${CYAN}${bthomeDevice.model}${nf}`);
    // Check if the BLU device is already registered
    this.bluBridgedDevices.forEach((blu) => {
      if (blu.serialNumber === bthomeDevice.addr + (this.postfix ? '-' + this.postfix : '')) {
        this.log.warn(`BLU device ${idn}${bthomeDevice.name}${rs}${wr} address ${CYAN}${bthomeDevice.addr}${wr} already registered with another ble gateway.`);
        definition = undefined;
      }
    });
    if (definition) {
      const mbDevice = new MatterbridgeEndpoint(definition, { uniqueStorageKey: bthomeDevice.name }, this.config.debug as boolean);
      mbDevice.configUrl = `http://${gateway.host}`;
      mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        bthomeDevice.name,
        bthomeDevice.addr + (this.postfix ? '-' + this.postfix : ''),
        0xfff1,
        'Shelly',
        bthomeDevice.model,
      );
      if (bthomeDevice.model === 'Shelly BLU DoorWindow') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.addFixedLabel('composed', 'Sensor');
        mbDevice.addChildDeviceTypeWithClusterServer('Contact', [contactSensor], [], undefined, this.config.debug as boolean);
        if (this.validateEntity(bthomeDevice.addr, 'Illuminance'))
          mbDevice.addChildDeviceTypeWithClusterServer('Illuminance', [lightSensor], [], undefined, this.config.debug as boolean);
      } else if (bthomeDevice.model === 'Shelly BLU Motion') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.addFixedLabel('composed', 'Sensor');
        mbDevice.addChildDeviceTypeWithClusterServer('Motion', [occupancySensor], [], undefined, this.config.debug as boolean);
        if (this.validateEntity(bthomeDevice.addr, 'Illuminance'))
          mbDevice.addChildDeviceTypeWithClusterServer('Illuminance', [lightSensor], [], undefined, this.config.debug as boolean);
        if (this.validateEntity(bthomeDevice.addr, 'Button')) mbDevice.addChildDeviceTypeWithClusterServer('Button', [genericSwitch], [], undefined, this.config.debug as boolean);
      } else if (bthomeDevice.model === 'Shelly BLU Button1') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.createDefaultSwitchClusterServer();
      } else if (bthomeDevice.model === 'Shelly BLU HT') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.addFixedLabel('composed', 'Sensor');
        mbDevice.addChildDeviceTypeWithClusterServer('Temperature', [temperatureSensor], [], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Humidity', [humiditySensor], [], undefined, this.config.debug as boolean);
        if (this.validateEntity(bthomeDevice.addr, 'Button')) mbDevice.addChildDeviceTypeWithClusterServer('Button', [genericSwitch], [], undefined, this.config.debug as boolean);
      } else if (bthomeDevice.model === 'Shelly BLU RC Button 4') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.addFixedLabel('composed', 'Input');
        mbDevice.addChildDeviceTypeWithClusterServer('Button0', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button1', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button2', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button3', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
      } else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
        mbDevice.addFixedLabel('composed', 'Input');
        mbDevice.addChildDeviceTypeWithClusterServer('Button0', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button1', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button2', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
        mbDevice.addChildDeviceTypeWithClusterServer('Button3', [genericSwitch], [Switch.Cluster.id], undefined, this.config.debug as boolean);
      } else if (bthomeDevice.model === 'Shelly BLU Trv') {
        mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer(100, PowerSource.BatChargeLevel.Ok, 3000, 'Type AA', 2);
        mbDevice.createDefaultIdentifyClusterServer();
        mbDevice.createDefaultHeatingThermostatClusterServer(undefined, undefined, 4, 30);
        mbDevice.subscribeAttribute(
          Thermostat.Cluster.id,
          'systemMode',
          (newValue: number, oldValue: number) => {
            if (
              isValidNumber(newValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
              isValidNumber(oldValue, Thermostat.SystemMode.Off, Thermostat.SystemMode.Heat) &&
              newValue !== oldValue
            ) {
              mbDevice.log.info(`Thermostat systemMode changed from ${oldValue} to ${newValue}`);
              if (oldValue === Thermostat.SystemMode.Heat && newValue === Thermostat.SystemMode.Off) {
                if (gateway.thermostatSystemModeTimeout) clearTimeout(gateway.thermostatSystemModeTimeout);
                gateway.thermostatSystemModeTimeout = setTimeout(() => {
                  mbDevice.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Heat, mbDevice.log);
                }, 5000);
              }
            }
          },
          mbDevice.log,
        );
        mbDevice.subscribeAttribute(
          Thermostat.Cluster.id,
          'occupiedHeatingSetpoint',
          (newValue: number, oldValue: number) => {
            if (isValidNumber(newValue, 4 * 100, 30 * 100) && isValidNumber(oldValue, 4 * 100, 30 * 100) && newValue !== oldValue) {
              mbDevice.log.info(`Thermostat occupiedHeatingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
              if (gateway.thermostatSetpointTimeout) clearTimeout(gateway.thermostatSetpointTimeout);
              gateway.thermostatSetpointTimeout = setTimeout(() => {
                mbDevice.log.info(`Setting thermostat occupiedHeatingSetpoint to ${newValue / 100}`);
                // http://192.168.1.164/rpc/BluTrv.Call?id=201&method=Trv.SetTarget&params={id:0,target_C:19}
                ShellyDevice.fetch(this.shelly, mbDevice.log, gateway.host, 'BluTrv.Call', {
                  id: bthomeDevice.blutrv_id,
                  method: 'Trv.SetTarget',
                  params: { id: 0, target_C: newValue / 100 },
                });
              }, 5000);
            }
          },
          mbDevice.log,
        );
      }
      mbDevice.addRequiredClusterServers();
      try {
        await this.registerDevice(mbDevice);
        this.bluBridgedDevices.set(bthomeDevice.addr, mbDevice);
        mbDevice.log.logName = `${bthomeDevice.name}`;
      } catch (error) {
        this.log.error(
          `Shelly device ${hk}${gateway.id}${er} host ${zb}${gateway.host}${er} failed to register BLU device ${idn}${bthomeDevice.name}${rs}${er}: ${error instanceof Error ? error.message : error}`,
        );
      }
    }
  }
}
