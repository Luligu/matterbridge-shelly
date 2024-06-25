/**
 * This file contains the class ShellyProperty.
 *
 * @file src\shellyProperty.ts
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

import { ShellyComponent } from './shellyComponent.js';
import { ShellyDataType } from './shellyTypes.js';

export class ShellyProperty {
  readonly component: ShellyComponent;
  readonly key: string;
  private _value: ShellyDataType;

  constructor(component: ShellyComponent, key: string, value: ShellyDataType) {
    this.key = key;
    this._value = value;
    this.component = component;
  }

  get value(): ShellyDataType {
    return this._value;
  }

  set value(value: ShellyDataType) {
    this._value = value;
  }
}
