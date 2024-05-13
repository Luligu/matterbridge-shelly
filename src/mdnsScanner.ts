/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { AnsiLogger, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, nf, rs, wr, zb } from 'node-ansi-logger';

import mdns, { ResponsePacket, QueryPacket } from 'multicast-dns';

export class MdnsScanner {
  private discoveredPeripherals = new Map<string, { id: string; host: string; gen: number }>();
  private log;
  private scanner = mdns();
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;

  private callback?: (id: string, host: string, gen: number) => void;

  constructor() {
    this.log = new AnsiLogger({ logName: 'mdnsShellyDiscover', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });

    this.scanner.on('response', (response: ResponsePacket) => {
      for (const answer of response.answers) {
        if (answer.type === 'A') {
          if (answer.name.startsWith('shelly')) {
            this.log.info(`Discovered shelly gen ${CYAN}1${nf} device id: ${hk}${answer.name.replace('.local', '')}${nf} host: ${zb}${answer.data}${nf}`);
            if (!this.discoveredPeripherals.has(answer.name.replace('.local', '')) && this.callback) this.callback(answer.name.replace('.local', ''), answer.data, 1);
            this.discoveredPeripherals.set(answer.name.replace('.local', ''), { id: answer.name.replace('.local', ''), host: answer.data, gen: 1 });
          }
        }
        /*
        if (answer.type === 'SRV') {
          console.log('[SRV] Name:', answer.name, answer.data);
        }
        if (answer.type === 'TXT') {
          console.log('[TXT] Name:', answer.name, answer.data.toString());
        }
        if (answer.type === 'PTR' && answer.name === '_http._tcp.local') {
          console.log('[PTR] Name:', answer.name, answer.data);
          if (answer.data.startsWith('shelly')) {
            console.log('Shelly:', response);
          }
        }
        */
      }
      for (const additional of response.additionals) {
        if (additional.type === 'A') {
          if (additional.name.startsWith('Shelly')) {
            this.log.info(`Discovered shelly gen ${CYAN}2${nf} device id: ${hk}${additional.name.replace('.local', '')}${nf} host: ${zb}${additional.data}${nf}`);
            if (!this.discoveredPeripherals.has(additional.name.replace('.local', '')) && this.callback) this.callback(additional.name.replace('.local', ''), additional.data, 2);
            this.discoveredPeripherals.set(additional.name.replace('.local', ''), { id: additional.name.replace('.local', ''), host: additional.data, gen: 2 });
          }
        }
        /*
        if (additional.type === 'SRV') {
          console.log('[SRV] Name:', additional.name, additional.data);
        }
        if (additional.type === 'TXT') {
          console.log('[TXT] Name:', additional.name, additional.data.toString());
        }
        */
      }
      // console.log(response);
    });
  }

  get isScanning() {
    return this._isScanning;
  }

  start(callback?: (id: string, host: string, gen: number) => void, timeout?: number) {
    this.log.info('Starting mDNS query service for shelly devices...');
    this._isScanning = true;
    this.callback = callback;
    this.scanner.query({
      questions: [
        {
          name: '_http._tcp.local',
          type: 'PTR',
        },
      ],
    });
    if (timeout && timeout > 0) {
      this.scannerTimeout = setTimeout(() => {
        this.stop();
      }, timeout * 1000);
    }
    this.log.info('Started mDNS query service for shelly devices.');
  }

  stop() {
    this.log.info('Stopping mDNS query service...');
    if (this.scannerTimeout) clearTimeout(this.scannerTimeout);
    this._isScanning = false;
    this.scannerTimeout = undefined;
    this.scanner.destroy();
    this.logPeripheral();
    this.log.info('Stopped mDNS query service.');
  }

  logPeripheral() {
    this.log.info(`Discovered ${this.discoveredPeripherals.size} shelly devices:`);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [name, { id, host, gen }] of this.discoveredPeripherals) {
      this.log.info(`- id: ${hk}${name}${nf} host: ${zb}${host}${nf} gen: ${CYAN}${gen}${nf}`);
    }
  }
}

/*
const mdnsScanner = new MdnsScanner();
mdnsScanner.start();

process.on('SIGINT', async function () {
  mdnsScanner.stop();
  mdnsScanner.logPeripheral();
  process.exit();
});
*/
