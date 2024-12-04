/**
 * This file contains the commandHandler for ShellyPlatform.
 *
 * @file src\platformUpdateHandler.ts
 * @author Luca Liguori
 * @date 2024-12-03
 * @version 1.0.0
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

import {
  BooleanStateCluster,
  ColorControl,
  ColorControlCluster,
  ElectricalEnergyMeasurementCluster,
  ElectricalPowerMeasurementCluster,
  IlluminanceMeasurementCluster,
  LevelControlCluster,
  MatterbridgeDevice,
  OccupancySensingCluster,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  RelativeHumidityMeasurementCluster,
  TemperatureMeasurementCluster,
  Thermostat,
  ThermostatCluster,
  WindowCovering,
  WindowCoveringCluster,
} from 'matterbridge';
import { db, debugStringify, dn, hk, idn, or, rs, YELLOW, zb } from 'matterbridge/logger';
import { isValidArray, isValidBoolean, isValidNumber, isValidObject, isValidString, rgbColorToHslColor } from 'matterbridge/utils';

import { ShellyDevice } from './shellyDevice.js';
import { ShellyData, ShellyDataType } from './shellyTypes.js';
import { isLightComponent, isSwitchComponent } from './shellyComponent.js';
import { ShellyPlatform } from './platform.js';

export function shellyUpdateHandler(
  platform: ShellyPlatform,
  matterbridgeDevice: MatterbridgeDevice,
  shellyDevice: ShellyDevice,
  component: string,
  property: string,
  value: ShellyDataType,
  endpointName?: string,
) {
  let endpoint = matterbridgeDevice.getChildEndpointByName(endpointName ?? component);
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
    matterbridgeDevice.setAttribute(OnOffCluster.id, 'onOff', value, shellyDevice.log, endpoint);
  }
  // Update brightness
  if (isLightComponent(shellyComponent) && (property === 'gain' || property === 'brightness') && isValidNumber(value, 0, 100)) {
    matterbridgeDevice.setAttribute(LevelControlCluster.id, 'currentLevel', Math.max(Math.min(Math.round((value / 100) * 254), 254), 0), shellyDevice.log, endpoint);
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
      if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, endpoint);
      if (isValidNumber(saturation, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, endpoint);
      matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, endpoint);
    }, 200);
  }
  // Update colorTemp gen 1
  if (isLightComponent(shellyComponent) && property === 'temp' && isValidNumber(value, 2700, 6500)) {
    const minValue = shellyDevice.model === 'SHBDUO-1' ? 2700 : 3000;
    const maxValue = 6500;
    const minMatterTemp = 147;
    const maxMatterTemp = 500;
    const matterTemp = Math.max(Math.min(Math.round(((value - minValue) / (maxValue - minValue)) * (minMatterTemp - maxMatterTemp) + maxMatterTemp), maxMatterTemp), minMatterTemp);
    matterbridgeDevice.log.debug(`ColorTemp for ${shellyDevice.model}: colorTemperature:${value} => colorTemperatureMireds:${matterTemp}`);
    matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.ColorTemperatureMireds, shellyDevice.log, endpoint);
    matterbridgeDevice.setAttribute(ColorControlCluster.id, 'enhancedColorMode', ColorControl.EnhancedColorMode.ColorTemperatureMireds, shellyDevice.log, endpoint);
    matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorTemperatureMireds', matterTemp, shellyDevice.log, endpoint);
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
    matterbridgeDevice.log.debug(`ColorRgbToHsl: R:${value[0]} G:${value[1]} B:${value[2]} => H:${hsl.h} S:${hsl.s} L:${hsl.l}`);
    const hue = Math.max(Math.min(Math.round((hsl.h / 360) * 254), 254), 0);
    const saturation = Math.max(Math.min(Math.round((hsl.s / 100) * 254), 254), 0);
    if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentHue', hue, shellyDevice.log, endpoint);
    if (isValidNumber(hue, 0, 254)) matterbridgeDevice.setAttribute(ColorControlCluster.id, 'currentSaturation', saturation, shellyDevice.log, endpoint);
    matterbridgeDevice.setAttribute(ColorControlCluster.id, 'colorMode', ColorControl.ColorMode.CurrentHueAndCurrentSaturation, shellyDevice.log, endpoint);
  }
  // Update Input component with state
  if (shellyComponent.name === 'Input' && property === 'state' && isValidBoolean(value)) {
    if (
      platform.config.exposeInput === 'contact' ||
      (platform.config.exposeInput === 'disabled' && platform.config.inputContactList && (platform.config.inputContactList as string[]).includes(shellyDevice.id))
    ) {
      matterbridgeDevice.setAttribute(BooleanStateCluster.id, 'stateValue', value, shellyDevice.log, endpoint);
    }
    if (
      (platform.config.exposeInput === 'momentary' ||
        (platform.config.exposeInput === 'disabled' && platform.config.inputMomentaryList && (platform.config.inputMomentaryList as string[]).includes(shellyDevice.id))) &&
      value === true
    ) {
      matterbridgeDevice.triggerSwitchEvent('Single', shellyDevice.log, endpoint);
    }
    if (
      platform.config.exposeInput === 'latching' ||
      (platform.config.exposeInput === 'disabled' && platform.config.inputLatchingList && (platform.config.inputLatchingList as string[]).includes(shellyDevice.id))
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
  // Update for Devicepower
  if (shellyComponent.name === 'Devicepower' && property === 'battery' && isValidObject(value, 2)) {
    const battery = value as { V: number; percent: number };
    if (isValidNumber(battery.V, 0, 12) && isValidNumber(battery.percent, 0, 100)) {
      matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batPercentRemaining', battery.percent * 2, shellyDevice.log, endpoint);
      if (battery.percent < 10) matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Critical, shellyDevice.log, endpoint);
      else if (battery.percent < 20) matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Warning, shellyDevice.log, endpoint);
      else matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batChargeLevel', PowerSource.BatChargeLevel.Ok, shellyDevice.log, endpoint);
      matterbridgeDevice.setAttribute(PowerSourceCluster.id, 'batVoltage', battery.V * 1000, shellyDevice.log, endpoint);
    }
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
  // Update for Humidity when has value or rh
  if (shellyComponent.name === 'Humidity' && (property === 'value' || property === 'rh') && isValidNumber(value, 0, 100)) {
    matterbridgeDevice.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', value * 100, shellyDevice.log, endpoint);
  }
  // Update for Illuminance when has lux
  if (shellyComponent.name === 'Illuminance' && property === 'lux' && isValidNumber(value, 0)) {
    const matterLux = Math.round(Math.max(Math.min(10000 * Math.log10(value), 0xfffe), 0));
    matterbridgeDevice.setAttribute(IlluminanceMeasurementCluster.id, 'measuredValue', matterLux, shellyDevice.log, endpoint);
  }
  // Update for Thermostat enable
  if (shellyComponent.name === 'Thermostat' && property === 'enable' && isValidBoolean(value)) {
    if (value === false) matterbridgeDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Off, shellyDevice.log, endpoint);
    else if (value === true && shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'heating')
      matterbridgeDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat, shellyDevice.log, endpoint);
    else if (value === true && shellyComponent.hasProperty('type') && shellyComponent.getValue('type') === 'cooling')
      matterbridgeDevice.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Cool, shellyDevice.log, endpoint);
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
            matterbridgeDevice.log.error(`Error: current position not found on endpoint ${or}${endpoint.name}:${endpoint.number}${db} ${hk}WindowCovering${db}`);
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
  if (platform.config.exposePowerMeter === 'matter13' && ['Light', 'Rgb', 'Relay', 'Switch', 'Cover', 'Roller', 'PowerMeter'].includes(shellyComponent.name)) {
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
