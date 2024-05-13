/* eslint-disable @typescript-eslint/no-explicit-any */
// shellies.d.ts
declare module 'shellies' {
  export interface Device {
    type: string;
    id: string;
    host: string;
    mode: string;
    on(event: 'change', listener: (prop: string, newValue: any, oldValue: any) => void): this;
    on(event: 'offline', listener: () => void): this;
  }

  class Shellies extends EventEmitter {
    constructor();

    readonly size: number;
    readonly running: boolean;

    [Symbol.iterator](): Iterator<Device>;

    setAuthCredentials(username: string, password: string): void;

    async start(): void;
    stop(): void;
    on(event: 'discover', listener: (device: Device) => void): this;

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
