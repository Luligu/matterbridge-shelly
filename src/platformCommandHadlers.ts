/**
 * This file contains the commandHandler for ShellyPlatform.
 *
 * @file src\platformCommandHandlers.ts
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

import { EndpointNumber, MatterbridgeDevice, WindowCovering, WindowCoveringCluster } from 'matterbridge';
import { db, debugStringify, dn, er, hk, idn, nf, or, rs, YELLOW } from 'matterbridge/logger';
import { isValidNumber, isValidObject } from 'matterbridge/utils';

import { ShellyDevice } from './shellyDevice.js';
import { ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';

type PrimitiveValues = boolean | number | bigint | string | object | null | undefined;

export function shellyIdentifyCommandHandler(endpoint: MatterbridgeDevice, component: ShellyComponent, request: Record<string, PrimitiveValues>): void {
  endpoint.log.info(
    `Identify command received for endpoint ${or}${endpoint.name}${nf}:${or}${endpoint.number}${nf} component ${hk}${component.name}${nf}:${hk}${component.id}${nf} request ${debugStringify(request)}`,
  );
}

export function shellySwitchCommandHandler(
  matterbridgeDevice: MatterbridgeDevice,
  endpointNumber: EndpointNumber | undefined,
  shellyDevice: ShellyDevice,
  command: string,
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
  // Get the Shelly component
  const componentName = endpoint.uniqueStorageKey;
  if (!componentName) {
    shellyDevice.log.error(`shellyCommandHandler error: componentName not found for endpoint ${endpointNumber} on shelly device ${dn}${shellyDevice?.id}${er}`);
    return false;
  }
  const switchComponent = shellyDevice.getComponent(componentName) as ShellySwitchComponent;
  if (!switchComponent) {
    shellyDevice.log.error(`shellyCommandHandler error: component ${componentName} not found for shelly device ${dn}${shellyDevice?.id}${er}`);
    return false;
  }

  // Send On() Off() Toggle() command
  if (command === 'On') switchComponent.On();
  else if (command === 'Off') switchComponent.Off();
  else if (command === 'Toggle') switchComponent.Toggle();
  if (command === 'On' || command === 'Off' || command === 'Toggle')
    shellyDevice.log.info(`${db}Sent command ${hk}${componentName}${nf}:${command}()${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`);
  return true;
}

export function shellyLightCommandHandler(
  matterbridgeDevice: MatterbridgeDevice,
  endpointNumber: EndpointNumber | undefined,
  shellyDevice: ShellyDevice,
  command: string,
  state?: boolean,
  level?: number | null,
  color?: { r: number; g: number; b: number },
  colorTemp?: number,
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
  // Get the Shelly component
  const componentName = endpoint.uniqueStorageKey;
  if (!componentName) {
    shellyDevice.log.error(`shellyCommandHandler error: componentName not found for endpoint ${endpointNumber} on shelly device ${dn}${shellyDevice?.id}${er}`);
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

  // Send ColorTemp() command
  if (command === 'ColorTemp' && isValidNumber(colorTemp, 147, 500)) {
    const minColorTemp = 147;
    const maxColorTemp = 500;
    const minTemp = shellyDevice.model === 'SHBDUO-1' ? 2700 : 3000;
    const maxTemp = 6500;
    const temp = Math.max(Math.min(Math.round(((colorTemp - minColorTemp) / (maxColorTemp - minColorTemp)) * (minTemp - maxTemp) + maxTemp), maxTemp), minTemp);
    const lightComponent = shellyDevice?.getComponent(componentName) as ShellyLightComponent;
    lightComponent.ColorTemp(temp);
    shellyDevice.log.info(
      `${db}Sent command ${hk}${componentName}${nf}:ColorTemp(for model ${shellyDevice.model} ${YELLOW}${colorTemp}->${temp}${nf})${db} to shelly device ${idn}${shellyDevice?.id}${rs}${db}`,
    );
  }
  return true;
}

export function shellyCoverCommandHandler(
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
    shellyDevice.log.error(`shellyCoverCommandHandler error: componentName not found for endpoint ${endpointNumber} on shelly device ${dn}${shellyDevice?.id}${er}`);
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
