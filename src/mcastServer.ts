import { AnsiLogger, TimestampFormat } from 'node-ansi-logger';
import { getIpv4InterfaceAddress } from './utils.js';
import dgram from 'dgram';

export class Multicast {
  private log;
  private dgramServer?: dgram.Socket;
  private dgramClient?: dgram.Socket;
  private clientTimeout?: NodeJS.Timeout;
  dgramServerBound = false;
  dgramClientBound = false;

  constructor() {
    this.log = new AnsiLogger({ logName: 'mcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: true });
  }

  startDgramServer(callback?: () => void) {
    this.log.info('Starting dgram multicast server...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const PORT = 5683;
    const INTERFACE = getIpv4InterfaceAddress();

    this.dgramServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.dgramServer.on('error', (err) => {
      this.log.error(`Dgram multicast server socket error:\n${err.stack}`);
      this.dgramServer?.close();
    });

    this.dgramServer.on('message', (msg, rinfo) => {
      this.log.info(`Message "${msg}" received from ${rinfo.address}:${rinfo.port}`);
    });

    this.dgramServer.on('listening', () => {
      if (!this.dgramServer) {
        this.log.error('Dgram multicast server error listening for multicast messages...');
        return;
      }
      const address = this.dgramServer.address();
      this.log.info(`Dgram multicast server listening on ${address.address}:${address.port}`);
      this.dgramServer.addMembership(MULTICAST_ADDRESS, INTERFACE);
      this.log.info(`Dgram multicast server joined multicast group: ${MULTICAST_ADDRESS} with interface: ${INTERFACE} on port: ${PORT}`);
    });

    this.dgramServer.bind(PORT, INTERFACE, () => {
      if (!this.dgramServer) {
        this.log.error('Dgram multicast server error binding for multicast messages...');
        return;
      }
      this.dgramServer.setBroadcast(true);
      this.dgramServer.setMulticastTTL(128);
      this.dgramServerBound = true;
      this.log.info(`Dgram multicast server bound with interface: ${INTERFACE} on port: ${PORT}`);
      if (callback) callback();
    });
  }

  startDgramClient(callback?: () => void) {
    this.log.info('Starting dgram multicast client...');
    const MULTICAST_ADDRESS = '224.0.1.187';
    const PORT = 5683;
    const INTERFACE = getIpv4InterfaceAddress();

    const message = Buffer.from('Test multicast message');

    this.dgramClient = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.dgramClient.bind(() => {
      if (!this.dgramClient) {
        this.log.error('Dgram multicast client error binding for multicast messages...');
        return;
      }
      this.dgramClient?.setBroadcast(true);
      this.dgramClient?.setMulticastTTL(128);
      this.dgramClient?.addMembership(MULTICAST_ADDRESS, INTERFACE);
      this.dgramClientBound = true;
      this.log.info(`Dgram multicast client bound on multicast group: ${MULTICAST_ADDRESS} with interface: ${INTERFACE}`);
      if (callback) callback();

      this.clientTimeout = setInterval(() => {
        this.dgramClient?.send(message, 0, message.length, PORT, MULTICAST_ADDRESS, (error: Error | null) => {
          if (error) {
            this.log.error(`Dgram multicast client failed to send message: ${error.stack}`);
          } else {
            this.log.info(`Dgram multicast client sent message "Test multicast message" to ${MULTICAST_ADDRESS}:${PORT}`);
          }
        });
      }, 1000); // Send message every second
    });
  }

  stop() {
    this.log.info('Stopping dgram server for shelly devices...');
    if (this.dgramServer) this.dgramServer.close();
    this.dgramServer = undefined;

    this.log.info('Stopping dgram client for shelly devices...');
    if (this.clientTimeout) clearTimeout(this.clientTimeout);
    this.clientTimeout = undefined;
    if (this.dgramClient) this.dgramClient.close();
    this.dgramClient = undefined;

    this.log.info('Stopped dgram server and client for shelly devices.');
  }
}

if (process.argv.includes('mcastServer') || process.argv.includes('mcastClient')) {
  const mcast = new Multicast();

  if (process.argv.includes('mcastServer')) mcast.startDgramServer();

  if (process.argv.includes('mcastClient')) mcast.startDgramClient();

  process.on('SIGINT', async function () {
    mcast.stop();
    process.exit();
  });
}
