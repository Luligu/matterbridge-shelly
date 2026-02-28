/**
 * @description This file contains the commandHandler for ShellyPlatform.
 * @file src\platformUpdateHandler.ts
 * @author Luca Liguori
 * @created 2024-12-03
 * @version 1.0.0
 * @license Apache-2.0
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
 * limitations under the License.
 */

import { MatterbridgeEndpoint } from 'matterbridge';
import { db, debugStringify, dn, er, hk, idn, or, rs, YELLOW, zb } from 'matterbridge/logger';
import {
  BooleanState,
  ColorControl,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  IlluminanceMeasurement,
  LevelControl,
  OccupancySensing,
  OnOff,
  PowerSource,
  RelativeHumidityMeasurement,
  SmokeCoAlarm,
  TemperatureMeasurement,
  Thermostat,
  WindowCovering,
} from 'matterbridge/matter/clusters';
import { isValidArray, isValidBoolean, isValidNumber, isValidObject, isValidString, rgbColorToHslColor } from 'matterbridge/utils';

import { ShellyPlatform } from './platform.js';
import { isLightComponent, isSwitchComponent } from './shellyComponent.js';
import { ShellyDevice } from './shellyDevice.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';

/**
 * Handles updates from Shelly devices and updates the corresponding Matterbridge endpoint.
 *
 * @param {ShellyPlatform} platform - The Shelly platform instance.
 * @param {MatterbridgeEndpoint} matterbridgeDevice - The Matterbridge endpoint for the device.
 * @param {ShellyDevice} shellyDevice - The Shelly device instance.
 * @param {string} component - The component name to update.
 * @param {string} property - The property name to update.
 * @param {ShellyDataType} value - The new value for the property.
 * @param {string} [endpointName] - The name of the endpoint to update (optional).
 * @returns {void}
 */
export function shellyUpdateHandler(
  platform: ShellyPlatform,
  matterbridgeDevice: MatterbridgeEndpoint,
  shellyDevice: ShellyDevice,
  component: string,
  property: string,
  value: ShellyDataType,
  endpointName?: string,
): void {
  let endpoint: MatterbridgeEndpoint | undefined;
  if (endpointName === 'PowerSource') endpoint = matterbridgeDevice;
  if (!endpoint) endpoint = matterbridgeDevice.getChildEndpointByName(endpointName ?? component);
  if (!endpoint) endpoint = matterbridgeDevice.getChildEndpointByName(component.replace(':', ''));
  if (!endpoint) {
    shellyDevice.log.debug(`shellyUpdateHandler error: endpoint ${component} not found for shelly device ${dn}${shellyDevice?.id}${db}`);
    return;
  }
  const shellyComponent = shellyDevice.getComponent(component);
  if (!shellyComponent) {
    shellyDevice.log.debug(`shellyUpdateHandler error: component ${component} not found for shelly device ${dn}${shellyDevice?.id}${db}`);
    return;
  }
  shellyDevice.log.info(
    `${db}Shelly message for device ${idn}${shellyDevice.id}${rs}${db} ` +
      `${hk}${shellyComponent.name}${db}:${hk}${component}${db}:${zb}${property}${db}:${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value as object) : value}${rs}`,
  );
  // Update state
  if ((isLightComponent(shellyComponent) || isSwitchComponent(shellyComponent)) && property === 'state' && isValidBoolean(value)) {
    endpoint.setAttribute(OnOff.Cluster.id, 'onOff', value, shellyDevice.log);
  }
  // Update brightness
  if (isLightComponent(shellyComponent) && (property === 'gain' || property === 'brightness') && isValidNumber(value, 0, 100)) {
    endpoint.setAttribute(LevelControl.Cluster.id, 'currentLevel', Math.max(Math.min(Math.round((value / 100) * 254), 254), 1), shellyDevice.log);
  }
  // Update color gen 1
  if (isLightComponent(shellyComponent) && ['red', 'green', 'blue'].includes(property) && isValidNumber(value, 0, 255)) {
    const red = property === 'red' ? value : (shellyComponent.getValue('red') as number);
    const green = property === 'green' ? value : (shellyComponent.getValue('green') as number);
    const blue = property === 'blue' ? value : (shellyComponent.getValue('blue') as number);
    const hsl = rgbColorToHslColor({ r: red, g: green, b: blue });
    matterbridgeDevice.log.debug(`ColorRgbToHsl: R:${red} G:${green} B:${blue} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
    if (shellyDevice.colorUpdateTimeout) clearTimeout(shellyDevice.colorUpdateTimeout);
    shellyDevice.colorUpdateTimeout = setTimeout(() => {
      const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
      const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
      if (isValidNumber(hue, 0, 254)) endpoint?.setAttribute(ColorControl.Cluster.id, 'currentHue', hue, shellyDevice.log);
      if (isValidNumber(saturation, 0, 254)) endpoint?.setAttribute(ColorControl.Cluster.id, 'currentSaturation', saturation, shellyDevice.log);
      endpoint?.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log);
    }, shellyDevice.colorUpdateTimeoutMs).unref();
  }
  // Update colorTemp gen 1
  if (isLightComponent(shellyComponent) && property === 'temp' && isValidNumber(value, 2700, 6500)) {
    const minValue = shellyDevice.model === 'SHBDUO-1' ? 2700 : 3000;
    const maxValue = 6500;
    const minMatterTemp = 147;
    const maxMatterTemp = 500;
    const matterTemp = Math.max(Math.min(Math.round(((value - minValue) / (maxValue - minValue)) * (minMatterTemp - maxMatterTemp) + maxMatterTemp), maxMatterTemp), minMatterTemp);
    matterbridgeDevice.log.debug(`ColorTemp for ${shellyDevice.model}: colorTemperature:${value} => colorTemperatureMireds:${matterTemp}`);
    endpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.ColorTemperatureMireds, shellyDevice.log);
    endpoint.setAttribute(ColorControl.Cluster.id, 'enhancedColorMode', ColorControl.EnhancedColorMode.ColorTemperatureMireds, shellyDevice.log);
    endpoint.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', matterTemp, shellyDevice.log);
  }
  // Update colorTemp gen 2+
  if (isLightComponent(shellyComponent) && property === 'ct' && isValidNumber(value, 2700, 6500)) {
    let minValue = 2700;
    let maxValue = 6500;
    const range = shellyComponent.getProperty('ct_range')?.value;
    if (isValidArray(range, 2, 2) && isValidNumber(range[0], 2700, 6500) && isValidNumber(range[1], 2700, 6500)) {
      minValue = range[0];
      maxValue = range[1];
    }
    const minMatterTemp = 147;
    const maxMatterTemp = 500;
    const matterTemp = Math.max(Math.min(Math.round(((value - minValue) / (maxValue - minValue)) * (minMatterTemp - maxMatterTemp) + maxMatterTemp), maxMatterTemp), minMatterTemp);
    matterbridgeDevice.log.debug(`ColorTemp for ${shellyDevice.model}: colorTemperature:${value} => colorTemperatureMireds:${matterTemp}`);
    endpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.ColorTemperatureMireds, shellyDevice.log);
    endpoint.setAttribute(ColorControl.Cluster.id, 'enhancedColorMode', ColorControl.EnhancedColorMode.ColorTemperatureMireds, shellyDevice.log);
    endpoint.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', matterTemp, shellyDevice.log);
  }
  // Update color gen 2+
  if (
    isLightComponent(shellyComponent) &&
    property === 'rgb' &&
    isValidArray(value, 3, 3) &&
    isValidNumber(value[0], 0, 255) &&
    isValidNumber(value[1], 0, 255) &&
    isValidNumber(value[2], 0, 255)
  ) {
    const hsl = rgbColorToHslColor({ r: value[0], g: value[1], b: value[2] });
    matterbridgeDevice.log.debug(`ColorRgbToHsl: R:${value[0]} G:${value[1]} B:${value[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
    const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
    const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
    if (isValidNumber(hue, 0, 254)) endpoint.setAttribute(ColorControl.Cluster.id, 'currentHue', hue, shellyDevice.log);
    if (isValidNumber(hue, 0, 254)) endpoint.setAttribute(ColorControl.Cluster.id, 'currentSaturation', saturation, shellyDevice.log);
    endpoint.setAttribute(ColorControl.Cluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log);
  }
  // Update Input component with state
  if (shellyComponent.name === 'Input' && property === 'state' && isValidBoolean(value)) {
    if (platform.config.inputContactList && (platform.config.inputContactList as string[]).includes(shellyDevice.id)) {
      endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', value, shellyDevice.log);
    }
    if (platform.config.inputMomentaryList && (platform.config.inputMomentaryList as string[]).includes(shellyDevice.id) && value === true) {
      endpoint.triggerSwitchEvent('Single', shellyDevice.log);
    }
    if (platform.config.inputLatchingList && (platform.config.inputLatchingList as string[]).includes(shellyDevice.id)) {
      endpoint.triggerSwitchEvent(value ? 'Press' : 'Release', shellyDevice.log);
    }
  }
  // Update Input component with event for Gen 1 devices
  if (shellyComponent.name === 'Input' && property === 'event_cnt' && isValidNumber(value) && shellyComponent.hasProperty('event')) {
    if (platform.config.inputMomentaryList && (platform.config.inputMomentaryList as string[]).includes(shellyDevice.id)) {
      const event = shellyComponent.getValue('event');
      if (!isValidString(event, 1)) return;
      if (event === 'S') {
        endpoint.triggerSwitchEvent('Single', shellyDevice.log);
      }
      if (event === 'SS') {
        endpoint.triggerSwitchEvent('Double', shellyDevice.log);
      }
      if (event === 'L') {
        endpoint.triggerSwitchEvent('Long', shellyDevice.log);
      }
    }
  }
  // Update for Battery
  if (shellyComponent.name === 'Battery' && property === 'level' && isValidNumber(value, 0, 100)) {
    endpoint.setAttribute(PowerSource.Cluster.id, 'batPercentRemaining', Math.min(Math.max(value * 2, 0), 200), shellyDevice.log);
    if (value < 10) endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, shellyDevice.log);
    else if (value < 20) endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, shellyDevice.log);
    else endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, shellyDevice.log);
  }
  if (shellyComponent.name === 'Battery' && property === 'voltage' && isValidNumber(value, 0)) {
    endpoint.setAttribute(PowerSource.Cluster.id, 'batVoltage', value * 1000, shellyDevice.log);
  }
  if (shellyComponent.name === 'Battery' && property === 'charging' && isValidNumber(value)) {
    endpoint.setAttribute(
      PowerSource.Cluster.id,
      'batChargeState',
      value ? PowerSource.BatChargeState.IsCharging : PowerSource.BatChargeState.IsNotCharging,
      matterbridgeDevice.log,
    );
  }
  // Update for Devicepower
  if (shellyComponent.name === 'Devicepower' && property === 'battery' && isValidObject(value, 2)) {
    const battery = value as { V: number; percent: number };
    if (isValidNumber(battery.V, 0, 12) && isValidNumber(battery.percent, 0, 100)) {
      endpoint.setAttribute(PowerSource.Cluster.id, 'batPercentRemaining', battery.percent * 2, shellyDevice.log);
      if (battery.percent < 10) endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, shellyDevice.log);
      else if (battery.percent < 20) endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, shellyDevice.log);
      else endpoint.setAttribute(PowerSource.Cluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, shellyDevice.log);
      endpoint.setAttribute(PowerSource.Cluster.id, 'batVoltage', battery.V * 1000, shellyDevice.log);
    }
  }

  // Update for Motion
  if (shellyComponent.name === 'Sensor' && property === 'motion' && isValidBoolean(value)) {
    endpoint.setAttribute(OccupancySensing.Cluster.id, 'occupancy', { occupied: value }, shellyDevice.log);
  }
  // Update for Contact
  if (shellyComponent.name === 'Sensor' && property === 'contact_open' && isValidBoolean(value)) {
    endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', !value, shellyDevice.log);
  }
  // Update for Flood
  if (shellyComponent.name === 'Flood' && property === 'flood' && isValidBoolean(value)) {
    // endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', !value, shellyDevice.log);
    endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', value, shellyDevice.log); // Water Leak Detector: true = leak, false = no leak
  }
  // Update for Gas
  if (shellyComponent.name === 'Gas' && property === 'alarm_state' && isValidString(value)) {
    endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', value === 'none', shellyDevice.log);
  }
  // Update for Smoke
  if (shellyComponent.name === 'Smoke' && property === 'alarm' && isValidBoolean(value)) {
    // endpoint.setAttribute(BooleanState.Cluster.id, 'stateValue', !value, shellyDevice.log);
    endpoint.setAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', value ? SmokeCoAlarm.AlarmState.Critical : SmokeCoAlarm.AlarmState.Normal, shellyDevice.log);
  }
  // Update for Lux
  if (shellyComponent.name === 'Lux' && property === 'value' && isValidNumber(value, 0)) {
    const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
    endpoint.setAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue', matterLux, shellyDevice.log);
  }
  // Update for Temperature when has value or tC
  if (shellyComponent.name === 'Temperature' && (property === 'value' || property === 'tC') && isValidNumber(value, -100, +100)) {
    endpoint.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', Math.round(value * 100), shellyDevice.log);
  }
  // Update for Humidity when has value or rh
  if (shellyComponent.name === 'Humidity' && (property === 'value' || property === 'rh') && isValidNumber(value, 0, 100)) {
    endpoint.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', Math.round(value * 100), shellyDevice.log);
  }
  // Update for Illuminance when has lux
  if (shellyComponent.name === 'Illuminance' && property === 'lux' && isValidNumber(value, 0)) {
    const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
    endpoint.setAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue', matterLux, shellyDevice.log);
  }
  // Update for vibration
  if (shellyComponent.name === 'Vibration' && property === 'vibration' && isValidBoolean(value)) {
    if (value) endpoint.triggerSwitchEvent('Single', shellyDevice.log);
  }
  if (shellyDevice.gen === 1) {
    // Update for Thermostat target_t.enabled (Gen1)
    if (shellyComponent.name === 'Thermostat' && property === 'target_t' && isValidObject(value)) {
      const target = value as { enabled: boolean; value: number; value_op: number; units: string };
      if (target.enabled === false) endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Off, shellyDevice.log);
      else if (target.enabled === true) endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Heat, shellyDevice.log);
      if (isValidNumber(target.value, 4, 31)) endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', target.value * 100, shellyDevice.log);
    }
    // Update for Thermostat tmp.value (Gen1)
    if (shellyComponent.name === 'Thermostat' && property === 'tmp' && isValidObject(value)) {
      const current = value as { value: number; units: string; is_valid: boolean };
      if (isValidNumber(current.value, -55, +125) && current.is_valid === true)
        endpoint.setAttribute(Thermostat.Cluster.id, 'localTemperature', current.value * 100, shellyDevice.log);
    }
  } else if (shellyDevice.gen > 1) {
    // Update for Thermostat enable (Gen2+)
    if (shellyComponent.name === 'Thermostat' && property === 'enable' && isValidBoolean(value)) {
      if (value === false) endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Off, shellyDevice.log);
      else if (value === true && shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'heating')
        endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Heat, shellyDevice.log);
      else if (value === true && shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'cooling')
        endpoint.setAttribute(Thermostat.Cluster.id, 'systemMode', Thermostat.SystemMode.Cool, shellyDevice.log);
    }
    // Update for Thermostat current_C (Gen2+)
    if (shellyComponent.name === 'Thermostat' && property === 'current_C' && isValidNumber(value, -100, +100)) {
      endpoint.setAttribute(Thermostat.Cluster.id, 'localTemperature', value * 100, shellyDevice.log);
    }
    // Update for Thermostat target_C (Gen2+)
    if (shellyComponent.name === 'Thermostat' && property === 'target_C' && isValidNumber(value, -100, +100)) {
      if (shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'heating')
        endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedHeatingSetpoint', value * 100, shellyDevice.log);
      if (shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'cooling')
        endpoint.setAttribute(Thermostat.Cluster.id, 'occupiedCoolingSetpoint', value * 100, shellyDevice.log);
    }
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
        endpoint.setAttribute(WindowCovering.Cluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log);
        shellyDevice.coverUpdateTimeout = setTimeout(() => {
          shellyDevice.log.debug(`Setting target position to current position on endpoint ${or}${endpoint?.name}:${endpoint?.number}${db}`);
          const current = endpoint?.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', shellyDevice.log);
          // istanbul ignore next cause is just a safety check, it should never happen that current position is not valid
          if (!isValidNumber(current, 0, 10000)) {
            matterbridgeDevice.log.error(`Error: current position not found on endpoint ${or}${endpoint?.name}:${endpoint?.number}${er}`);
            return;
          }
          endpoint?.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', current, shellyDevice.log);
        }, shellyDevice.coverUpdateTimeoutMs).unref();
      }
      // Gen 2 devices send open for fully open
      if (shellyDevice.gen > 1 && value === 'open') {
        endpoint.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', 0, shellyDevice.log);
        endpoint.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', 0, shellyDevice.log);
        const status = WindowCovering.MovementStatus.Stopped;
        endpoint.setAttribute(WindowCovering.Cluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log);
      }
      // Gen 2 devices send closed for fully closed
      if (shellyDevice.gen > 1 && value === 'closed') {
        endpoint.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', 10000, shellyDevice.log);
        endpoint.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', 10000, shellyDevice.log);
        const status = WindowCovering.MovementStatus.Stopped;
        endpoint.setAttribute(WindowCovering.Cluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log);
      }
      if ((shellyDevice.gen === 1 && value === 'open') || (shellyDevice.gen > 1 && value === 'opening')) {
        const status = WindowCovering.MovementStatus.Opening;
        endpoint.setAttribute(WindowCovering.Cluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log);
      }
      if ((shellyDevice.gen === 1 && value === 'close') || (shellyDevice.gen > 1 && value === 'closing')) {
        const status = WindowCovering.MovementStatus.Closing;
        endpoint.setAttribute(WindowCovering.Cluster.id, 'operationalStatus', { global: status, lift: status, tilt: status }, shellyDevice.log);
      }
    } else if (property === 'current_pos' && isValidNumber(value, 0, 100)) {
      const matterPos = 10000 - Math.min(Math.max(Math.round(value * 100), 0), 10000);
      endpoint.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', matterPos, shellyDevice.log);
    } else if (property === 'target_pos' && isValidNumber(value, 0, 100)) {
      const matterPos = 10000 - Math.min(Math.max(Math.round(value * 100), 0), 10000);
      endpoint.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', matterPos, shellyDevice.log);
    }
    // const statusLookup = ['stopped', 'opening', 'closing', 'unknown'];
  }
  // Update energy from main components (gen 2 devices send power total inside the component not with meter)
  if (['Light', 'Rgb', 'Relay', 'Switch', 'Cover', 'Roller', 'PowerMeter'].includes(shellyComponent.name)) {
    // istanbul ignore next cause is tested elsewhere
    if (!platform.validateEntity(shellyDevice.id, 'PowerMeter')) return;

    // For triphase devices (shellypro3em and shelly3em63g3) we have em:0 and emdata:0. We add phase A, B and C components as well and we use em:0 as total. The em:1, em:2 and em:3 need to be updated from the em:0 phases.
    if (shellyDevice.profile === 'triphase' && shellyComponent.id === 'em:0') {
      // Set the total current and active power and energy for triphase devices (no voltage on total)
      if (property === 'total_current') property = 'current';
      if (property === 'total_act_power') property = 'act_power';
      if (property === 'total_act') property = 'total_act_energy';
      if (property === 'total_act_ret') property = 'total_act_ret_energy';
      // Set the voltage, current, active power and energy for phase A, B and C for triphase devices
      if (property.startsWith('a_') || property.startsWith('b_') || property.startsWith('c_')) {
        if (property.startsWith('a_')) endpoint = matterbridgeDevice.getChildEndpointByName('em:1');
        if (property.startsWith('b_')) endpoint = matterbridgeDevice.getChildEndpointByName('em:2');
        if (property.startsWith('c_')) endpoint = matterbridgeDevice.getChildEndpointByName('em:3');
        // istanbul ignore next cause is just a safety check, it should never happen that endpoint is not found
        if (!endpoint) {
          shellyDevice.log.debug(`****shellyUpdateHandler error: endpoint not found for triphase shelly device ${dn}${shellyDevice?.id}${db}`);
          return;
        }
        const originalProperty = property;
        property = property.replace(/^a_/, '').replace(/^b_/, '').replace(/^c_/, '');
        shellyDevice.log.debug(
          `***shellyUpdateHandler property ${originalProperty} remapped to ${endpoint?.id}:${property} for triphase shelly device ${dn}${shellyDevice?.id}${db}`,
        );
      }
    }

    // Gen. 1 devices have: power, total (not all) in PowerMeters and voltage in status (not all)
    // PRO devices have: apower, voltage, freq, current, aenergy.total (wh) and no PowerMeters
    if ((property === 'power' || property === 'apower' || property === 'act_power') && isValidNumber(value, 0)) {
      if (property === 'power' && shellyComponent.id.startsWith('light') && shellyDevice.id.startsWith('shellyrgbw2')) return; // Skip the rest for shellyrgbw2 devices
      const power = Math.round(value * 1000) / 1000;
      endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'activePower', Math.round(power * 1000), shellyDevice.log);
      if (property === 'act_power') return; // Skip the rest for PRO devices
      if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
      if (shellyComponent.hasProperty('current')) return; // Skip if we have already current reading
      // Check if we have voltage on Gen. 1 devices (eg. Shelly 2.5)
      if (property === 'power' && shellyDevice.hasComponent('sys') && shellyDevice.getComponent('sys')?.hasProperty('voltage')) {
        const voltage = shellyDevice.getComponent('sys')?.getValue('voltage');
        if (isValidNumber(voltage, 10)) {
          endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'voltage', Math.round(voltage * 1000), shellyDevice.log);
          const current = Math.round((value / voltage) * 1000) / 1000;
          endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'activeCurrent', Math.round(current * 1000), shellyDevice.log);
        }
      }
      // Calculate current from power and voltage
      const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
      // istanbul ignore next
      if (isValidNumber(voltage, 10)) {
        const current = Math.round((value / voltage) * 1000) / 1000;
        endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'activeCurrent', Math.round(current * 1000), shellyDevice.log);
      }
    }
    if (property === 'total' && isValidNumber(value, 0)) {
      const energy = Math.round(value * 1000) / 1000;
      endpoint.setAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported', { energy: Math.round(energy * 1000) }, shellyDevice.log);
    }
    if (property === 'aenergy' && isValidObject(value) && isValidNumber((value as ShellyData).total, 0)) {
      const energy = Math.round(((value as ShellyData).total as number) * 1000) / 1000;
      endpoint.setAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported', { energy: Math.round(energy * 1000) }, shellyDevice.log);
    }
    if (property === 'total_act_energy' && isValidNumber(value, 0)) {
      const energy = Math.round(value * 1000) / 1000;
      endpoint.setAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyImported', { energy: Math.round(energy * 1000) }, shellyDevice.log);
    }
    if (property === 'total_act_ret_energy' && isValidNumber(value, 0)) {
      const energy = Math.round(value * 1000) / 1000;
      endpoint.setAttribute(ElectricalEnergyMeasurement.Cluster.id, 'cumulativeEnergyExported', { energy: Math.round(energy * 1000) }, shellyDevice.log);
    }
    if (property === 'voltage' && isValidNumber(value, 0)) {
      endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'voltage', Math.round(value * 1000), shellyDevice.log);
    }
    if (property === 'current' && isValidNumber(value, 0)) {
      endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'activeCurrent', Math.round(value * 1000), shellyDevice.log);
      if (shellyComponent.hasProperty('act_power')) return;
      if (shellyComponent.hasProperty('apower')) return;
      if (shellyComponent.hasProperty('power')) return;
      // istanbul ignore next
      if (shellyComponent.id.startsWith('emeter')) return; // Skip the rest for em3 devices
      // Calculate power from current and voltage
      // istanbul ignore next
      const voltage = shellyComponent.hasProperty('voltage') ? (shellyComponent.getValue('voltage') as number) : undefined;
      // istanbul ignore next
      if (isValidNumber(voltage, 0)) {
        const power = Math.round(value * voltage * 1000) / 1000;
        endpoint.setAttribute(ElectricalPowerMeasurement.Cluster.id, 'activePower', Math.round(power * 1000), shellyDevice.log);
      }
    }
  }
}
