/* eslint-disable @typescript-eslint/no-explicit-any */
// shellies.d.ts
declare module 'shellies' {
  interface Request extends superagent.SuperAgentRequest {
    // You can add additional properties or methods if needed
    query(params: object): this
  }

  interface SuperAgentStatic extends superagent.SuperAgentStatic {
    timeout(ms: number): this,
    set(field: string, val: string): this,
    get(url: string): Request
    // Include other methods from superagent if needed
  }

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

    request: SuperAgentStatic;
    // async request(endpoint: string): Promise<void>;

    *[Symbol.iterator](): Iterator<[string, any]> {
      if (this._props.has('*')) {
        // adding the props to a new Set here to filter out duplicates
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        for (const prop of new Set(this._props.get('*')!.values())) {
          yield [prop, this[prop]];
        }
      }

      if (this.mode && this._props.has(this.mode)) {
        // adding the props to a new Set here to filter out duplicates
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

    _statusUpdateHandler(msg);

    setAuthCredentials(username: string, password: string): void;

    async start(networkInterface: string = null): void;
    stop(): void;
    on(event: 'discover' | 'add' | 'remove', listener: (device: Device) => void): this;

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
