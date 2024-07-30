/* eslint-disable no-console */
import dgram from 'dgram';
import os from 'os';

interface MdnsScannerOptions {
  interface?: string;
}

class MdnsScanner {
  private socket: dgram.Socket;
  private multicastAddress = '224.0.0.251';
  private multicastPort = 5353;
  private networkInterfaceAddress: string | undefined;

  constructor(options: MdnsScannerOptions = {}) {
    this.networkInterfaceAddress = options.interface ? this.getInterfaceAddress(options.interface) : undefined;
    console.log(`Using network interface address: ${this.networkInterfaceAddress}`);

    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('listening', this.onListening);
    this.socket.on('message', this.onMessage);
    this.socket.on('error', this.onError);

    this.socket.bind(this.multicastPort);
  }

  private getInterfaceAddress(iface?: string): string | undefined {
    if (!iface) return undefined;

    const interfaces = os.networkInterfaces();
    const addresses = interfaces[iface];

    if (!addresses) {
      throw new Error(`Interface ${iface} not found`);
    }

    const ipv4Address = addresses.find((addr) => addr.family === 'IPv4');

    if (!ipv4Address) {
      throw new Error(`Interface ${iface} does not have an IPv4 address`);
    }

    return ipv4Address.address;
  }

  private onListening = () => {
    console.log('Socket is listening');
    if (this.networkInterfaceAddress) {
      this.socket.setMulticastInterface(this.networkInterfaceAddress);
    }
    this.socket.addMembership(this.multicastAddress, this.networkInterfaceAddress);
  };

  private onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    console.log(`Received message from ${rinfo.address}:${rinfo.port}`);
    console.log(msg.toString());
  };

  private onError = (err: Error) => {
    console.error(`Socket error:\n${err.stack}`);
    this.socket.close();
  };

  public query = (name = '_services._dns-sd._udp.local', type = 'PTR') => {
    const queryBuffer = this.buildQuery(name, type);
    this.socket.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddress, (err) => {
      if (err) console.error(err);
      else console.log('Query sent');
    });
  };

  private buildQuery(name: string, type: string): Buffer {
    // Build an mDNS query packet
    const parts = name.split('.').filter((part) => part.length > 0);
    const query = Buffer.alloc(12 + parts.reduce((len, part) => len + part.length + 1, 0) + 5);

    // Transaction ID: 2 bytes
    query.writeUInt16BE(0, 0);

    // Flags: 2 bytes
    query.writeUInt16BE(0, 2);

    // Questions: 1 question
    query.writeUInt16BE(1, 4);

    // Answer RRs, Authority RRs, Additional RRs: 0 RRs
    query.writeUInt16BE(0, 6);
    query.writeUInt16BE(0, 8);
    query.writeUInt16BE(0, 10);

    let offset = 12;
    parts.forEach((part) => {
      query.writeUInt8(part.length, offset++);
      query.write(part, offset);
      offset += part.length;
    });

    // End of QNAME
    query.writeUInt8(0, offset++);

    // QTYPE
    query.writeUInt16BE(type === 'PTR' ? 12 : 1, offset);
    offset += 2;

    // QCLASS (IN)
    query.writeUInt16BE(1, offset);

    return query;
  }

  public stop = () => {
    this.socket.close();
  };

  public static listNetworkInterfaces = () => {
    const interfaces = os.networkInterfaces();
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      for (const address of addresses) {
        console.log(`Interface: ${name} - Address: ${address.address}`);
      }
    }
  };
}

// Example usage
MdnsScanner.listNetworkInterfaces(); // List available network interfaces

// const scanner = new MdnsScanner({ interface: 'WiFi' }); // Replace 'WiFi' with the desired interface name
const scanner = new MdnsScanner({ interface: process.argv[2] }); // Replace 'WiFi' with the desired interface name

scanner.query(); // Sends a PTR query for '_services._dns-sd._udp.local'

setTimeout(() => {
  scanner.stop();
}, 10000); // Stop scanning after 10 seconds
