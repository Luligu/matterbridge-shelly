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
    start(): void;
    stop(): void;
    on(event: 'discover', listener: (device: Device) => void): this;
  }
  const shellies: Shellies;
  export default shellies;
}
