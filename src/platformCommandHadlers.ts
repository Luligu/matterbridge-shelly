/**
 * This file contains the commandHandler for ShellyPlatform.
 *
 * @file src\platformCommandHandlers.ts
 * @author Luca Liguori
 * @date 2024-12-03
 * @version 1.1.0
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

import { MatterbridgeEndpoint } from 'matterbridge';
import { db, debugStringify, hk, idn, nf, or, rs, YELLOW } from 'matterbridge/logger';
import { isValidNumber, isValidObject } from 'matterbridge/utils';

import { ShellyComponent, ShellyCoverComponent, ShellyLightComponent, ShellySwitchComponent } from './shellyComponent.js';

type PrimitiveValues = boolean | number | bigint | string | object | null | undefined;

/**
 * Handles the identify command for a Shelly device.
 *
 * @param {MatterbridgeDevice} endpoint - The Matterbridge device endpoint.
 * @param {ShellyComponent} component - The Shelly component.
 * @param {Record<string, PrimitiveValues>} request - The request payload.
 */
export function shellyIdentifyCommandHandler(endpoint: MatterbridgeEndpoint, component: ShellyComponent, request: Record<string, PrimitiveValues>): void {
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
export function shellySwitchCommandHandler(endpoint: MatterbridgeEndpoint, switchComponent: ShellySwitchComponent, command: string): void {
  if (command === 'On') switchComponent.On();
  else if (command === 'Off') switchComponent.Off();
  else if (command === 'Toggle') switchComponent.Toggle();
  endpoint.log.info(
    `${db}Sent command ${hk}${switchComponent.name}${db}:${hk}${switchComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${switchComponent.device.id}${rs}${db}`,
  );
}

/**
 * Handles light commands (On, Off, Toggle, Level, ColorRGB, ColorTemp) for a Shelly light component.
 *
 * @param {MatterbridgeDevice} endpoint - The Matterbridge device endpoint.
 * @param {ShellyLightComponent} lightComponent - The Shelly light component.
 * @param {string} command - The command to execute.
 * @param {number | null} [level] - The level for the command.
 * @param {{ r: number; g: number; b: number }} [color] - The color for the command.
 * @param {number} [colorTemp] - The color temperature for the command.
 * @returns {boolean} - Returns true if the command was executed successfully, false otherwise.
 */
export function shellyLightCommandHandler(
  endpoint: MatterbridgeEndpoint,
  lightComponent: ShellyLightComponent,
  command: string,
  level?: number | null,
  color?: { r: number; g: number; b: number },
  colorTemp?: number,
): void {
  // Send On() Off() Toggle() command
  if (command === 'On') lightComponent.On();
  else if (command === 'Off') lightComponent.Off();
  else if (command === 'Toggle') lightComponent.Toggle();
  if (command === 'On' || command === 'Off' || command === 'Toggle')
    endpoint.log.info(
      `${db}Sent command ${hk}${lightComponent.name}${db}:${hk}${lightComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${lightComponent.device.id}${rs}${db}`,
    );

  // Send Level() command
  if (command === 'Level' && isValidNumber(level, 1, 254)) {
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
}

/**
 * Handles cover commands (Stop, Open, Close, GoToPosition) for a Shelly cover component.
 *
 * @param {MatterbridgeDevice} endpoint - The Matterbridge device endpoint.
 * @param {ShellyCoverComponent} coverComponent - The Shelly cover component.
 * @param {string} command - The command to execute.
 * @param {number} [pos] - The position for the command.
 */
export function shellyCoverCommandHandler(endpoint: MatterbridgeEndpoint, coverComponent: ShellyCoverComponent, command: string, pos?: number): void {
  // Matter uses 10000 = fully closed   0 = fully opened
  // Shelly uses 0 = fully closed   100 = fully opened
  if (command === 'Stop') {
    endpoint.log.info(
      `${db}Sent command ${hk}${coverComponent.name}${db}:${hk}${coverComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${coverComponent.device.id}${rs}${db}`,
    );
    coverComponent.Stop();
  } else if (command === 'Open') {
    endpoint.log.info(
      `${db}Sent command ${hk}${coverComponent.name}${db}:${hk}${coverComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${coverComponent.device.id}${rs}${db}`,
    );
    coverComponent.Open();
  } else if (command === 'Close') {
    endpoint.log.info(
      `${db}Sent command ${hk}${coverComponent.name}${db}:${hk}${coverComponent.id}${db}:${hk}${command}()${db} to shelly device ${idn}${coverComponent.device.id}${rs}${db}`,
    );
    coverComponent.Close();
  } else if (command === 'GoToPosition' && isValidNumber(pos, 0, 10000)) {
    const shellyPos = 100 - Math.max(Math.min(Math.round(pos / 100), 100), 0);
    endpoint.log.info(
      `${db}Sent command ${hk}${coverComponent.name}${db}:${hk}${coverComponent.id}${db}:${hk}${command}(${YELLOW}${shellyPos}${hk})${db} to shelly device ${idn}${coverComponent.device.id}${rs}${db}`,
    );
    coverComponent.GoToPosition(shellyPos);
  }
}
