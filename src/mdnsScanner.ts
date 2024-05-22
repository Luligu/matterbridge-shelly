// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnsiLogger, BLUE, BRIGHT, CYAN, GREEN, TimestampFormat, db, debugStringify, dn, hk, idn, nf, rs, wr, zb } from 'node-ansi-logger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import mdns, { ResponsePacket, QueryPacket } from 'multicast-dns';

export class MdnsScanner {
  private discoveredPeripherals = new Map<string, { id: string; host: string; gen: number }>();
  private log;
  private scanner?: mdns.MulticastDNS;
  private _isScanning = false;
  private scannerTimeout?: NodeJS.Timeout;
  private queryTimeout?: NodeJS.Timeout;

  private callback?: (id: string, host: string, gen: number) => Promise<void>;

  constructor() {
    this.log = new AnsiLogger({ logName: 'mdnsShellyDiscover', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  }

  get isScanning() {
    return this._isScanning;
  }

  start(callback?: (id: string, host: string, gen: number) => Promise<void>, timeout?: number, debug = false) {
    this.log.info('Starting mDNS query service for shelly devices...');
    this._isScanning = true;
    this.callback = callback;

    this.scanner = mdns();
    this.scanner.on('response', async (response: ResponsePacket) => {
      let port = 0;
      let gen = 0;
      for (const a of response.answers) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'PTR' && a.name === '_http._tcp.local') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'NSEC' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'SRV' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
        }
        if (a.type === 'SRV' && a.name.startsWith('shelly')) {
          port = a.data.port;
        }
        if (a.type === 'A' && a.name.startsWith('shelly')) {
          if (!this.discoveredPeripherals.has(a.name.replace('.local', ''))) {
            this.log.info(`Discovered shelly gen ${CYAN}1${nf} device id: ${hk}${a.name.replace('.local', '')}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`);
            this.discoveredPeripherals.set(a.name.replace('.local', ''), { id: a.name.replace('.local', ''), host: a.data, gen: 1 });
            if (this.callback) await this.callback(a.name.replace('.local', ''), a.data, 1);
          }
        }
      }
      for (const a of response.additionals) {
        if (debug && a.type === 'PTR') {
          this.log.debug(`[${idn}${a.type}${rs}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'PTR' && a.name === '_http._tcp.local') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'A' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'NSEC' && a.name.startsWith('shelly')) {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'SRV') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${typeof a.data === 'string' ? a.data : debugStringify(a.data)}`);
        }
        if (debug && a.type === 'TXT') {
          this.log.debug(`[${BLUE}${a.type}${db}] Name: ${CYAN}${a.name}${db} data: ${a.data}`);
        }
        if (a.type === 'SRV' && a.name.startsWith('shelly')) {
          port = a.data.port;
        }
        if (a.type === 'TXT' && a.name.startsWith('shelly')) {
          gen = parseInt(a.data.toString().replace('gen=', ''));
        }
        if (a.type === 'A' && a.name.startsWith('Shelly')) {
          if (!this.discoveredPeripherals.has(a.name.replace('.local', '').toLowerCase())) {
            this.log.info(
              `Discovered shelly gen ${CYAN}${gen}${nf} device id: ${hk}${a.name.replace('.local', '').toLowerCase()}${nf} host: ${zb}${a.data}${nf} port: ${zb}${port}${nf}`,
            );
            this.discoveredPeripherals.set(a.name.replace('.local', '').toLowerCase(), {
              id: a.name.replace('.local', '').toLowerCase(),
              host: a.data,
              gen,
            });
            if (this.callback) await this.callback(a.name.replace('.local', '').toLowerCase(), a.data, gen);
          }
        }
      }
      // console.log(response);
    });

    this.scanner.query('_http._tcp.local', 'PTR');
    this.queryTimeout = setInterval(() => {
      this.scanner?.query('_http._tcp.local', 'PTR');
    }, 10000);
    /*
    this.scanner.query({
      questions: [
        {
          name: '_http._tcp.local',
          type: 'PTR',
        },
      ],
    });
    */
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
    if (this.queryTimeout) clearTimeout(this.queryTimeout);
    this._isScanning = false;
    this.scannerTimeout = undefined;
    this.queryTimeout = undefined;
    this.scanner?.destroy();
    this.scanner = undefined;
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

if (process.argv.includes('mdnsScanner')) {
  const mdnsScanner = new MdnsScanner();
  mdnsScanner.start(undefined, undefined, true);

  process.on('SIGINT', async function () {
    mdnsScanner.stop();
    process.exit();
  });
}
