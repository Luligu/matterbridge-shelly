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
  ColorControlCluster,
  electricalSensor,
  OccupancySensingCluster,
  IlluminanceMeasurementCluster,
  TemperatureMeasurementCluster,
  DeviceTypeDefinition,
  RelativeHumidityMeasurementCluster,
  AtLeastOne,
  PowerSourceCluster,
  ElectricalPowerMeasurement,
  ElectricalEnergyMeasurement,
  Endpoint,
  ElectricalPowerMeasurementCluster,
  ElectricalEnergyMeasurementCluster,
  onOffLight,
  onOffOutlet,
  ThermostatCluster,
  Thermostat,
  Switch,
  VendorId,
  ModeSelectCluster,
} from 'matterbridge';

// import { EveHistory, EveHistoryCluster, MatterHistory } from 'matterbridge/history';
import { AnsiLogger, BLUE, CYAN, GREEN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, dn, er, hk, idn, nf, nt, or, rs, wr, zb } from 'matterbridge/logger';
import { NodeStorage, NodeStorageManager } from 'matterbridge/storage';
import { hslColorToRgbColor, rgbColorToHslColor, isValidIpv4Address, isValidString, isValidNumber, isValidBoolean, isValidArray, isValidObject, waiter } from 'matterbridge/utils';

import path from 'path';
import * as fs from 'fs';

import { Shelly } from './shelly.js';
import { DiscoveredDevice } from './mdnsScanner.js';
import { ShellyDevice } from './shellyDevice.js';
import { isLightComponent, isSwitchComponent, ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';

type ConfigDeviceIp = Record<string, string>;

// Shelly device id (e.g. shellyplus1pm-441793d69718)
type ShellyDeviceId = string;

export class ShellyPlatform extends MatterbridgeDynamicPlatform {
  public discoveredDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public storedDevices = new Map<ShellyDeviceId, DiscoveredDevice>();
  public changedDevices = new Map<ShellyDeviceId, ShellyDeviceId>();
  public shellyDevices = new Map<ShellyDeviceId, ShellyDevice>();
  public bridgedDevices = new Map<ShellyDeviceId, MatterbridgeDevice>();
  public bluBridgedDevices = new Map<string, MatterbridgeDevice>();

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
  private postfix;
  private failsafeCount;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (!this.verifyMatterbridgeVersion('1.5.5')) {
      throw new Error(`The shelly plugin requires Matterbridge version >= "1.5.5". Please update Matterbridge to the latest version in the frontend."`);
    }

    if (config.username) this.username = config.username as string;
    if (config.password) this.password = config.password as string;
    if (config.whiteList) this.whiteList = config.whiteList as string[];
    if (config.blackList) this.blackList = config.blackList as string[];
    this.postfix = (config.postfix as string) ?? '';
    if (!isValidString(this.postfix, 0, 3)) this.postfix = '';
    this.failsafeCount = (config.failsafeCount as number) ?? 0;
    if (!isValidNumber(this.failsafeCount, 0)) this.failsafeCount = 0;

    log.debug(`Initializing platform: ${idn}${this.config.name}${rs}${db}`);
    log.debug(`- username: ${CYAN}${config.username}`);
    log.debug(`- password: ${CYAN}${config.password}`);
    log.debug(`- exposeSwitch: ${CYAN}${config.exposeSwitch}`);
    log.debug(`- exposeInput: ${CYAN}${config.exposeInput}`);
    log.debug(`- exposePowerMeter: ${CYAN}${config.exposePowerMeter}`);
    log.debug(`- mdnsDiscover: ${CYAN}${config.enableMdnsDiscover}`);
    log.debug(`- storageDiscover: ${CYAN}${config.enableStorageDiscover}`);
    log.debug(`- configDiscover: ${CYAN}${config.enableConfigDiscover}`);
    log.debug(`- bleDiscover: ${CYAN}${config.enableBleDiscover}`);
    log.debug(`- resetStorage: ${CYAN}${config.resetStorageDiscover}`);
    log.debug(`- postfixHostname: ${CYAN}${config.postfixHostname}`);
    log.debug(`- failsafeCount: ${CYAN}${config.failsafeCount}`);
    log.debug(`- interfaceName: ${CYAN}${config.interfaceName}`);
    log.debug(`- debug: ${CYAN}${config.debug}`);
    log.debug(`- debugMdns: ${CYAN}${config.debugMdns}`);
    log.debug(`- debugCoap: ${CYAN}${config.debugCoap}`);
    log.debug(`- debugWs: ${CYAN}${config.debugWs}`);
    log.debug(`- unregisterOnShutdown: ${CYAN}${config.unregisterOnShutdown}`);

    this.shelly = new Shelly(log, this.username, this.password);
    this.shelly.setLogLevel(log.logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean, this.config.debugWs as boolean);
    this.shelly.dataPath = path.join(matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly');
    this.shelly.debugMdns = this.config.debugMdns as boolean;
    this.shelly.debugCoap = this.config.debugCoap as boolean;

    // handle Shelly discovered event
    this.shelly.on('discovered', async (discoveredDevice: DiscoveredDevice) => {
      if (this.discoveredDevices.has(discoveredDevice.id)) {
        const stored = this.storedDevices.get(discoveredDevice.id);
        if (stored?.host !== discoveredDevice.host) {
          this.log.warn(`Shelly device ${hk}${discoveredDevice.id}${wr} host ${zb}${discoveredDevice.host}${wr} is already discovered with a different host.`);
          this.log.warn(`Set new address for shelly device ${hk}${discoveredDevice.id}${wr} from ${zb}${stored?.host}${wr} to ${zb}${discoveredDevice.host}${wr}`);
          this.log.warn(`Please restart for the change to take effect.`);
          this.discoveredDevices.set(discoveredDevice.id, discoveredDevice);
          this.storedDevices.set(discoveredDevice.id, discoveredDevice);
          await this.saveStoredDevices();
          return;
        } else {
          this.log.info(`Shelly device ${hk}${discoveredDevice.id}${nf} host ${zb}${discoveredDevice.host}${nf} already discovered`);
          return;
        }
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

      // Validate the device data
      if (
        !isValidString(device.name, 1) ||
        !isValidString(device.id, 1) ||
        !isValidString(device.host, 1) ||
        !isValidNumber(device.gen, 1, 3) ||
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
          // Register the BLU devices
          for (const [key, bthomeDevice] of device.bthomeDevices) {
            this.log.info(
              `- ${idn}${bthomeDevice.name}${rs}${nf} address ${CYAN}${bthomeDevice.addr}${nf} id ${CYAN}${bthomeDevice.id}${nf} ` +
                `model ${CYAN}${bthomeDevice.model}${nf} (${CYAN}${bthomeDevice.type}${nf})`,
            );
            let definition: AtLeastOne<DeviceTypeDefinition> | undefined;
            if (bthomeDevice.model === 'Shelly BLU DoorWindow') definition = [bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU Motion') definition = [bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU Button1') definition = [DeviceTypes.GENERIC_SWITCH, bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU HT') definition = [bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU RC Button 4') definition = [bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') definition = [bridgedNode, powerSource];
            else if (bthomeDevice.model === 'Shelly BLU Trv') definition = [DeviceTypes.THERMOSTAT, bridgedNode, powerSource];
            else this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} has an unknown BLU device model ${CYAN}${bthomeDevice.model}${nf}`);
            // Check if the BLU device is already registered
            this.bluBridgedDevices.forEach((blu) => {
              if (blu.serialNumber === bthomeDevice.addr + (this.postfix ? '-' + this.postfix : '')) {
                this.log.warn(`BLU device ${idn}${bthomeDevice.name}${rs}${wr} address ${CYAN}${bthomeDevice.addr}${wr} already registered with another ble gateway.`);
                definition = undefined;
              }
            });
            if (definition) {
              const mbDevice = new MatterbridgeDevice(definition, undefined, config.debug as boolean);
              mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
                bthomeDevice.name,
                bthomeDevice.addr + (this.postfix ? '-' + this.postfix : ''),
                0xfff1,
                'Shelly',
                bthomeDevice.model,
              );
              mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer();
              mbDevice.addRequiredClusterServers(mbDevice);
              mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer(); // TODO remove when fixed in Matterbridge
              if (bthomeDevice.model === 'Shelly BLU DoorWindow') {
                mbDevice.addFixedLabel('composed', 'Sensor');
                mbDevice.addChildDeviceTypeWithClusterServer('Contact', [DeviceTypes.CONTACT_SENSOR]);
                mbDevice.addChildDeviceTypeWithClusterServer('Illuminance', [DeviceTypes.LIGHT_SENSOR]);
              } else if (bthomeDevice.model === 'Shelly BLU Motion') {
                mbDevice.addFixedLabel('composed', 'Sensor');
                mbDevice.addChildDeviceTypeWithClusterServer('Motion', [DeviceTypes.OCCUPANCY_SENSOR]);
                mbDevice.addChildDeviceTypeWithClusterServer('Illuminance', [DeviceTypes.LIGHT_SENSOR]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button', [DeviceTypes.GENERIC_SWITCH]);
              } else if (bthomeDevice.model === 'Shelly BLU HT') {
                mbDevice.addFixedLabel('composed', 'Sensor');
                mbDevice.addChildDeviceTypeWithClusterServer('Temperature', [DeviceTypes.TEMPERATURE_SENSOR]);
                mbDevice.addChildDeviceTypeWithClusterServer('Humidity', [DeviceTypes.HUMIDITY_SENSOR]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button', [DeviceTypes.GENERIC_SWITCH]);
              } else if (bthomeDevice.model === 'Shelly BLU RC Button 4') {
                mbDevice.addFixedLabel('composed', 'Input');
                mbDevice.addChildDeviceTypeWithClusterServer('Button0', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button1', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button2', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button3', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
              } else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') {
                mbDevice.addFixedLabel('composed', 'Input');
                mbDevice.addChildDeviceTypeWithClusterServer('Button0', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button1', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button2', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
                mbDevice.addChildDeviceTypeWithClusterServer('Button3', [DeviceTypes.GENERIC_SWITCH], [Switch.Cluster.id]);
              } else if (bthomeDevice.model === 'Shelly BLU Trv') {
                mbDevice.createDefaultPowerSourceReplaceableBatteryClusterServer(100, PowerSource.BatChargeLevel.Ok, 3000, 'Type AA', 2);
                mbDevice.setAttribute(
                  ThermostatCluster.id,
                  'featureMap',
                  { heating: true, cooling: false, occupancy: false, scheduleConfiguration: false, setback: false, autoMode: false, localTemperatureNotExposed: false },
                  mbDevice.log,
                );
                mbDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat, mbDevice.log);
                mbDevice.setAttribute(ThermostatCluster.id, 'controlSequenceOfOperation', Thermostat.ControlSequenceOfOperation.HeatingOnly, mbDevice.log);
                mbDevice.setAttribute(ThermostatCluster.id, 'thermostatRunningMode', Thermostat.ThermostatRunningMode.Heat, mbDevice.log);
                mbDevice.setAttribute(ThermostatCluster.id, 'minHeatSetpointLimit', 4 * 100, mbDevice.log);
                mbDevice.setAttribute(ThermostatCluster.id, 'maxHeatSetpointLimit', 30 * 100, mbDevice.log);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (mbDevice.getClusterServerById(ThermostatCluster.id)?.attributes['absMinHeatSetpointLimit'] as any).value = 400;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (mbDevice.getClusterServerById(ThermostatCluster.id)?.attributes['absMaxHeatSetpointLimit'] as any).value = 3000;
                mbDevice.subscribeAttribute(
                  ThermostatCluster.id,
                  'systemMode',
                  (newValue, oldValue) => {
                    mbDevice.log.info(`Thermostat systemMode changed from ${oldValue} to ${newValue}`);
                    if (oldValue === Thermostat.SystemMode.Heat && newValue === Thermostat.SystemMode.Off) {
                      if (device.thermostatSystemModeTimeout) clearTimeout(device.thermostatSystemModeTimeout);
                      device.thermostatSystemModeTimeout = setTimeout(() => {
                        mbDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat, mbDevice.log);
                      }, 5000);
                    }
                  },
                  mbDevice.log,
                );
                mbDevice.subscribeAttribute(
                  ThermostatCluster.id,
                  'occupiedHeatingSetpoint',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (newValue: any, oldValue: any) => {
                    mbDevice.log.info(`Thermostat occupiedHeatingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                    if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                    device.thermostatSetpointTimeout = setTimeout(() => {
                      mbDevice.log.info(`Setting thermostat occupiedHeatingSetpoint to ${newValue / 100}`);
                      ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'BluTrv.Call', {
                        id: bthomeDevice.blutrv_id,
                        method: 'Trv.SetTarget',
                        params: { id: 0, target_C: newValue / 100 },
                      });
                    }, 5000);
                  },
                  mbDevice.log,
                );
              }
              try {
                await this.registerDevice(mbDevice);
                this.bluBridgedDevices.set(key, mbDevice);
                mbDevice.log.logName = `${bthomeDevice.name}`;
              } catch (error) {
                this.log.error(
                  `Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} failed to register BLU device ${idn}${bthomeDevice.name}${er}: ${error instanceof Error ? error.message : error}`,
                );
              }
            }
          }
          // BLU observer device updates
          device.on('bthomedevice_update', (addr: string, rssi: number, packet_id: number, last_updated_ts: number) => {
            if (!isValidString(addr, 11) || !isValidNumber(rssi, -100, 0) || !isValidNumber(packet_id, 0) || !isValidNumber(last_updated_ts)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer device update message for BLU device ${idn}${blu?.deviceName ?? addr}${rs}${db}: rssi ${YELLOW}${rssi}${db} packet_id ${YELLOW}${packet_id}${db} last_updated ${YELLOW}${device.getLocalTimeFromLastUpdated(last_updated_ts)}${db}`,
            );
          });
          // BLU observer sensor updates
          device.on('bthomesensor_update', (addr: string, sensorName: string, sensorIndex: number, value: ShellyDataType) => {
            if (!isValidString(addr, 11) || !isValidString(sensorName, 6) || !isValidNumber(sensorIndex, 0, 3)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer sensor update message for BLU device ${idn}${blu.deviceName ?? addr}${rs}${db}: sensor ${YELLOW}${sensorName}${db} index ${YELLOW}${sensorIndex}${db} value ${YELLOW}${value}${db}`,
            );
            if (blu && sensorName === 'Battery' && isValidNumber(value, 0, 100)) {
              blu.setAttribute(PowerSourceCluster.id, 'batPercentRemaining', value * 2, blu.log);
              if (value < 10) blu.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, blu.log);
              else if (value < 20) blu.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, blu.log);
              else blu.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, blu.log);
            }
            if (blu && sensorName === 'Temperature' && isValidNumber(value, -100, 100)) {
              if (bthomeDevice.model === 'Shelly BLU Trv' && sensorIndex === 0) blu.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', value * 100, blu.log);
              else if (bthomeDevice.model === 'Shelly BLU Trv' && sensorIndex === 1) blu.setAttribute(ThermostatCluster.id, 'localTemperature', value * 100, blu.log);
              else {
                const child = blu.getChildEndpointByName('Temperature');
                blu.setAttribute(TemperatureMeasurementCluster.id, 'measuredValue', value * 100, blu.log, child);
              }
            }
            if (blu && sensorName === 'Humidity' && isValidNumber(value, 0, 100)) {
              const child = blu.getChildEndpointByName('Humidity');
              blu.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', value * 100, blu.log, child);
            }
            if (blu && sensorName === 'Illuminance' && isValidNumber(value, 0, 10000)) {
              const child = blu.getChildEndpointByName('Illuminance');
              const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
              blu.setAttribute(IlluminanceMeasurementCluster.id, 'measuredValue', matterLux, blu.log, child);
            }
            if (blu && sensorName === 'Motion' && isValidBoolean(value)) {
              const child = blu.getChildEndpointByName('Motion');
              blu.setAttribute(OccupancySensingCluster.id, 'occupancy', { occupied: value }, blu.log, child);
            }
            if (blu && sensorName === 'Contact' && isValidBoolean(value)) {
              const child = blu.getChildEndpointByName('Contact');
              blu.setAttribute(BooleanStateCluster.id, 'stateValue', !value, blu.log, child);
            }
          });

          // BLU observer sensor events
          device.on('bthome_event', (event: string) => {
            if (!isValidString(event)) return;
            if (event === 'device_discovered') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} discovered a new BLU device`);
            }
            if (event === 'discovery_done') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} discovery done`);
            }
            if (event === 'associations_done') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} paired a new BLU device`);
            }
          });
          device.on('bthomedevice_event', (addr: string, event: string) => {
            if (!isValidString(addr, 11) || !isValidString(event, 6)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(`${idn}BLU${rs}${db} observer device event message for BLU device ${idn}${blu?.deviceName ?? addr}${rs}${db}: event ${YELLOW}${event}${db}`);
            if (event === 'ota_begin') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is starting OTA`);
            }
            if (event === 'ota_progress') {
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} OTA is progressing`);
            }
            if (event === 'ota_success') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} finished succesfully OTA`);
            }
          });
          device.on('bthomesensor_event', (addr: string, sensorName: string, sensorIndex: number, event: string) => {
            if (!isValidString(addr, 11) || !isValidString(sensorName, 6) || !isValidNumber(sensorIndex, 0, 3) || !isValidString(event, 6)) return;
            const blu = this.bluBridgedDevices.get(addr);
            const bthomeDevice = device.bthomeDevices.get(addr);
            if (!blu || !bthomeDevice) {
              this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} sent an unknown BLU device address ${CYAN}${addr}${er}`);
              return;
            }
            blu.log.info(
              `${idn}BLU${rs}${db} observer sensor event message for BLU device ${idn}${blu?.deviceName ?? addr}${rs}${db}: sensor ${YELLOW}${sensorName}${db} index ${YELLOW}${sensorIndex}${db} event ${YELLOW}${event}${db}`,
            );
            let child = undefined;
            if (bthomeDevice.model === 'Shelly BLU RC Button 4') {
              child = blu.getChildEndpointByName('Button' + sensorIndex);
            } else if (bthomeDevice.model === 'Shelly BLU Wall Switch 4') {
              child = blu.getChildEndpointByName('Button' + sensorIndex);
            } else {
              child = blu.getChildEndpointByName('Button');
            }
            if (sensorName === 'Button' && isValidString(event, 9)) {
              if (event === 'single_push') {
                blu.triggerSwitchEvent('Single', blu.log, child);
              }
              if (event === 'double_push') {
                blu.triggerSwitchEvent('Double', blu.log, child);
              }
              if (event === 'long_push') {
                blu.triggerSwitchEvent('Long', blu.log, child);
              }
            }
          });
        }
      }

      // Create a new Matterbridge device
      const mbDevice = new MatterbridgeDevice(bridgedNode, undefined, config.debug as boolean);
      mbDevice.createDefaultBridgedDeviceBasicInformationClusterServer(
        device.name,
        device.id + (this.postfix ? '-' + this.postfix : ''),
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
        if (component.name === 'Sys') {
          component.on('event', (component: string, event: string) => {
            this.log.debug(`Received event ${event} from component ${component}`);
            if (event === 'scheduled_restart') {
              this.changedDevices.set(device.id, device.id);
              device.log.notice(`Shelly device ${idn}${device.name}${rs}${nt} id ${hk}${device.id}${nt} host ${zb}${device.host}${nt} is restarting`);
            }
          });
        } else if (component.name === 'Light' || component.name === 'Rgb') {
          const lightComponent = device.getComponent(key);
          if (isLightComponent(lightComponent)) {
            // Set the device type and clusters based on the light component properties
            let deviceType = DeviceTypes.ON_OFF_LIGHT;
            const clusterIds: ClusterId[] = [OnOff.Cluster.id];
            if (lightComponent.hasProperty('brightness')) {
              deviceType = DeviceTypes.DIMMABLE_LIGHT;
              clusterIds.push(LevelControl.Cluster.id);
            }
            if (
              (lightComponent.hasProperty('red') && lightComponent.hasProperty('green') && lightComponent.hasProperty('blue') && device.profile !== 'white') ||
              lightComponent.hasProperty('rgb')
            ) {
              deviceType = DeviceTypes.COLOR_TEMPERATURE_LIGHT;
              clusterIds.push(ColorControl.Cluster.id);
            }
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], clusterIds);
            mbDevice.configureColorControlCluster(true, false, false, ColorControl.ColorMode.CurrentHueAndCurrentSaturation, child);

            // Add the electrical measurementa cluster on the same endpoint
            this.addElectricalMeasurements(mbDevice, child, device, lightComponent);

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
          const switchComponent = device.getComponent(key);
          if (switchComponent) {
            let deviceType = onOffSwitch;
            if (config.exposeSwitch === 'light') deviceType = onOffLight;
            if (config.exposeSwitch === 'outlet') deviceType = onOffOutlet;
            if (config.switchList && (config.switchList as string[]).includes(device.id)) deviceType = onOffSwitch;
            if (config.lightList && (config.lightList as string[]).includes(device.id)) deviceType = onOffLight;
            if (config.outletList && (config.outletList as string[]).includes(device.id)) deviceType = onOffOutlet;
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [deviceType], [OnOff.Cluster.id]);

            // Add the electrical measurementa cluster on the same endpoint
            this.addElectricalMeasurements(mbDevice, child, device, switchComponent);

            /*
            // Set the OnOff attribute
            const state = switchComponent.getValue('state');
            if (isValidBoolean(state)) child.getClusterServer(OnOffCluster)?.setOnOffAttribute(state);
            */

            // Add command handlers
            mbDevice.addCommandHandler('on', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'On', true);
            });
            mbDevice.addCommandHandler('off', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'Off', false);
            });
            mbDevice.addCommandHandler('toggle', async (data) => {
              this.shellyLightCommandHandler(mbDevice, data.endpoint.number, device, 'Toggle', false);
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

            // Add the electrical measurementa cluster on the same endpoint
            this.addElectricalMeasurements(mbDevice, child, device, coverComponent);

            // Set the WindowCovering attributes
            /*
            "positioning": true, // Gen 1 devices when positioning control is enabled (even if it is not calibrated)
            "pos_control": true, // Gen 2 devices
            "current_pos": 0 // Gen 1 and 2 devices 0-100
            const position = coverComponent.hasProperty('current_pos') ? coverComponent.getValue('current_pos') : undefined;
            if (isValidNumber(position, 0, 100)) {
              const matterPos = 10000 - Math.min(Math.max(Math.round(position * 100), 0), 10000);
              child.getClusterServer(WindowCovering.Complete)?.setCurrentPositionLiftPercent100thsAttribute(matterPos);
            }
            mbDevice.setWindowCoveringTargetAsCurrentAndStopped(child);
            */

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
            if (config.exposePowerMeter === 'matter13') {
              // Add the Matter 1.3 electricalSensor device type with the ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [electricalSensor], [ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id]);

              device.log.debug(
                `Added ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters to endpoint ${hk}${child.name}${db} component ${hk}${component.name}:${component.id}${db}`,
              );

              // Update the electrical attributes
              for (const property of component.properties) {
                if (!['voltage', 'current', 'power', 'apower', 'act_power', 'total', 'aenergy'].includes(property.key)) continue;
                this.shellyUpdateHandler(mbDevice, device, component.id, property.key, property.value);
              }
            }
            // Add event handler
            pmComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Input') {
          const inputComponent = device.getComponent(key);
          // Skip the input component if it is disabled in Gen 2/3 devices
          if (inputComponent && inputComponent?.hasProperty('enable') && inputComponent?.getValue('enable') === false) continue;

          if (
            inputComponent &&
            inputComponent?.hasProperty('state') &&
            (config.exposeInput === 'contact' || (config.exposeInput === 'disabled' && config.inputContactList && (config.inputContactList as string[]).includes(device.id)))
          ) {
            const state = inputComponent.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
              // Set the state attribute
              child.getClusterServer(BooleanStateCluster)?.setStateValueAttribute(state);
              // Add event handler
              inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
                this.shellyUpdateHandler(mbDevice, device, component, property, value);
              });
            }
          } else if (
            inputComponent &&
            inputComponent?.hasProperty('state') &&
            (config.exposeInput === 'momentary' || (config.exposeInput === 'disabled' && config.inputMomentaryList && (config.inputMomentaryList as string[]).includes(device.id)))
          ) {
            const state = inputComponent.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
              child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
              // Add event handler
              inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
                this.shellyUpdateHandler(mbDevice, device, component, property, value);
              });
            }
          } else if (
            inputComponent &&
            inputComponent?.hasProperty('state') &&
            (config.exposeInput === 'latching' || (config.exposeInput === 'disabled' && config.inputLatchingList && (config.inputLatchingList as string[]).includes(device.id)))
          ) {
            const state = inputComponent.getValue('state') as boolean;
            if (isValidBoolean(state)) {
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
              child.addClusterServer(mbDevice.getDefaultLatchingSwitchClusterServer());
              // Add event handler
              inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
                this.shellyUpdateHandler(mbDevice, device, component, property, value);
              });
            }
          } else if (
            inputComponent &&
            inputComponent?.hasProperty('event') &&
            (config.exposeInputEvent !== 'disabled' || (config.inputEventList && (config.inputEventList as string[]).includes(device.id)))
          ) {
            // Gen 1 devices
            const event = inputComponent.getValue('event') as boolean;
            if (isValidString(event)) {
              const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
              child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
              // Add event handler
              inputComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
                this.shellyUpdateHandler(mbDevice, device, component, property, value);
              });
            }
          }
          if (
            component &&
            component.hasProperty('state') &&
            component.getValue('state') === null &&
            component.hasProperty('type') &&
            component.getValue('type') === 'button' &&
            (config.exposeInputEvent !== 'disabled' || (config.inputEventList && (config.inputEventList as string[]).includes(device.id)))
          ) {
            // Gen 2/3 devices with Input type=button
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
            device.log.info(`Add device event handler for device ${idn}${device.id}${rs} component ${hk}${component.id}${db} type Button`);
            component.on('event', (component: string, event: string) => {
              if (isValidString(component, 7) && isValidString(event, 9, 11) && device.getComponent(component)) {
                device.log.info(`${db}Shelly event ${hk}${component}${db}:${zb}${event}${db} for device ${idn}${device.id}${rs}${db}`);
                const endpoint = mbDevice.getChildEndpointByName(component);
                if (!endpoint) {
                  device.log.error(`getChildEndpointByName(${component}) for device ${idn}${device.id}${rs} failed`);
                  return;
                }
                if (event === 'single_push') mbDevice.triggerSwitchEvent('Single', device.log, endpoint);
                if (event === 'double_push') mbDevice.triggerSwitchEvent('Double', device.log, endpoint);
                if (event === 'long_push') mbDevice.triggerSwitchEvent('Long', device.log, endpoint);
              }
            });
          }
        } else if (component.name === 'Sensor' && config.exposeSensor !== 'disabled') {
          const sensorComponent = device.getComponent(key);
          if (sensorComponent?.hasProperty('contact_open') && config.exposeContact !== 'disabled') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(sensorComponent.getValue('contact_open') === false));
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
          if (sensorComponent?.hasProperty('motion') && config.exposeMotion !== 'disabled') {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.OCCUPANCY_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultOccupancySensingClusterServer(sensorComponent.getValue('motion') === true));
            // Add event handler
            sensorComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Vibration' && config.exposeVibration !== 'disabled') {
          const vibrationComponent = device.getComponent(key);
          if (vibrationComponent?.hasProperty('vibration') && isValidBoolean(vibrationComponent.getValue('vibration'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.GENERIC_SWITCH], []);
            child.addClusterServer(mbDevice.getDefaultSwitchClusterServer());
            // Add event handler
            vibrationComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Temperature' && config.exposeTemperature !== 'disabled') {
          const tempComponent = device.getComponent(key);
          if (tempComponent?.hasProperty('value') && isValidNumber(tempComponent.getValue('value'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.TEMPERATURE_SENSOR], []);
            const matterTemp = Math.min(Math.max(Math.round((tempComponent.getValue('value') as number) * 100), -10000), 10000);
            child.addClusterServer(mbDevice.getDefaultTemperatureMeasurementClusterServer(matterTemp));
            // Add event handler
            tempComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
          if (tempComponent?.hasProperty('tC') && isValidNumber(tempComponent.getValue('tC'), -100, 100)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.TEMPERATURE_SENSOR], []);
            const matterTemp = Math.min(Math.max(Math.round((tempComponent.getValue('tC') as number) * 100), -10000), 10000);
            child.addClusterServer(mbDevice.getDefaultTemperatureMeasurementClusterServer(matterTemp));
            // Add event handler
            tempComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Humidity' && config.exposeHumidity !== 'disabled') {
          const humidityComponent = device.getComponent(key);
          if (humidityComponent?.hasProperty('rh') && isValidNumber(humidityComponent.getValue('rh'), 0, 100)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.HUMIDITY_SENSOR], []);
            const matterHumidity = Math.min(Math.max(Math.round((humidityComponent.getValue('rh') as number) * 100), -10000), 10000);
            child.addClusterServer(mbDevice.getDefaultRelativeHumidityMeasurementClusterServer(matterHumidity));
            // Add event handler
            humidityComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Illuminance' && config.exposeIlluminance !== 'disabled') {
          const illuminanceComponent = device.getComponent(key);
          if (illuminanceComponent?.hasProperty('lux') && isValidNumber(illuminanceComponent.getValue('lux'), 0, 10000)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.LIGHT_SENSOR], []);
            const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(illuminanceComponent.getValue('lux') as number), 0xfffe), 0));
            child.addClusterServer(mbDevice.getDefaultIlluminanceMeasurementClusterServer(matterLux));
            // Add event handler
            illuminanceComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Thermostat' && config.exposeThermostat !== 'disabled') {
          const thermostatComponent = device.getComponent(key);
          if (
            thermostatComponent?.hasProperty('enable') &&
            thermostatComponent?.hasProperty('type') &&
            thermostatComponent?.hasProperty('target_C') &&
            thermostatComponent?.hasProperty('current_C') &&
            isValidBoolean(thermostatComponent.getValue('enable')) &&
            isValidString(thermostatComponent.getValue('type')) &&
            isValidNumber(thermostatComponent.getValue('target_C'), 5, 35) &&
            isValidNumber(thermostatComponent.getValue('current_C'), 5, 35)
          ) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.THERMOSTAT], []);
            mbDevice.setAttribute(
              ThermostatCluster.id,
              'featureMap',
              {
                heating: thermostatComponent.getValue('type') === 'heating',
                cooling: thermostatComponent.getValue('type') === 'cooling',
                occupancy: false,
                scheduleConfiguration: false,
                setback: false,
                autoMode: false,
                localTemperatureNotExposed: false,
              },
              mbDevice.log,
              child,
            );
            if (thermostatComponent.getValue('type') === 'heating') {
              mbDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'thermostatRunningMode', Thermostat.ThermostatRunningMode.Heat, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'controlSequenceOfOperation', Thermostat.ControlSequenceOfOperation.HeatingOnly, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', (thermostatComponent.getValue('target_C') as number) * 100, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'minHeatSetpointLimit', 5 * 100, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'maxHeatSetpointLimit', 35 * 100, mbDevice.log, child);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child.getClusterServerById(ThermostatCluster.id)?.attributes['absMinHeatSetpointLimit'] as any).value = 500;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child.getClusterServerById(ThermostatCluster.id)?.attributes['absMaxHeatSetpointLimit'] as any).value = 3500;
            }
            if (thermostatComponent.getValue('type') === 'cooling') {
              mbDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Cool, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'thermostatRunningMode', Thermostat.ThermostatRunningMode.Cool, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'controlSequenceOfOperation', Thermostat.ControlSequenceOfOperation.CoolingOnly, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'occupiedCoolingSetpoint', (thermostatComponent.getValue('target_C') as number) * 100, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'minCoolSetpointLimit', 5 * 100, mbDevice.log, child);
              mbDevice.setAttribute(ThermostatCluster.id, 'maxCoolSetpointLimit', 35 * 100, mbDevice.log, child);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child.getClusterServerById(ThermostatCluster.id)?.attributes['absMinCoolSetpointLimit'] as any).value = 500;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (child.getClusterServerById(ThermostatCluster.id)?.attributes['absMaxCoolSetpointLimit'] as any).value = 3500;
            }
            if (thermostatComponent.getValue('enable') === false) mbDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Off, mbDevice.log, child);

            mbDevice.setAttribute(ThermostatCluster.id, 'localTemperature', (thermostatComponent.getValue('current_C') as number) * 100, mbDevice.log, child);
            mbDevice.subscribeAttribute(
              ThermostatCluster.id,
              'systemMode',
              (newValue, oldValue) => {
                mbDevice.log.info(`Thermostat systemMode changed from ${oldValue} to ${newValue}`);
                if (oldValue !== newValue) {
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
              child,
            );
            mbDevice.subscribeAttribute(
              ThermostatCluster.id,
              'occupiedHeatingSetpoint',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (newValue: any, oldValue: any) => {
                mbDevice.log.info(`Thermostat occupiedHeatingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                device.thermostatSetpointTimeout = setTimeout(() => {
                  mbDevice.log.info(`Setting thermostat occupiedCoolingSetpoint to ${newValue / 100}`);
                  ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, target_C: newValue / 100 } });
                }, 5000);
              },
              mbDevice.log,
              child,
            );
            mbDevice.subscribeAttribute(
              ThermostatCluster.id,
              'occupiedCoolingSetpoint',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (newValue: any, oldValue: any) => {
                mbDevice.log.info(`Thermostat occupiedCoolingSetpoint changed from ${oldValue / 100} to ${newValue / 100}`);
                if (device.thermostatSetpointTimeout) clearTimeout(device.thermostatSetpointTimeout);
                device.thermostatSetpointTimeout = setTimeout(() => {
                  mbDevice.log.info(`Setting thermostat occupiedCoolingSetpoint to ${newValue / 100}`);
                  ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Thermostat.SetConfig', { config: { id: 0, target_C: newValue / 100 } });
                }, 5000);
              },
              mbDevice.log,
              child,
            );
            // Add event handler
            thermostatComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Flood' && config.exposeFlood !== 'disabled') {
          const floodComponent = device.getComponent(key);
          if (floodComponent?.hasProperty('flood') && isValidBoolean(floodComponent.getValue('flood'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(!(floodComponent.getValue('flood') as boolean)));
            // Add event handler
            floodComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Gas' && config.exposeGas !== 'disabled') {
          const gasComponent = device.getComponent(key);
          if (gasComponent?.hasProperty('sensor_state') && isValidString(gasComponent.getValue('alarm_state'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(gasComponent.getValue('alarm_state') === 'none'));
            // Add event handler
            gasComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Smoke' && config.exposeSmoke !== 'disabled') {
          const smokeComponent = device.getComponent(key);
          if (smokeComponent?.hasProperty('alarm') && isValidBoolean(smokeComponent.getValue('alarm'))) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.CONTACT_SENSOR], []);
            child.addClusterServer(mbDevice.getDefaultBooleanStateClusterServer(!smokeComponent.getValue('alarm') as boolean));
            // Add event handler
            smokeComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Lux' && config.exposeLux !== 'disabled') {
          const luxComponent = device.getComponent(key);
          if (luxComponent?.hasProperty('value') && isValidNumber(luxComponent.getValue('value'), 0)) {
            const child = mbDevice.addChildDeviceTypeWithClusterServer(key, [DeviceTypes.LIGHT_SENSOR], []);
            const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(luxComponent.getValue('value') as number), 0xfffe), 0));
            child.addClusterServer(mbDevice.getDefaultIlluminanceMeasurementClusterServer(matterLux));
            // Add event handler
            luxComponent.on('update', (component: string, property: string, value: ShellyDataType) => {
              this.shellyUpdateHandler(mbDevice, device, component, property, value);
            });
          }
        } else if (component.name === 'Blugw' && config.exposeBlugw !== 'disabled') {
          const blugwComponent = device.getComponent(key);
          if (blugwComponent?.hasProperty('sys_led_enable') && isValidBoolean(blugwComponent.getValue('sys_led_enable'))) {
            mbDevice.addClusterServer(
              mbDevice.getDefaultModeSelectClusterServer(
                'System LED',
                [
                  { label: 'disabled', mode: 0, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 0 }] },
                  { label: 'enabled', mode: 1, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 1 }] },
                ],
                blugwComponent.getValue('sys_led_enable') ? 1 : 0,
                blugwComponent.getValue('sys_led_enable') ? 1 : 0,
              ),
            );
            // Add command handlers
            mbDevice.addCommandHandler('changeToMode', async (data) => {
              if (isValidObject(data, 4) && isValidNumber(data.request.newMode, 0, 1))
                await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Blugw.SetConfig', { config: { sys_led_enable: data.request.newMode === 1 } });
            });
            // Add event handler
            blugwComponent.on('event', async (component: string, event: string) => {
              if (isValidString(component, 5) && isValidString(event, 14) && component === 'blugw' && event === 'config_changed') {
                const blugw = await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Blugw.GetConfig');
                if (isValidObject(blugw, 1) && isValidBoolean(blugw.sys_led_enable))
                  mbDevice.setAttribute(ModeSelectCluster.id, 'currentMode', blugw.sys_led_enable ? 1 : 0, mbDevice.log);
              }
            });
          }
        } /* else if (component.name === 'Ble' && config.exposeBle !== 'disabled') {
          const bleComponent = device.getComponent(key);
          if (bleComponent?.hasProperty('enable') && isValidBoolean(bleComponent.getValue('enable'))) {
            mbDevice.addClusterServer(
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
              if (isValidObject(data, 4) && isValidNumber(data.request.newMode, 0, 1))
                await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Ble.SetConfig', { config: { enable: data.request.newMode === 1 } });
            });
            // Add event handler
            bleComponent.on('event', async (component: string, event: string) => {
              if (isValidString(component, 3) && isValidString(event, 14) && component === 'ble' && event === 'config_changed') {
                const ble = await ShellyDevice.fetch(this.shelly, mbDevice.log, device.host, 'Ble.GetConfig');
                if (isValidObject(ble, 1) && isValidBoolean(ble.enable)) mbDevice.setAttribute(ModeSelectCluster.id, 'currentMode', ble.enable ? 1 : 0, mbDevice.log);
              }
            });
          }
        }*/
      }
      // Check if we have a device to register with Matterbridge
      const endpoints = mbDevice.getChildEndpoints();
      if (endpoints.length > 1 || (device.hasComponent('blugw') && config.exposeBlugw !== 'disabled')) {
        try {
          // Register the device with Matterbridge
          await this.registerDevice(mbDevice);
          // Save the MatterbridgeDevice in the bridgedDevices map
          this.bridgedDevices.set(device.id, mbDevice);
        } catch (error) {
          this.log.error(`Shelly device ${hk}${device.id}${er} host ${zb}${device.host}${er} failed to register with Matterbridge: ${error}`);
        }
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

    // Reset the storage if requested
    if (this.config.resetStorageDiscover === true) {
      this.config.resetStorageDiscover = false;

      this.log.info('Resetting the Shellies cache...');
      const storedDevices = await this.nodeStorage.get<DiscoveredDevice[]>('DeviceIdentifiers', []);
      for (const device of storedDevices) {
        const fileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${device.id}.json`);
        try {
          this.log.debug(`Deleting cache file: ${fileName}`);
          fs.unlinkSync(fileName);
          this.log.debug(`Deleted cache file: ${fileName}`);
        } catch (error) {
          this.log.error(`Failed to delete cache for device ${device} file ${fileName} error: ${error}`);
        }
      }

      this.log.info('Resetting the Shellies storage...');
      await this.nodeStorage.clear();
      this.storedDevices.clear();
      await this.saveStoredDevices();
      this.log.info('Reset of Shellies storage done!');
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
        if (storedDevice.id === undefined || storedDevice.host === undefined || !isValidIpv4Address(storedDevice.host)) {
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
    if (this.config.enableConfigDiscover === true && isValidObject(this.config.deviceIp)) {
      this.log.info(`Loading from config ${Object.entries(this.config.deviceIp as ConfigDeviceIp).length} Shelly devices`);
      Object.entries(this.config.deviceIp as ConfigDeviceIp).forEach(async ([id, host]) => {
        id = ShellyDevice.normalizeId(id).id;
        const configDevice: DiscoveredDevice = { id, host, port: 0, gen: 0 };
        if (configDevice.id === undefined || configDevice.host === undefined || !isValidIpv4Address(configDevice.host)) {
          this.log.error(`Config Shelly device id ${hk}${configDevice.id}${er} host ${zb}${configDevice.host}${er} is not valid. Please check the plugin config and restart.`);
          return;
        }
        this.log.debug(`Loading from config Shelly device ${hk}${configDevice.id}${db} host ${zb}${configDevice.host}${db}`);
        this.shelly.emit('discovered', configDevice);
      });
    }

    // Wait for the failsafe count to be met
    if (this.failsafeCount > 0) {
      this.log.notice(`Waiting for the configured number of ${this.failsafeCount} devices to be loaded.`);
      /* prettier-ignore */
      const isSafe = await waiter('failsafeCount', () => this.bridgedDevices.size + this.bluBridgedDevices.size >= this.failsafeCount, false, 55000, 1000, this.config.debug as boolean);
      if (!isSafe) {
        throw new Error(
          `The plugin did not add the configured number of ${this.failsafeCount} devices. Registered ${this.bridgedDevices.size + this.bluBridgedDevices.size} devices.`,
        );
      }
    }
  }

  override async onConfigure() {
    this.log.info(`Configuring platform ${idn}${this.config.name}${rs}${nf}`);
    this.bridgedDevices.forEach(async (mbDevice) => {
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
      mbDevice.getChildEndpoints().forEach(async (childEndpoint) => {
        const label = childEndpoint.uniqueStorageKey;
        // Configure the cluster OnOff attribute onOff
        if (label?.startsWith('switch') || label?.startsWith('relay') || label?.startsWith('light') || label?.startsWith('rgb')) {
          const switchComponent = shellyDevice.getComponent(label) as ShellySwitchComponent;
          this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}state ${YELLOW}${switchComponent.getValue('state')}${nf}`);
          const state = switchComponent.getValue('state');
          if (isValidBoolean(state)) {
            mbDevice.setAttribute(OnOffCluster.id, 'onOff', state, shellyDevice.log, childEndpoint);
          }
        }
        // Configure the cluster LevelControl attribute currentLevel
        if (label?.startsWith('light') || label?.startsWith('rgb')) {
          const lightComponent = shellyDevice.getComponent(label) as ShellyLightComponent;
          const level = lightComponent.getValue('brightness') as number;
          if (isValidNumber(level, 0, 100)) {
            const matterLevel = Math.max(Math.min(Math.round((level / 100) * 255), 255), 0);
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}brightness ${YELLOW}${matterLevel}${nf}`);
            mbDevice.setAttribute(LevelControlCluster.id, 'currentLevel', matterLevel, shellyDevice.log, childEndpoint);
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
              if (isValidNumber(hue, 0, 254)) mbDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, childEndpoint);
              if (isValidNumber(saturation, 0, 254)) mbDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, childEndpoint);
              mbDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, childEndpoint);
            }
          }
          if (lightComponent.hasProperty('rgb') && shellyDevice.profile !== 'white') {
            const rgb = lightComponent.getValue('rgb') as object;
            if (isValidArray(rgb, 3, 3) && isValidNumber(rgb[0], 0, 255) && isValidNumber(rgb[1], 0, 255) && isValidNumber(rgb[2], 0, 255)) {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}rgb ${YELLOW}${rgb[0]},${rgb[1]},${rgb[2]}${nf}`);
              const hsl = rgbColorToHslColor({ r: rgb[0], g: rgb[1], b: rgb[2] });
              this.log.debug(`ColorRgbToHsl: R:${rgb[0]} G:${rgb[1]} B:${rgb[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
              const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
              const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
              if (isValidNumber(hue, 0, 254)) mbDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, childEndpoint);
              if (isValidNumber(saturation, 0, 254)) mbDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, childEndpoint);
              mbDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, childEndpoint);
            }
          }
        }
        // Configure the cluster WindowCovering attribute currentPositionLiftPercent100ths
        if (label?.startsWith('cover') || label?.startsWith('roller')) {
          const coverComponent = shellyDevice.getComponent(label) as ShellyCoverComponent;
          const position = coverComponent.hasProperty('current_pos') ? (coverComponent.getValue('current_pos') as number) : undefined;
          if (isValidNumber(position, 0, 100)) {
            this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}current_pos ${YELLOW}${position}${nf}`);
            const matterPos = 10000 - Math.min(Math.max(Math.round(position * 100), 0), 10000);
            mbDevice.setWindowCoveringCurrentTargetStatus(matterPos, matterPos, WindowCovering.MovementStatus.Stopped, childEndpoint);
          } else {
            mbDevice.setWindowCoveringTargetAsCurrentAndStopped(childEndpoint);
          }
        }
        // Configure the cluster Thermostat attribute occupiedHeatingSetpoint occupiedCoolingSetpoint
        if (label?.startsWith('thermostat')) {
          const thermostatComponent = shellyDevice.getComponent(label) as ShellyCoverComponent;
          const target = thermostatComponent.hasProperty('target_C') ? (thermostatComponent.getValue('target_C') as number) : undefined;
          if (isValidNumber(target, 5, 35)) {
            if (thermostatComponent.getValue('type') === 'heating') {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}occupiedHeatingSetpoint ${YELLOW}${target}${nf}`);
              mbDevice.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', target * 100, shellyDevice.log, childEndpoint);
            } else if (thermostatComponent.getValue('type') === 'cooling') {
              this.log.info(`Configuring device ${dn}${mbDevice.deviceName}${nf} component ${hk}${label}${nf}:${zb}occupiedCoolingSetpoint ${YELLOW}${target}${nf}`);
              mbDevice.setAttribute(ThermostatCluster.id, 'occupiedCoolingSetpoint', target * 100, shellyDevice.log, childEndpoint);
            }
          }
        }
      });
      if (shellyDevice.bthomeDevices.size > 0) {
        shellyDevice.log.info(`Configuring BLE devices paired to ${hk}${shellyDevice.id}${nf}...`);
        shellyDevice.bthomeDevices.forEach(async (bthomeDevice) => {
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
    });
  }

  override async onShutdown(reason?: string) {
    this.log.info(`Shutting down platform ${idn}${this.config.name}${rs}${nf}: ${reason ?? ''}`);

    if (!this.nodeStorage) {
      this.log.error('NodeStorage is not initialized');
      return;
    }
    this.log.info(`Saving ${this.changedDevices.size} changed Shelly devices to the storage`);
    await this.nodeStorage.set<string[]>('ChangedDevices', Array.from(this.changedDevices.values()));

    this.shelly.destroy();

    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices();
  }

  override async onChangeLoggerLevel(logLevel: LogLevel) {
    this.log.debug(
      `Changing logger level for platform ${idn}${this.config.name}${rs}${db} to ${logLevel} with debugMdns ${this.config.debugMdns} and debugCoap ${this.config.debugCoap}`,
    );
    this.shelly.setLogLevel(logLevel, this.config.debugMdns as boolean, this.config.debugCoap as boolean, this.config.debugWs as boolean);
  }

  private addElectricalMeasurements(device: MatterbridgeDevice, endpoint: Endpoint | undefined, shelly: ShellyDevice, component: ShellyComponent) {
    if (!endpoint) {
      // this.log.info(`addElectricalMeasurements: endpoint is undefined`);
      return;
    }
    const updateProperties = () => {
      for (const property of component.properties) {
        if (!['voltage', 'current', 'power', 'apower', 'act_power', 'total', 'aenergy'].includes(property.key)) continue;
        /*
        shelly.log.info(
          `***Property ${property.key} value ${property.value !== null && typeof property.value === 'object' ? debugStringify(property.value as object) : property.value}${rs}`,
        );
        */
        this.shellyUpdateHandler(device, shelly, component.id, property.key, property.value);
      }
    };

    // Add the Matter 1.3 ElectricalPowerMeasurement and ElectricalEnergyMeasurement cluster on the same endpoint
    if (
      this.config.exposePowerMeter === 'matter13' &&
      (component.hasProperty('voltage') || component.hasProperty('current') || component.hasProperty('apower') || component.hasProperty('aenergy'))
    ) {
      shelly.log.debug(`Adding ElectricalPowerMeasurement and ElectricalEnergyMeasurement clusters to endpoint ${hk}${endpoint.name}${db} component ${hk}${component.id}${db}`);
      const deviceTypes = endpoint.getDeviceTypes();
      if (!deviceTypes.includes(electricalSensor)) deviceTypes.push(electricalSensor);
      endpoint.setDeviceTypes(deviceTypes);
      endpoint.addClusterServer(device.getDefaultPowerTopologyClusterServer());
      endpoint.addClusterServer(device.getDefaultElectricalPowerMeasurementClusterServer());
      endpoint.addClusterServer(device.getDefaultElectricalEnergyMeasurementClusterServer());
      updateProperties();
    }
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
    const fileName = path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly', `${deviceId}.json`);
    let device: ShellyDevice | undefined;

    let loadFromCache = true;
    if (['shellywalldisplay', 'shellyblugwg3'].includes(ShellyDevice.normalizeId(deviceId).type)) loadFromCache = false;
    if (isValidArray(this.config.nocacheList, 1) && this.config.nocacheList.includes(deviceId)) loadFromCache = false;

    if (loadFromCache && fs.existsSync(fileName)) {
      this.log.info(`*Loading from cache Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
      device = await ShellyDevice.create(this.shelly, log, fileName);
      if (device) {
        this.log.info(`*Loaded from cache Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
        device.setHost(host);
        device.cached = true;
        device.online = true;
      }
    } else {
      this.log.info(`*Creating Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
      device = await ShellyDevice.create(this.shelly, log, host);
      if (device) {
        this.log.info(`*Created Shelly device ${hk}${deviceId}${nf} host ${zb}${host}${nf}`);
        await device.saveDevicePayloads(path.join(this.matterbridge.matterbridgePluginDirectory, 'matterbridge-shelly'));
      }
    }
    if (!device) {
      this.log.error(`Failed to create Shelly device ${hk}${deviceId}${er} host ${zb}${host}${er}`);
      return;
    }
    log.logName = device.name ?? device.id;
    await this.shelly.addDevice(device);
    this.shellyDevices.set(device.id, device);
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
    const componentName = endpoint.uniqueStorageKey;
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
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}()${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);

    // Send Level() command
    if (command === 'Level' && isValidNumber(level, 0, 254)) {
      const shellyLevel = Math.max(Math.min(Math.round((level / 254) * 100), 100), 1);
      lightComponent.Level(shellyLevel);
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:Level(${YELLOW}${shellyLevel}${nf})${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
    }

    // Send ColorRGB() command
    if (command === 'ColorRGB' && isValidObject(color, 3, 3)) {
      color.r = Math.max(Math.min(color.r, 255), 0);
      color.g = Math.max(Math.min(color.g, 255), 0);
      color.b = Math.max(Math.min(color.b, 255), 0);
      lightComponent.ColorRGB(color.r, color.g, color.b);
      shellyDevice.log.info(
        `${db}Sent command ${hk}${componentName}${nf}:ColorRGB(${YELLOW}${color.r}${nf}, ${YELLOW}${color.g}${nf}, ${YELLOW}${color.b}${nf})${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`,
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
    const componentName = endpoint.uniqueStorageKey;
    if (!componentName) {
      shellyDevice.log.error(`shellyCoverCommandHandler error: componentName not found for shelly device ${dn}${shellyDevice?.id}${er}`);
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
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift /* , WindowCovering.Feature.AbsolutePosition*/),
    );
    if (!coverCluster) {
      shellyDevice.log.error('shellyCoverCommandHandler error: cluster WindowCoveringCluster not found');
      return false;
    }
    if (command === 'Stop') {
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}()${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
      coverComponent.Stop();
    } else if (command === 'Open') {
      matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', 0, shellyDevice.log, endpoint);
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}()${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
      coverComponent.Open();
    } else if (command === 'Close') {
      matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', 10000, shellyDevice.log, endpoint);
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}()${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
      coverComponent.Close();
    } else if (command === 'GoToPosition' && isValidNumber(pos, 0, 10000)) {
      matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', pos, shellyDevice.log, endpoint);
      const shellyPos = 100 - Math.max(Math.min(Math.round(pos / 100), 100), 0);
      shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}(${shellyPos})${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
      coverComponent.GoToPosition(shellyPos);
    }
    return true;
  }

  private shellyUpdateHandler(matterbridgeDevice: MatterbridgeDevice, shellyDevice: ShellyDevice, component: string, property: string, value: ShellyDataType) {
    const endpoint = matterbridgeDevice.getChildEndpointByName(component);
    if (!endpoint) return;
    const shellyComponent = shellyDevice.getComponent(component);
    if (!shellyComponent) return;
    shellyDevice.log.info(
      `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ` +
        `${hk}${shellyComponent.name}${db}:${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
    );
    // Update state
    if ((isLightComponent(shellyComponent) || isSwitchComponent(shellyComponent)) && property === 'state' && isValidBoolean(value)) {
      matterbridgeDevice.setAttribute(OnOffCluster.id, 'onOff', value, shellyDevice.log, endpoint);
    }
    // Update brightness
    if (isLightComponent(shellyComponent) && property === 'brightness' && isValidNumber(value, 0, 100)) {
      matterbridgeDevice.setAttribute(LevelControlCluster.id, 'currentLevel', Math.max(Math.min(Math.round((value / 100) * 255), 255), 0), shellyDevice.log, endpoint);
    }
    // Update color gen 1
    if (isLightComponent(shellyComponent) && ['red', 'green', 'blue'].includes(property) && isValidNumber(value, 0, 255)) {
      const red = property === 'red' ? value : (shellyComponent.getValue('red') as number);
      const green = property === 'green' ? value : (shellyComponent.getValue('green') as number);
      const blue = property === 'blue' ? value : (shellyComponent.getValue('blue') as number);
      const hsl = rgbColorToHslColor({ r: red, g: green, b: blue });
      this.log.debug(`ColorRgbToHsl: R:${red} G:${green} B:${blue} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
      if (shellyDevice.colorUpdateTimeout) clearTimeout(shellyDevice.colorUpdateTimeout);
      shellyDevice.colorUpdateTimeout = setTimeout(() => {
        const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
        const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
        if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, endpoint);
        if (isValidNumber(saturation, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, endpoint);
        matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, endpoint);
      }, 200);
    }
    // Update color gen 2/3
    if (
      isLightComponent(shellyComponent) &&
      property === 'rgb' &&
      isValidArray(value, 3, 3) &&
      isValidNumber(value[0], 0, 255) &&
      isValidNumber(value[1], 0, 255) &&
      isValidNumber(value[2], 0, 255)
    ) {
      const hsl = rgbColorToHslColor({ r: value[0], g: value[1], b: value[2] });
      this.log.debug(`ColorRgbToHsl: R:${value[0]} G:${value[1]} B:${value[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
      const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
      const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
      if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, endpoint);
      if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, endpoint);
      matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, endpoint);
    }
    // Update Input component with state
    if (shellyComponent.name === 'Input' && property === 'state' && isValidBoolean(value)) {
      if (
        this.config.exposeInput === 'contact' ||
        (this.config.exposeInput === 'disabled' && this.config.inputContactList && (this.config.inputContactList as string[]).includes(shellyDevice.id))
      ) {
        matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', value, shellyDevice.log, endpoint);
      }
      if (
        (this.config.exposeInput === 'momentary' ||
          (this.config.exposeInput === 'disabled' && this.config.inputMomentaryList && (this.config.inputMomentaryList as string[]).includes(shellyDevice.id))) &&
        value === true
      ) {
        matterbridgeDevice.triggerSwitchEvent('Single', shellyDevice.log, endpoint);
      }
      if (
        this.config.exposeInput === 'latching' ||
        (this.config.exposeInput === 'disabled' && this.config.inputLatchingList && (this.config.inputLatchingList as string[]).includes(shellyDevice.id))
      ) {
        matterbridgeDevice.triggerSwitchEvent(value ? 'Press' : 'Release', shellyDevice.log, endpoint);
      }
    }
    // Update Input component with event for Gen 1 devices
    if (shellyComponent.name === 'Input' && property === 'event_cnt' && isValidNumber(value) && shellyComponent.hasProperty('event')) {
      const event = shellyComponent.getValue('event');
      if (!isValidString(event, 1)) return;
      if (event === 'S') {
        matterbridgeDevice.triggerSwitchEvent('Single', shellyDevice.log, endpoint);
      }
      if (event === 'SS') {
        matterbridgeDevice.triggerSwitchEvent('Double', shellyDevice.log, endpoint);
      }
      if (event === 'L') {
        matterbridgeDevice.triggerSwitchEvent('Long', shellyDevice.log, endpoint);
      }
    }
    // Update for Battery
    if (shellyComponent.name === 'Battery' && property === 'level' && isValidNumber(value, 0, 100)) {
      matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batPercentRemaining', Math.min(Math.max(value * 2, 0), 200), shellyDevice.log, endpoint);
      if (value < 10) matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, shellyDevice.log, endpoint);
      else if (value < 20) matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, shellyDevice.log, endpoint);
      else matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, shellyDevice.log, endpoint);
    }
    if (shellyComponent.name === 'Battery' && property === 'voltage' && isValidNumber(value, 0)) {
      matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batVoltage', value / 1000, shellyDevice.log, endpoint);
    }
    if (shellyComponent.name === 'Battery' && property === 'charging' && isValidNumber(value)) {
      matterbridgeDevice.setAttribute(
        PowerSourceCluster.id,
        'batChargeState',
        value ? PowerSource.BatChargeState.IsCharging : PowerSource.BatChargeState.IsNotCharging,
        matterbridgeDevice.log,
        endpoint,
      );
    }
    // Update for Motion
    if (shellyComponent.name === 'Sensor' && property === 'motion' && isValidBoolean(value)) {
      matterbridgeDevice.setAttribute(OccupancySensingCluster.id, 'occupancy', { occupied: value }, shellyDevice.log, endpoint);
    }
    // Update for Contact
    if (shellyComponent.name === 'Sensor' && property === 'contact_open' && isValidBoolean(value)) {
      matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', !value, shellyDevice.log, endpoint);
    }
    // Update for Flood
    if (shellyComponent.name === 'Flood' && property === 'flood' && isValidBoolean(value)) {
      matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', !value, shellyDevice.log, endpoint);
    }
    // Update for Gas
    if (shellyComponent.name === 'Gas' && property === 'alarm_state' && isValidString(value)) {
      matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', value === 'none', shellyDevice.log, endpoint);
    }
    // Update for Smoke
    if (shellyComponent.name === 'Smoke' && property === 'alarm' && isValidBoolean(value)) {
      matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', !value, shellyDevice.log, endpoint);
    }
    // Update for Lux
    if (shellyComponent.name === 'Lux' && property === 'value' && isValidNumber(value, 0)) {
      const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
      matterbridgeDevice.setAttribute(IlluminanceMeasurementCluster.id, 'measuredValue', matterLux, shellyDevice.log, endpoint);
    }
    // Update for Temperature when has value or tC
    if (shellyComponent.name === 'Temperature' && (property === 'value' || property === 'tC') && isValidNumber(value, -100, +100)) {
      matterbridgeDevice.setAttribute(TemperatureMeasurementCluster.id, 'measuredValue', value * 100, shellyDevice.log, endpoint);
    }
    // Update for Humidity when has rh
    if (shellyComponent.name === 'Humidity' && property === 'rh' && isValidNumber(value, 0, 100)) {
      matterbridgeDevice.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', value * 100, shellyDevice.log, endpoint);
    }
    // Update for Illuminance when has lux
    if (shellyComponent.name === 'Illuminance' && property === 'lux' && isValidNumber(value, 0)) {
      const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
      matterbridgeDevice.setAttribute(IlluminanceMeasurementCluster.id, 'measuredValue', matterLux, shellyDevice.log, endpoint);
    }
    // Update for Thermostat current_C
    if (shellyComponent.name === 'Thermostat' && property === 'current_C' && isValidNumber(value, -100, +100)) {
      matterbridgeDevice.setAttribute(ThermostatCluster.id, 'localTemperature', value * 100, shellyDevice.log, endpoint);
    }
    // Update for Thermostat target_C
    if (shellyComponent.name === 'Thermostat' && property === 'target_C' && isValidNumber(value, -100, +100)) {
      if (shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'heating')
        matterbridgeDevice.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', value * 100, shellyDevice.log, endpoint);
      if (shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'cooling')
        matterbridgeDevice.setAttribute(ThermostatCluster.id, 'occupiedCoolingSetpoint', value * 100, shellyDevice.log, endpoint);
    }
    // Update for vibration
    if (shellyComponent.name === 'Vibration' && property === 'vibration' && isValidBoolean(value)) {
      if (value) matterbridgeDevice.triggerSwitchEvent('Single', shellyDevice.log, endpoint);
    }
    // Update cover
    if (shellyComponent.name === 'Cover' || shellyComponent.name === 'Roller') {
      // Matter uses 10000 = fully closed   0 = fully opened
      // Shelly uses 0 = fully closed   100 = fully opened

      // Gen 1 has state:open|close|stop current_pos:XXX ==> open means opening, close means closing, stop means stopped
      // Gen 1 open sequence: state:open current_pos:80 state:stop
      // Gen 1 close sequence: state:close current_pos:80 state:stop
      // Gen 1 stop sequence: state:stop current_pos:80

      // Gen 2 has state:open|opening|closed|closing|stopped target_pos:XXX current_pos:XXX ==> open means fully open, closed means fully closed
      // Gen 2 open sequence: state:open state:opening target_pos:88 current_pos:100 state:open
      // Gen 2 close sequence: state:closing target_pos:88 current_pos:95 state:stopped state:close
      // Gen 2 position sequence: state:closing target_pos:88 current_pos:95 state:stopped state:close
      // Gen 2 stop sequence: state:stop current_pos:80 state:stopped
      // Gen 2 state close or open is the position
      if (property === 'state' && isValidString(value, 4)) {
        // Gen 1 devices send stop. Gen 2 devices send stopped.
        if ((shellyDevice.gen === 1 && value === 'stop') || (shellyDevice.gen > 1 && value === 'stopped')) {
          const status = WindowCovering.MovementStatus.Stopped;
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log, endpoint);
          setTimeout(() => {
            shellyDevice.log.info(`Setting target position to current position on endpoint ${or}${endpoint.name}:${endpoint.number}${db}`);
            const current = matterbridgeDevice.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', shellyDevice.log, endpoint);
            if (!isValidNumber(current, 0, 10000)) {
              this.log.error(`Error: current position not found on endpoint ${or}${endpoint.name}:${endpoint.number}${db} ${hk}WindowCovering${db}`);
              return;
            }
            matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', current, shellyDevice.log, endpoint);
          }, 1000);
        }
        // Gen 2 devices send open for fully open
        if (shellyDevice.gen > 1 && value === 'open') {
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', 0, shellyDevice.log, endpoint);
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', 0, shellyDevice.log, endpoint);
          const status = WindowCovering.MovementStatus.Stopped;
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log, endpoint);
        }
        // Gen 2 devices send closed for fully closed
        if (shellyDevice.gen > 1 && value === 'closed') {
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', 10000, shellyDevice.log, endpoint);
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', 10000, shellyDevice.log, endpoint);
          const status = WindowCovering.MovementStatus.Stopped;
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log, endpoint);
        }
        if ((shellyDevice.gen === 1 && value === 'open') || (shellyDevice.gen > 1 && value === 'opening')) {
          const status = WindowCovering.MovementStatus.Opening;
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log, endpoint);
        }
        if ((shellyDevice.gen === 1 && value === 'close') || (shellyDevice.gen > 1 && value === 'closing')) {
          const status = WindowCovering.MovementStatus.Closing;
          matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log, endpoint);
        }
      } else if (property === 'current_pos' && isValidNumber(value, 0, 100)) {
        const matterPos = 10000 - Math.min(Math.max(Math.round(value * 100), 0), 10000);
        matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', matterPos, shellyDevice.log, endpoint);
      } else if (property === 'target_pos' && isValidNumber(value, 0, 100)) {
        const matterPos = 10000 - Math.min(Math.max(Math.round(value * 100), 0), 10000);
        matterbridgeDevice.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', matterPos, shellyDevice.log, endpoint);
      }
      // const statusLookup = ['stopped', 'opening', 'closing', 'unknown'];
    }
    // Update energy from main components (gen 2 devices send power total inside the component not with meter)
    if (this.config.exposePowerMeter === 'matter13' && ['Light', 'Rgb', 'Relay', 'Switch', 'Cover', 'Roller', 'PowerMeter'].includes(shellyComponent.name)) {
      // Gen. 1 devices have: power, total (not all) in PowerMeters and voltage in status (not all)
      // PRO devices have: apower, voltage, freq, current, aenergy.total (wh) and no PowerMeters
      if ((property === 'power' || property === 'apower' || property === 'act_power') && isValidNumber(value, 0)) {
        const power = Math.round(value * 1000) / 1000;
        matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'activePower', power * 1000, shellyDevice.log, endpoint);
        if (property === 'act_power') return; // Skip the rest for PRO devices
        if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
        if (shellyComponent.hasProperty('current')) return; // Skip if we have already current reading
        // Check if we have voltage on Gen. 1 devices (eg. Shelly 2.5)
        if (property === 'power' && shellyDevice.hasComponent('sys') && shellyDevice.getComponent('sys')?.hasProperty('voltage')) {
          const voltage = shellyDevice.getComponent('sys')?.getValue('voltage');
          if (isValidNumber(voltage, 10)) {
            matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'voltage', voltage * 1000, shellyDevice.log, endpoint);
            const current = Math.round((value / voltage) * 1000) / 1000;
            matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'activeCurrent', current * 1000, shellyDevice.log, endpoint);
          }
        }
        // Calculate current from power and voltage
        const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
        if (isValidNumber(voltage, 10)) {
          const current = Math.round((value / voltage) * 1000) / 1000;
          matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'activeCurrent', current * 1000, shellyDevice.log, endpoint);
        }
      }
      if (property === 'total' && isValidNumber(value, 0)) {
        const energy = Math.round(value * 1000) / 1000;
        matterbridgeDevice.setAttribute(ElectricalEnergyMeasurementCluster.id, 'cumulativeEnergyImported', { energy: energy * 1000 }, shellyDevice.log, endpoint);
      }
      if (property === 'aenergy' && isValidObject(value) && isValidNumber((value as ShellyData).total, 0)) {
        const energy = Math.round(((value as ShellyData).total as number) * 1000) / 1000;
        matterbridgeDevice.setAttribute(ElectricalEnergyMeasurementCluster.id, 'cumulativeEnergyImported', { energy: energy * 1000 }, shellyDevice.log, endpoint);
      }
      if (property === 'voltage' && isValidNumber(value, 0)) {
        matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'voltage', value * 1000, shellyDevice.log, endpoint);
      }
      if (property === 'current' && isValidNumber(value, 0)) {
        matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'activeCurrent', value * 1000, shellyDevice.log, endpoint);
        if (shellyComponent.hasProperty('act_power')) return;
        if (shellyComponent.hasProperty('apower')) return;
        if (shellyComponent.hasProperty('power')) return;
        if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
        // Calculate power from current and voltage
        const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
        if (isValidNumber(voltage, 0)) {
          const power = Math.round(value * voltage * 1000) / 1000;
          matterbridgeDevice.setAttribute(ElectricalPowerMeasurementCluster.id, 'activePower', power * 1000, shellyDevice.log, endpoint);
        }
      }
    }
  }

  /*
  private updater: { component: string | string[]; property: string; typeof: string; min?: number; max?: number; cluster: string; attribute: string }[] = [
    { component: ['Light', 'Switch'], property: 'state', typeof: 'boolean', cluster: 'OnOff', attribute: 'onOff' },
    { component: ['Light', 'Switch'], property: 'brightness', typeof: 'number', min: 0, max: 100, cluster: 'LevelControl', attribute: 'currentLevel' },
    { component: ['Light', 'Rgb', 'Rgbw'], property: 'red', typeof: 'array', min: 0, max: 255, cluster: 'ColorControl', attribute: '' },
    { component: ['Light', 'Rgb', 'Rgbw'], property: 'green', typeof: 'array', min: 0, max: 255, cluster: 'ColorControl', attribute: '' },
    { component: ['Light', 'Rgb', 'Rgbw'], property: 'blue', typeof: 'array', min: 0, max: 255, cluster: 'ColorControl', attribute: '' },
    { component: ['Light', 'Rgb', 'Rgbw'], property: 'rgb', typeof: 'array', min: 3, max: 3, cluster: 'ColorControl', attribute: '' },
  ];
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
