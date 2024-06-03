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
