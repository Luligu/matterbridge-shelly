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

export declare type ParamsTypes = boolean | number | string;

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
}

// Define the interface for the BTHomeDeviceComponent config object
export interface BTHomeDeviceComponentConfig {
  id: number;
  addr: string;
  name: string;
  key: ShellyDataType;
  meta: {
    ui: {
      view: string;
      local_name: string;
      icon: ShellyDataType;
    };
  };
}

// Define the main interface for the BTHomeDeviceComponent
export interface BTHomeDeviceComponent {
  key: string;
  status: BTHomeDeviceComponentStatus;
  config: BTHomeDeviceComponentConfig;
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
  name: string;
  obj_id: number;
  idx: number;
  meta: {
    ui: {
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

// Define the generic interface for BTHomeDeviceComponent and BTHomeSensorComponent
export interface BTHomeComponent {
  key: string;
  status: BTHomeDeviceComponentStatus | BTHomeSensorComponentStatus;
  config: BTHomeDeviceComponentStatus | BTHomeSensorComponentConfig;
}

// Define the interface for BTHomeEvent from the BTHomeDevice on WebSocket
export interface BTHomeEvent {
  component: string;
  id: number;
  event: string;
  ts: number;
  data?: ShellyData;
}

// Define the interface for WebSocket NotifyStatus from a BTHomeDevice
export interface BTHomeStatusDevice {
  id: number; // The BTHome device id: 200, 201 etc.
  last_updated_ts: number;
  packet_id: number;
  rssi: number;
}

// Define the interface for WebSocket NotifyStatus from a BTHomeSensor
export interface BTHomeStatusSensor {
  id: number; // The BTHome device id: 200, 201 etc.
  last_updated_ts: number;
  value?: ShellyDataType;
}
