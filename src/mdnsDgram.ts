/* eslint-disable no-console */
import dgram from 'dgram';
import { AnsiLogger, GREEN, idn, LogLevel, rs, TimestampFormat } from 'node-ansi-logger';
import os from 'os';

class MdnsScanner {
  private readonly log;

  private socket: dgram.Socket;
  private multicastAddressIpv4 = '224.0.0.251';
  private multicastAddressIpv6 = 'ff02::fb';
  private multicastPort = 5353;
  // private multicastAddress = '224.0.1.187';
  // private multicastPort = 5683;
  private networkInterfaceAddressIpv4: string | undefined;
  private networkInterfaceAddressIpv6: string | undefined;

  constructor(networkInterface?: string) {
    this.log = new AnsiLogger({ logName: 'MdnsScanner', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

    this.networkInterfaceAddressIpv4 = networkInterface ? this.getIpv4InterfaceAddress(networkInterface) : undefined;
    this.networkInterfaceAddressIpv6 = networkInterface ? this.getIpv6InterfaceAddress(networkInterface) : undefined;
    if (this.networkInterfaceAddressIpv4) this.log.debug(`Using network interface IPv4 address: ${this.networkInterfaceAddressIpv4}`);
    if (this.networkInterfaceAddressIpv6) this.log.debug(`Using network interface IPv6 address: ${this.networkInterfaceAddressIpv6}`);

    this.socket = dgram.createSocket({ type: 'udp6', reuseAddr: true });

    this.socket.on('listening', this.onListening);
    this.socket.on('message', this.onMessage);
    this.socket.on('warning', this.onWarning);
    this.socket.on('error', this.onError);

    // this.socket.bind(this.multicastPort);
    // Bind the socket to port 5353 and address '::' to handle both IPv4 and IPv6 traffic
    this.socket.bind({ port: this.multicastPort, address: '::', exclusive: false });
  }

  private onListening = () => {
    if (this.networkInterfaceAddressIpv4) {
      this.log.debug(`Setting multicast interface IPv4: ${this.networkInterfaceAddressIpv4}`);
      this.socket.setMulticastInterface(this.networkInterfaceAddressIpv4);
    }
    if (this.networkInterfaceAddressIpv6) {
      this.log.debug(`Setting multicast interface IPv6: ${this.networkInterfaceAddressIpv6}`);
      this.socket.setMulticastInterface(this.networkInterfaceAddressIpv6);
    }
    // this.log.debug(`Adding multicast membership IPv4: ${this.multicastAddressIpv4} interface: ${this.networkInterfaceAddressIpv4}`);
    // this.socket.addMembership(this.multicastAddressIpv4, this.networkInterfaceAddressIpv4);
    this.log.debug(`Adding multicast membership IPv6: ${this.multicastAddressIpv6} interface: ${this.networkInterfaceAddressIpv6}`);
    this.socket.addMembership(this.multicastAddressIpv6, this.networkInterfaceAddressIpv6);
    const address = this.socket.address();
    console.log(
      `Socket is listening using network interface address IPv4=${this.networkInterfaceAddressIpv4}, IPv6=${this.networkInterfaceAddressIpv6} bound on ${address.family} ${address.address}:${address.port}`,
    );
  };

  private onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    console.log(`\nReceived message from ${rinfo.address}:${rinfo.port}`);
    this.parseMdnsResponse(msg);
  };

  private onError = (err: Error) => {
    console.error(`Socket error:\n${err.message}`);
    this.socket.close();
  };

  private onWarning = (err: Error) => {
    console.error(`Socket warning:\n${err.message}`);
    // this.socket.close();
  };

  public query = (name = '_services._dns-sd._udp.local', type = 'PTR') => {
    const queryBuffer = this.buildQuery(name, type);
    this.socket.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv4, (err) => {
      if (err) console.error(err);
      else console.log(`Query sent with name: ${name} and type: ${type}`);
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

  private parseMdnsResponse = (msg: Buffer) => {
    try {
      const id = msg.readUInt16BE(0);
      const flags = msg.readUInt16BE(2);
      const qdcount = msg.readUInt16BE(4);
      const ancount = msg.readUInt16BE(6);
      const nscount = msg.readUInt16BE(8);
      const arcount = msg.readUInt16BE(10);

      console.log(`ID: ${id}`);
      console.log(`Flags: ${flags}`);
      console.log(`Questions: ${qdcount}`);
      console.log(`Answers: ${ancount}`);
      console.log(`Authority RRs: ${nscount}`);
      console.log(`Additional RRs: ${arcount}`);

      let offset = 12;

      if (qdcount > 0) console.log(`${GREEN}Questions:${rs}`);
      for (let i = 0; i < qdcount; i++) {
        const { name, newOffset } = this.readName(msg, offset);
        offset = newOffset;
        const type = msg.readUInt16BE(offset);
        offset += 2;
        const qclass = msg.readUInt16BE(offset);
        offset += 2;

        console.log(`${name.padEnd(50, ' ')} ${idn}${this.getTypeText(type)}${rs}, Class: ${qclass}`);
      }

      if (ancount > 0) console.log(`${GREEN}Answers:${rs}`);
      for (let i = 0; i < ancount; i++) {
        const { name, newOffset } = this.readName(msg, offset);
        offset = newOffset;
        const type = msg.readUInt16BE(offset);
        offset += 2;
        const qclass = msg.readUInt16BE(offset);
        offset += 2;
        const ttl = msg.readUInt32BE(offset);
        offset += 4;
        const rdlength = msg.readUInt16BE(offset);
        offset += 2;
        const rdata = msg.subarray(offset, offset + rdlength);
        offset += rdlength;

        let decoded = '';

        switch (type) {
          case 12: // PTR
          case 5: // CNAME
          case 39: // DNAME
            // decoded = this.readName(rdata, 0).name;
            decoded = rdata.toString('hex');
            break;
          case 16: // TXT
            decoded = this.readTXT(rdata, 0, rdlength);
            break;
          default:
            decoded = rdata.toString('hex');
            break;
        }
        console.log(`${name.padEnd(50, ' ')} ${idn}${this.getTypeText(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${decoded}`);
      }
    } catch (error) {
      console.error('Failed to parse mDNS response:', error);
    }
  };

  private readName(buffer: Buffer, offset: number): { name: string; newOffset: number } {
    const labels = [];
    let jumped = false;
    let jumpOffset = offset;
    let length = buffer.readUInt8(offset);

    while (length !== 0) {
      // Check for pointer
      if ((length & 0xc0) === 0xc0) {
        if (!jumped) {
          jumpOffset = offset + 2;
        }
        const pointer = buffer.readUInt16BE(offset) & 0x3fff;
        offset = pointer;
        length = buffer.readUInt8(offset);
        jumped = true;
      } else {
        labels.push(buffer.toString('utf8', offset + 1, offset + 1 + length));
        offset += length + 1;
        length = buffer.readUInt8(offset);
      }
    }

    if (!jumped) {
      jumpOffset = offset + 1;
    }

    return { name: labels.join('.'), newOffset: jumpOffset };
  }

  private readTXT(buffer: Buffer, offset: number, length: number): string {
    let result = '';
    const end = offset + length;

    while (offset < end) {
      const txtLength = buffer.readUInt8(offset);
      offset++;
      result += buffer.toString('utf8', offset, offset + txtLength) + ' ';
      offset += txtLength;
    }

    return result.trim();
  }

  private getTypeText(type: number): string {
    switch (type) {
      case 1:
        return 'A';
      case 2:
        return 'NS';
      case 5:
        return 'CNAME';
      case 6:
        return 'SOA';
      case 12:
        return 'PTR';
      case 15:
        return 'MX';
      case 16:
        return 'TXT';
      case 28:
        return 'AAAA';
      case 33:
        return 'SRV';
      case 39:
        return 'DNAME';
      case 47:
        return 'NSEC';
      case 252:
        return 'AXFR';
      case 255:
        return 'ANY';
      default:
        return `Unknown (${type})`;
    }
  }

  private getIpv4InterfaceAddress(networkInterface?: string): string | undefined {
    if (!networkInterface || networkInterface === '') return undefined;

    const interfaces = os.networkInterfaces();
    const addresses = interfaces[networkInterface];

    if (!addresses) {
      throw new Error(`Interface ${networkInterface} not found`);
    }

    const ipv4Address = addresses.find((addr) => addr.family === 'IPv4' && !addr.internal);

    if (!ipv4Address) {
      throw new Error(`Interface ${networkInterface} does not have an external IPv4 address`);
    }

    return ipv4Address.address;
  }

  private getIpv6InterfaceAddress(networkInterface?: string): string | undefined {
    if (!networkInterface || networkInterface === '') return undefined;

    const interfaces = os.networkInterfaces();
    const addresses = interfaces[networkInterface];

    if (!addresses) {
      throw new Error(`Interface ${networkInterface} not found`);
    }

    // Try to find a global unicast address first
    const globalUnicastAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.scopeid === 0);
    if (globalUnicastAddress) {
      return globalUnicastAddress.address;
    }
    this.log.debug('No IPv6 global unicast address found');

    // If no global unicast address is found, try to find a unique local address
    const uniqueLocalAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fd'));
    if (uniqueLocalAddress) {
      return uniqueLocalAddress.address;
    }
    this.log.debug('No IPv6 unique local address found');

    // If no global unicast address and no unique local address is found, fall back to link-local address
    const linkLocalAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fe80'));
    if (linkLocalAddress) {
      return linkLocalAddress.address;
    }
    this.log.debug('No IPv6 link-local address found');

    throw new Error(`Interface ${networkInterface} does not have a suitable external IPv6 address`);
  }

  public static listNetworkInterfaces = () => {
    const interfaces = os.networkInterfaces();
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      for (const address of addresses) {
        console.log(
          `Interface: ${name} - Address: ${address.address} ${address.mac ? 'MAC: ' + address.mac : ''} type: ${address.family} ${address.internal ? 'internal' : 'external'} ${address.scopeid !== undefined ? 'scopeid: ' + address.scopeid : ''}`,
        );
      }
    }
  };
}

MdnsScanner.listNetworkInterfaces(); // List available network interfaces

const scanner = new MdnsScanner(process.argv[2]);

scanner.query('_http._tcp.local');

setTimeout(() => {
  scanner.stop();
}, 30000); // Stop scanning after 10 seconds
