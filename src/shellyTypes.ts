/**
 * This file contains the shelly types.
 *
 * @file src\shellyTypes.ts
 * @author Luca Liguori
 * @date 2024-05-01
 * @version 2.0.0
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

export type AnyPrimitive = string | number | bigint | boolean | symbol | null | undefined;
export type AnyValue = AnyPrimitive | AnyPrimitive[] | Record<string, AnyPrimitive | AnyPrimitive[] | Record<string, AnyPrimitive>>;
export type AnyObject = Record<string, AnyValue>;

export declare type ParamsTypes = boolean | number | string;

export type ShellyDeviceId = string;

export type ShellyData = Record<string, ShellyDataType>;

export type ShellyDataType = string | number | boolean | null | undefined | object;

export interface Pm1Meter {
  id: number;
  voltage: number;
  current: number;
  apower: number;
  freq: number;
  aenergy: {
    total: number;
    by_minute: number[];
    minute_ts: number;
  };
  ret_aenergy: {
    total: number;
    by_minute: number[];
    minute_ts: number;
  };
}

export interface Em1Meter {
  id: number;
  act_power: number;
  aprt_power: number;
  current: number;
  freq: number;
  pf: number;
  voltage: number;
}

export interface Em1MeterData {
  id: number;
  total_act_energy: number;
  total_act_ret_energy: number;
}

// Define the interface for the BTHomeDeviceComponent status object
export interface BTHomeDeviceComponentStatus {
  id: number;
  rssi: number;
  battery: number;
  packet_id: number;
  last_updated_ts: number;
  paired?: boolean;
  rpc?: boolean;
  rsv?: number;
}

// Define the interface for the BTHomeDeviceComponent config object
export interface BTHomeDeviceComponentConfig {
  id: number;
  addr: string;
  name: null | undefined | string;
  key: null | undefined | string;
  meta: {
    ui: {
      view: string;
      local_name: string;
      icon: ShellyDataType;
    };
  };
}

// Define the interface for the BTHomeDeviceComponent attrs object
export interface BTHomeDeviceComponentAttrs {
  flags: number;
  model_id: number;
}

// Define the main interface for the BTHomeDeviceComponent
export interface BTHomeDeviceComponent {
  key: string;
  status: BTHomeDeviceComponentStatus;
  config: BTHomeDeviceComponentConfig;
  attrs?: BTHomeDeviceComponentAttrs;
}

// Define the interface for the BTHomeBluTrv component status object
export interface BTHomeBluTrvComponentStatus {
  id: number;
  target_C: number;
  current_C: number;
  pos: number;
  rssi: number;
  battery: number;
  packet_id: number;
  last_updated_ts: number;
  paired?: boolean;
  rpc: boolean;
  rsv: number;
}

// Define the interface for the BTHomeBluTrv component config object
export interface BTHomeBluTrvComponentConfig {
  id: number;
  addr: string;
  name: null | undefined | string;
  key: null | undefined | string;
  trv: string;
  temp_sensors: string[];
  dw_sensors: string[];
  override_delay: number;
  meta: {
    ui: {
      view: string;
      local_name: string;
      icon: ShellyDataType;
    };
  };
}

// Define the interface for the BTHomeBluTrv component attrs object
export interface BTHomeBluTrvComponentAttrs {
  flags: number;
  model_id: number;
}

// Define the main interface for the BTHomeBluTrvComponent
export interface BTHomeBluTrvComponent {
  key: string;
  status: BTHomeBluTrvComponentStatus;
  config: BTHomeBluTrvComponentConfig;
  attrs: BTHomeBluTrvComponentAttrs;
}

// Define the interface for the BTHomeSensorComponent status object
export interface BTHomeSensorComponentStatus {
  id: number;
  value: ShellyDataType;
  last_updated_ts: number;
}

// Define the interface for the BTHomeSensorComponent config object
export interface BTHomeSensorComponentConfig {
  id: number;
  addr: string;
  name: null | undefined | string;
  obj_id: number;
  idx: number;
  meta:
    | null
    | undefined
    | {
        ui: {
          view: string;
          local_name: string;
          icon: ShellyDataType;
        };
      };
}

// Define the main interface for BTHomeSensorComponent
export interface BTHomeSensorComponent {
  key: string;
  status: BTHomeSensorComponentStatus;
  config: BTHomeSensorComponentConfig;
}

// Define the generic interface for the components of BTHomeComponentPayload Shelly.GetComponents
export interface BTHomeComponent {
  key: string;
  status: BTHomeBluTrvComponentStatus | BTHomeDeviceComponentStatus | BTHomeSensorComponentStatus;
  config: BTHomeBluTrvComponentConfig | BTHomeDeviceComponentConfig | BTHomeSensorComponentConfig;
  attrs?: BTHomeBluTrvComponentAttrs | BTHomeDeviceComponentAttrs;
}

// Define the generic interface for the BTHomeComponentPayload Shelly.GetComponents
export interface BTHomeComponentPayload {
  components: BTHomeComponent[];
  cfg_rev: number;
  offset: number;
  total: number;
}

// Define the interface for ShellyEvent
export interface ShellyEvent {
  component: string;
  event: string;
  ts: number;
  id?: number;
  target?: string;
  restart_required?: boolean;
  cfg_rev?: number;
  time_ms?: number;
  progress_percent?: number;
}
