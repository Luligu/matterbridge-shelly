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

/**
 * Handles the identify command for a Shelly device.
 *
 * @param {MatterbridgeDevice} endpoint - The Matterbridge device endpoint.
 * @param {ShellyComponent} component - The Shelly component.
 * @param {Record<string, PrimitiveValues>} request - The request payload.
 */
export function shellyIdentifyCommandHandler(endpoint: MatterbridgeDevice, component: ShellyComponent, request: Record<string, PrimitiveValues>): void {
  endpoint.log.info(
    `Identify command received for endpoint ${or}${endpoint.name}${nf}:${or}${endpoint.number}${nf} component ${hk}${component.name}${nf}:${hk}${component.id}${nf} request ${debugStringify(request)}`,
  );
}

/**
 * Handles switch commands (On, Off, Toggle) for a Shelly switch component.
 *
 * @param {MatterbridgeDevice} endpoint - The Matterbridge device endpoint.
 * @param {ShellySwitchComponent} switchComponent - The Shelly switch component.
 * @param {string} command - The command to execute (On, Off, Toggle).
 */
export function shellySwitchCommandHandler(endpoint: MatterbridgeDevice, switchComponent: ShellySwitchComponent, command: string): void {
  if (command === 'On') switchComponent.On();
  else if (command === 'Off') switchComponent.Off();
  else if (command === 'Toggle') switchComponent.Toggle();
  endpoint.log.info(
    `${db}Sent command ${hk}${switchComponent.name}${db}:${hk}${switchComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${switchComponent.device.id}${rs}${db}`,
  );
}

export function shellyLightCommandHandler(
  endpoint: MatterbridgeDevice,
  lightComponent: ShellyLightComponent,
  command: string,
  level?: number | null,
  color?: { r: number; g: number; b: number },
  colorTemp?: number,
): boolean {
  // Send On() Off() Toggle() command
  if (command === 'On') lightComponent.On();
  else if (command === 'Off') lightComponent.Off();
  else if (command === 'Toggle') lightComponent.Toggle();
  if (command === 'On' || command === 'Off' || command === 'Toggle')
    endpoint.log.info(
      `${db}Sent command ${hk}${lightComponent.name}${db}:${hk}${lightComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${lightComponent.device.id}${rs}${db}`,
    );

  // Send Level() command
  if (command === 'Level' && isValidNumber(level, 0, 254)) {
    const shellyLevel = Math.max(Math.min(Math.round((level / 254) * 100), 100), 1);
    lightComponent.Level(shellyLevel);
    endpoint.log.info(
      `${db}Sent command ${hk}${lightComponent.name}${db}:${hk}${lightComponent.id}${db}:${hk}Level(${YELLOW}${shellyLevel}${hk})${db} to shelly device ${idn}${lightComponent.device.id}${rs}${db}`,
    );
  }

  // Send ColorRGB() command
  if (command === 'ColorRGB' && isValidObject(color, 3, 3)) {
    color.r = Math.max(Math.min(color.r, 255), 0);
    color.g = Math.max(Math.min(color.g, 255), 0);
    color.b = Math.max(Math.min(color.b, 255), 0);
    lightComponent.ColorRGB(color.r, color.g, color.b);
    endpoint.log.info(
      `${db}Sent command ${hk}${lightComponent.name}${db}:${hk}${lightComponent.id}${db}:${hk}ColorRGB(${YELLOW}${color.r}${hk}, ${YELLOW}${color.g}${hk}, ${YELLOW}${color.b}${hk})${db} to shelly device ${idn}${lightComponent.device.id}${rs}${db}`,
    );
  }

  // Send ColorTemp() command
  if (command === 'ColorTemp' && isValidNumber(colorTemp, 147, 500)) {
    const minColorTemp = 147;
    const maxColorTemp = 500;
    const minTemp = lightComponent.device.model === 'SHBDUO-1' ? 2700 : 3000;
    const maxTemp = 6500;
    const temp = Math.max(Math.min(Math.round(((colorTemp - minColorTemp) / (maxColorTemp - minColorTemp)) * (minTemp - maxTemp) + maxTemp), maxTemp), minTemp);
    lightComponent.ColorTemp(temp);
    endpoint.log.info(
      `${db}Sent command ${hk}${lightComponent.name}${db}:${hk}${lightComponent.id}${db}:${hk}ColorTemp(for model ${lightComponent.device.model} ${YELLOW}${colorTemp}${hk}->${YELLOW}${temp}${hk})${db} to shelly device ${idn}${lightComponent.device.id}${rs}${db}`,
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
