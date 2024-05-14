/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
/* eslint-disable @typescript-eslint/no-explicit-any */
// shellies.d.ts
declare module 'shellies' {
  /*
  interface Device {
    id: string;
    lastSeen: Date | null;
    _online: boolean;
    _ttl: number;
    _ttlTimer: NodeJS.Timer | null;
    _name: string | null;
    _props: Map<string, Map<number, string>>;
    _request: any; // Type as necessary
    host: string; // Assuming getters and setters imply a simple type
    settings: any; // Type as necessary
    [key: string]: any; // Allowing for dynamic access to other properties
  }
  */

  export class Device extends EventEmitter {
    constructor(id: string, host: string);

    id: string;
    host: string;
    mode: string;

    readonly type: string;
    readonly modelName: string;
    online: boolean;
    ttl: number;
    name: string;
    readonly request: string;

    *[Symbol.iterator](): Iterator<[string, any]> {
      if (this._props.has('*')) {
        // adding the props to a new Set here to filter out duplicates
        for (const prop of new Set(this._props.get('*')!.values())) {
          yield [prop, this[prop]];
        }
      }

      if (this.mode && this._props.has(this.mode)) {
        // adding the props to a new Set here to filter out duplicates
        for (const prop of new Set(this._props.get(this.mode)!.values())) {
          yield [prop, this[prop]];
        }
      }
    }

    setAuthCredentials(username: string, password: string): void;
    async getSettings(): Promise<object>;
    async getStatus(): Promise<object>;
    async reboot(): Promise<void>;
    on(event: 'change', listener: (prop: string, newValue: any, oldValue: any) => void): this;
    on(event: 'offline', listener: () => void): this;
  }

  class Shellies extends EventEmitter {
    constructor();

    readonly size: number;
    readonly running: boolean;

    [Symbol.iterator](): Iterator<Device>;

    setAuthCredentials(username: string, password: string): void;

    async start(networkInterface: string = null): void;
    stop(): void;
    on(event: 'discover', listener: (device: Device) => void): this;
    on(event: 'add', listener: (device: Device) => void): this;
    on(event: 'remove', listener: (device: Device) => void): this;

    createDevice(type: string, id: string, host: string): Device;
    getDevice(type: string, id: string): Device | undefined;
    hasDevice(device: Device): boolean;
    addDevice(device: Device): void;
    removeDevice(device: Device): void;
    removeAllDevices(): void;
    isUnknownDevice(device: Device): boolean;
  }
  const shellies: Shellies;
  export default shellies;
}
