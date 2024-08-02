/* eslint-disable no-console */
import dgram from 'dgram';
import { AnsiLogger, CYAN, er, GREEN, idn, ign, LogLevel, nf, rs, TimestampFormat } from 'node-ansi-logger';
import os, { NetworkInterfaceInfoIPv4, NetworkInterfaceInfoIPv6 } from 'os';
import dnsPacket from 'dns-packet';

// https://github.com/mafintosh/dns-packet

class MdnsScanner {
  private readonly log;

  private socketUdp4: dgram.Socket;
  private socketUdp6?: dgram.Socket;
  private multicastAddressIpv4 = '224.0.0.251';
  private multicastAddressIpv6 = 'ff02::fb';
  private multicastPort = 5353;
  private useIpv4Only: boolean;

  // private multicastAddressIpv4 = '224.0.1.187';
  // private multicastPort = 5683;

  private networkInterfaceAddressIpv4: string | undefined;
  private networkInterfaceAddressIpv6: string | undefined;
  private networkInterfaceScopeIpv6: string | undefined;

  public decodeError = false;

  public devices = new Map<string, { address: string; port: number }>();
  public errorDevices = new Map<string, { address: string; port: number }>();

  constructor(networkInterface?: string, useIpv4Only = false) {
    this.log = new AnsiLogger({ logName: 'MdnsScanner', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    this.useIpv4Only = useIpv4Only;

    this.networkInterfaceAddressIpv4 = this.getIpv4InterfaceAddress(networkInterface)?.address;
    this.log.debug(`Using network interface IPv4 address: ${this.networkInterfaceAddressIpv4}`);
    this.socketUdp4 = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.socketUdp4.on('message', this.onMessage);
    this.socketUdp4.on('warning', this.onWarning);
    this.socketUdp4.on('error', this.onError);
    this.socketUdp4.bind(this.multicastPort, () => {
      this.log.debug(`Setting multicast interface IPv4: ${this.networkInterfaceAddressIpv4}`);
      if (this.networkInterfaceAddressIpv4) this.socketUdp4.setMulticastInterface(this.networkInterfaceAddressIpv4);
      this.log.debug(`Adding multicast membership IPv4: ${this.multicastAddressIpv4} interface: ${this.networkInterfaceAddressIpv4}`);
      this.socketUdp4.addMembership(this.multicastAddressIpv4, this.networkInterfaceAddressIpv4);
      this.socketUdp4.setMulticastTTL(255);
      this.socketUdp4.setMulticastLoopback(true);
      const address = this.socketUdp4.address();
      this.log.notice(
        `MdnsScanner IPv4 is listening using network interface address ${this.networkInterfaceAddressIpv4} bound on ${address.family} ${address.address}:${address.port}`,
      );
    });

    if (!useIpv4Only) {
      this.networkInterfaceAddressIpv6 = this.getIpv6InterfaceAddress(networkInterface)?.address;
      this.networkInterfaceScopeIpv6 = this.getIpv6InterfaceAddress(networkInterface)?.scopeid.toString();
      this.log.debug(`Using network interface IPv6 address: ${this.networkInterfaceAddressIpv6} scopeid: ${this.networkInterfaceScopeIpv6}`);
      this.socketUdp6 = dgram.createSocket({ type: 'udp6', reuseAddr: true });
      this.socketUdp6.on('message', this.onMessage);
      this.socketUdp6.on('warning', this.onWarning);
      this.socketUdp6.on('error', this.onError);
      this.socketUdp6.bind(this.multicastPort, () => {
        this.log.debug(`Setting multicast interface IPv6: ${this.networkInterfaceAddressIpv6}`);
        if (this.networkInterfaceAddressIpv6) this.socketUdp6?.setMulticastInterface(this.networkInterfaceAddressIpv6);
        this.log.debug(`Adding multicast membership IPv6: ${this.multicastAddressIpv6} interface: ${this.networkInterfaceAddressIpv6}`);
        this.socketUdp6?.addMembership(this.multicastAddressIpv6, this.networkInterfaceAddressIpv6);
        this.socketUdp6?.setMulticastTTL(255);
        this.socketUdp6?.setMulticastLoopback(true);
        const address = this.socketUdp6?.address();
        this.log.notice(
          `MdnsScanner IPv6 is listening using network interface address ${this.networkInterfaceAddressIpv6} bound on ${address?.family} ${address?.address}:${address?.port}`,
        );
      });
    }
  }

  private onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    this.log.info(`Received message from ${ign}${rinfo.address}:${rinfo.port}${rs}`);
    this.devices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });
    try {
      dnsPacket.decode(msg);
      // this.parseMdnsResponse(msg);
    } catch (error) {
      this.errorDevices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });
      this.log.error(`Failed to decode mDNS message from ${rinfo.address}:${rinfo.port}: ${error instanceof Error ? error.message : error}`);
    }
  };

  private onError = (err: Error) => {
    this.log.error(`Socket error:\n${err.message}`);
    this.socketUdp4.close();
    if (this.socketUdp6) this.socketUdp6.close();
  };

  private onWarning = (err: Error) => {
    this.log.error(`Socket warning:\n${err.message}`);
    this.decodeError = true;
  };

  public query(name = '_services._dns-sd._udp.local', type = 'PTR') {
    const queryBuffer = this.buildQuery(name, type);
    this.socketUdp4.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv4, (err: Error | null) => {
      if (err) this.log.error(`MdnsScannererr error sending query on udp4: ${err.message}`);
      else this.log.info(`Query sent on udp4 with name: ${CYAN}${name}${nf} and type: ${CYAN}${type}${nf}`);
    });
    this.socketUdp6?.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv6, (err: Error | null) => {
      if (err) this.log.error(`MdnsScannererr error sending query on udp6: ${err.message}`);
      else this.log.info(`Query sent on udp6 with name: ${CYAN}${name}${nf} and type: ${CYAN}${type}${nf}`);
    });
  }

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
    this.socketUdp4.close();
    if (this.socketUdp6) this.socketUdp6.close();
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
        const { name, newOffset } = this.readDomainName(msg, offset);
        offset = newOffset;
        const type = msg.readUInt16BE(offset);
        offset += 2;
        const qclass = msg.readUInt16BE(offset);
        offset += 2;

        console.log(`${name.padEnd(50, ' ')} ${idn}${this.getTypeText(type)}${rs}, Class: ${qclass}`);
      }

      if (ancount > 0) console.log(`${GREEN}Answers:${rs}`);
      for (let i = 0; i < ancount; i++) {
        const { name, newOffset } = this.readDomainName(msg, offset);
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
          case 1: // A
            decoded = this.decodeA(rdata, 0, rdlength);
            break;
          case 2: // NS
            decoded = this.decodeNS(msg, offset - rdlength).nsdname; // Pointers inside !!!
            break;
          case 12: // PTR
            decoded = this.decodePTR(msg, offset - rdlength); // Pointers inside !!!
            break;
          case 16: // TXT
            decoded = this.decodeTXT(rdata, 0, rdlength);
            break;
          case 28: // AAAA
            decoded = this.decodeAAAA(rdata, 0, rdlength);
            break;
          case 33: // SRV
            // eslint-disable-next-line no-case-declarations
            const { priority, weight, port, target } = this.decodeSRV(msg, offset - rdlength); // Pointers inside !!!
            decoded = `Priority: ${priority}, Weight: ${weight}, Port: ${port}, Target: ${target}`;
            break;
          case 47: // NSEC
            decoded = this.readDomainName(rdata, 0).name;
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(`${name.padEnd(50, ' ')} ${idn}${this.getTypeText(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${decoded}`);
      }
    } catch (error) {
      console.error('Failed to parse mDNS response:', error);
    }
    console.log('\n');
  };

  private readDomainName(buffer: Buffer, offset: number): { name: string; newOffset: number } {
    const labels = [];
    let jumped = false;
    let jumpOffset = offset;
    let length = buffer.readUInt8(offset);

    while (length !== 0) {
      // Check for pointer
      if ((length & 0xc0) === 0xc0) {
        this.log.warn(`Pointer found at offset ${offset.toString(16).padStart(4, '0')}`);
        if (!jumped) {
          jumpOffset = offset + 2;
        }
        const pointer = buffer.readUInt16BE(offset) & 0x3fff;
        offset = pointer;
        length = buffer.readUInt8(offset); // Error here
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

  private decodeTXT(buffer: Buffer, offset: number, length: number): string {
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

  private decodeA(buffer: Buffer, offset: number, length: number): string {
    const ipBuffer = buffer.subarray(offset, offset + length);
    const ipAddress = Array.from(ipBuffer).join('.');
    return ipAddress;
  }

  private decodeAAAA(buffer: Buffer, offset: number, length: number): string {
    const ipBuffer = buffer.subarray(offset, offset + length);
    const ipAddress = ipBuffer.reduce((acc, byte, idx) => {
      return acc + (idx % 2 === 0 && idx > 0 ? ':' : '') + byte.toString(16).padStart(2, '0');
    }, '');
    return ipAddress;
  }

  private decodePTR(msg: Buffer, offset: number): string {
    const labels = [];

    while (msg[offset] !== 0) {
      if ((msg[offset] & 0xc0) === 0xc0) {
        offset = ((msg[offset] & 0x3f) << 8) | msg[offset + 1];
      } else {
        const length = msg[offset];
        labels.push(msg.toString('utf8', offset + 1, offset + 1 + length));
        offset += length + 1;
      }
    }
    return labels.join('.');
  }

  private decodeSRV(msg: Buffer, offset: number): { priority: number; weight: number; port: number; target: string } {
    const priority = msg.readUInt16BE(offset);
    const weight = msg.readUInt16BE(offset + 2);
    const port = msg.readUInt16BE(offset + 4);
    const target = this.decodePTR(msg, offset + 6);
    return { priority, weight, port, target: target };
  }

  // Function to decode NS records from an mDNS message
  private decodeNS(msg: Buffer, offset: number) {
    const { name: nsdname, newOffset } = this.readDomainName(msg, offset);
    return { nsdname, newOffset };
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

  /**
   * Retrieves the IPv4 address of the specified network interface or the first external IPv4 interface if no interface is specified.
   * Throws an error if no suitable interface or address is found.
   *
   * @param {string} networkInterface - The name of the network interface to retrieve the IPv4 address from. If not specified, the first external IPv4 interface will be used.
   * @returns The IPv4 address of the specified network interface or the first external IPv4 interface.
   * @throws Error if no suitable interface or address is found.
   */
  private getIpv4InterfaceAddress(networkInterface?: string): NetworkInterfaceInfoIPv4 | undefined {
    if (networkInterface === '') networkInterface = undefined;

    const interfaces = os.networkInterfaces();

    // Verify that the specified network interface exists
    if (networkInterface && !interfaces[networkInterface]) {
      this.log.error(`Interface ${networkInterface} not found. Using first external IPv4 interface.`);
      networkInterface = undefined;
    }

    // Find the first external IPv4 interface if no interface is specified
    for (const [interfaceName, interfaceDetails] of Object.entries(interfaces)) {
      if (networkInterface || !interfaceDetails) {
        break;
      }
      for (const detail of interfaceDetails) {
        if (detail.family === 'IPv4' && !detail.internal && networkInterface === undefined) {
          networkInterface = interfaceName;
          break;
        }
      }
    }
    if (!networkInterface) {
      throw new Error(`Didn't find an external IPv4 network interface`);
    }

    const addresses = interfaces[networkInterface];

    if (!addresses) {
      throw new Error(`Interface ${networkInterface} not found`);
    }

    const ipv4Address = addresses.find((addr) => addr.family === 'IPv4' && !addr.internal);

    if (!ipv4Address) {
      throw new Error(`Interface ${networkInterface} does not have an external IPv4 address`);
    }

    return ipv4Address as NetworkInterfaceInfoIPv4;
  }

  private getIpv6InterfaceAddress(networkInterface?: string): NetworkInterfaceInfoIPv6 | undefined {
    if (!networkInterface || networkInterface === '') return undefined;

    const interfaces = os.networkInterfaces();

    // Verify that the specified network interface exists
    if (networkInterface && !interfaces[networkInterface]) {
      this.log.error(`Interface ${networkInterface} not found. Using first external IPv6 interface.`);
      networkInterface = undefined;
    }

    // Find the first external IPv6 interface if no interface is specified
    for (const [interfaceName, interfaceDetails] of Object.entries(interfaces)) {
      if (networkInterface || !interfaceDetails) {
        break;
      }
      for (const detail of interfaceDetails) {
        if (detail.family === 'IPv6' && !detail.internal && networkInterface === undefined) {
          networkInterface = interfaceName;
          break;
        }
      }
    }
    if (!networkInterface) {
      throw new Error(`Didn't find an external IPv6 network interface`);
    }

    const addresses = interfaces[networkInterface];

    if (!addresses) {
      throw new Error(`Interface ${networkInterface} not found`);
    }

    // Try to find a global unicast address first
    const globalUnicastAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.scopeid === 0);
    if (globalUnicastAddress) {
      return globalUnicastAddress as NetworkInterfaceInfoIPv6;
    }
    this.log.debug('No IPv6 global unicast address found');

    // If no global unicast address is found, try to find a unique local address
    const uniqueLocalAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fd'));
    if (uniqueLocalAddress) {
      return uniqueLocalAddress as NetworkInterfaceInfoIPv6;
    }
    this.log.debug('No IPv6 unique local address found');

    // If no global unicast address and no unique local address is found, fall back to link-local address and use scopeid
    const linkLocalAddress = addresses.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fe80'));
    if (linkLocalAddress) {
      return linkLocalAddress as NetworkInterfaceInfoIPv6;
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

const scanner = new MdnsScanner(process.argv[2], false);

scanner.query('_http._tcp.local', 'PTR');
scanner.query('_shelly._tcp.local', 'PTR');

setTimeout(() => {
  // scanner.stop();
}, 30000); // Stop scanning after 10 seconds

process.on('SIGINT', () => {
  scanner.stop();

  // Collect devices into an array
  const devicesArray = Array.from(scanner.devices.entries());
  // Sort the array by device address
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  devicesArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.log(`Devices found ${devicesArray.length}:`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  devicesArray.forEach(([key, device]) => {
    console.log(`Device: ${device.address}:${device.port}`);
  });

  // Collect devices into an array
  const errorDevicesArray = Array.from(scanner.errorDevices.entries());
  // Sort the array by device address
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  errorDevicesArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.error(`Devices found ${devicesArray.length} with errors:`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  errorDevicesArray.forEach(([key, device]) => {
    console.error(`Device with error: ${device.address}:${device.port}`);
  });
});

/*
[19:17:15.075] [MdnsScanner] Failed to decode mDNS message from 192.168.1.218:5353
[19:17:15.078] [MdnsScanner] Failed to decode mDNS message from 192.168.1.237:5353
[19:17:15.078] [MdnsScanner] Failed to decode mDNS message from 192.168.1.228:5353
[19:17:15.079] [MdnsScanner] Failed to decode mDNS message from 192.168.1.229:5353
[19:17:15.080] [MdnsScanner] Failed to decode mDNS message from 192.168.1.217:5353
[19:17:15.080] [MdnsScanner] Failed to decode mDNS message from 192.168.1.224:5353
[19:17:15.081] [MdnsScanner] Failed to decode mDNS message from 192.168.1.239:5353
[19:17:15.081] [MdnsScanner] Failed to decode mDNS message from 192.168.1.238:5353
[19:17:18.040] [MdnsScanner] Failed to decode mDNS message from 192.168.1.218:5353
[19:17:18.041] [MdnsScanner] Failed to decode mDNS message from 192.168.1.228:5353
[19:17:18.043] [MdnsScanner] Failed to decode mDNS message from 192.168.1.229:5353
[19:17:18.043] [MdnsScanner] Failed to decode mDNS message from 192.168.1.237:5353
[19:17:18.044] [MdnsScanner] Failed to decode mDNS message from 192.168.1.239:5353
[19:17:18.044] [MdnsScanner] Failed to decode mDNS message from 192.168.1.224:5353
[19:17:18.045] [MdnsScanner] Failed to decode mDNS message from 192.168.1.217:5353
[19:17:18.045] [MdnsScanner] Failed to decode mDNS message from 192.168.1.238:5353
[19:18:04.525] [MdnsScanner] Failed to decode mDNS message from 192.168.1.237:5353
[19:18:04.527] [MdnsScanner] Failed to decode mDNS message from 192.168.1.239:5353
[19:18:04.528] [MdnsScanner] Failed to decode mDNS message from 192.168.1.238:5353
[19:18:04.529] [MdnsScanner] Failed to decode mDNS message from 192.168.1.218:5353
[19:18:04.529] [MdnsScanner] Failed to decode mDNS message from 192.168.1.224:5353
[19:18:04.530] [MdnsScanner] Failed to decode mDNS message from 192.168.1.229:5353
[19:18:04.531] [MdnsScanner] Failed to decode mDNS message from 192.168.1.217:5353
[19:18:04.622] [MdnsScanner] Failed to decode mDNS message from 192.168.1.228:5353
[19:18:07.497] [MdnsScanner] Failed to decode mDNS message from 192.168.1.239:5353
[19:18:07.498] [MdnsScanner] Failed to decode mDNS message from 192.168.1.229:5353
[19:18:07.499] [MdnsScanner] Failed to decode mDNS message from 192.168.1.238:5353
[19:18:07.500] [MdnsScanner] Failed to decode mDNS message from 192.168.1.218:5353
[19:18:07.500] [MdnsScanner] Failed to decode mDNS message from 192.168.1.237:5353
[19:18:07.501] [MdnsScanner] Failed to decode mDNS message from 192.168.1.217:5353
[19:18:07.502] [MdnsScanner] Failed to decode mDNS message from 192.168.1.224:5353
[19:18:07.502] [MdnsScanner] Failed to decode mDNS message from 192.168.1.228:5353
*/

/*
[17:52:08.021] [MdnsScanner] Received message from 192.168.1.181:5353
{
  id: 0,
  type: 'query',
  flags: 0,
  flag_qr: false,
  opcode: 'QUERY',
  flag_aa: false,
  flag_tc: false,
  flag_rd: false,
  flag_ra: false,
  flag_z: false,
  flag_ad: false,
  flag_cd: false,
  rcode: 'NOERROR',
  questions: [
    { name: '_shelly._tcp.local', type: 'PTR', class: 'UNKNOWN_32769' }
  ],
  answers: [
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus1-e465b8f3028c._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shelly1pmmini-348518e04d44._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c92286cb68._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplusi4-cc7b5c8aea2c._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus1pm-441793d69718._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shelly1mini-348518e0e804._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-5443b23d81f8._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c922810da0._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro2pm-ec62608c9c00._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro1pm-ec62608ab9a4._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shelly1pmminig3-543204519264._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypmminig3-84fce63957f4._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shelly1minig3-543204547478._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro4pm-34987a67d7d0._shelly._tcp.local'
    }
  ],
  authorities: [],
  additionals: []
}
[17:52:08.030] [MdnsScanner] Received message from fe80::2c:2369:caeb:83e2%9:5353
{
  id: 0,
  type: 'query',
  flags: 0,
  flag_qr: false,
  opcode: 'QUERY',
  flag_aa: false,
  flag_tc: false,
  flag_rd: false,
  flag_ra: false,
  flag_z: false,
  flag_ad: false,
  flag_cd: false,
  rcode: 'NOERROR',
  questions: [
    { name: '_shelly._tcp.local', type: 'PTR', class: 'UNKNOWN_32769' }
  ],
  answers: [
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus1-e465b8f3028c._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shelly1pmmini-348518e04d44._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c92286cb68._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplusi4-cc7b5c8aea2c._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus1pm-441793d69718._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shelly1mini-348518e0e804._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-5443b23d81f8._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 114,
      class: 'IN',
      flush: false,
      data: 'shellyplus2pm-30c922810da0._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro2pm-ec62608c9c00._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro1pm-ec62608ab9a4._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shelly1pmminig3-543204519264._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypmminig3-84fce63957f4._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shelly1minig3-543204547478._shelly._tcp.local'
    },
    {
      name: '_shelly._tcp.local',
      type: 'PTR',
      ttl: 115,
      class: 'IN',
      flush: false,
      data: 'shellypro4pm-34987a67d7d0._shelly._tcp.local'
    }
  ],
  authorities: [],
  additionals: []
}
*/
/*
[11:58:27.605] [MdnsScanner] Failed to decode mDNS message from 192.168.1.229:5353: Cannot decode name (buffer overflow) Shelly Plus2PM 30C922810DA0| 1.4.0| ebee9893| 12:08:02 | Feedback
[11:58:27.605] [MdnsScanner] Failed to decode mDNS message from 192.168.1.238:5353: Cannot decode name (buffer overflow) Shelly Plus1Mini 348518E0E804| 1.4.0| ebee9893| 12:08:21 | Feedback
[11:58:27.606] [MdnsScanner] Failed to decode mDNS message from 192.168.1.243:5353: Cannot decode name (buffer overflow) Shelly EM Gen3 84FCE636582C| 1.4.99-dev101493| c9daf7c7| 12:08:37 | Feedback
[11:58:27.607] [MdnsScanner] Failed to decode mDNS message from 192.168.1.228:5353: Cannot decode name (buffer overflow) Shelly Plus2PM 30C92286CB68| 1.4.0| ebee9893| 12:09:23 | Feedback
[11:58:27.608] [MdnsScanner] Failed to decode mDNS message from 192.168.1.239:5353: Cannot decode name (buffer overflow) Shelly Plus1PMMini 348518E04D44| 1.4.0| ebee9893| 12:09:42 | Feedback
[11:58:27.608] [MdnsScanner] Failed to decode mDNS message from 192.168.1.218:5353: Cannot decode name (buffer overflow) Shelly Plus2PM 5443B23D81F8| 1.4.0| ebee9893| 12:09:59 | Feedback
[11:58:27.608] [MdnsScanner] Failed to decode mDNS message from 192.168.1.237:5353: Cannot decode name (buffer overflow) Shelly Plus1 E465B8F3028C| 1.4.0| ebee9893| 12:10:15 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.224:5353: Cannot decode name (buffer overflow) Shelly PlusI4 CC7B5C8AEA2C| 1.4.0| ebee9893| 12:10:29 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.217:5353: Cannot decode name (buffer overflow) Shelly Plus1PM 441793D69718| 1.4.0| ebee9893| 12:10:45 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.227:5353: Cannot decode name (buffer overflow) Shelly Pro1PM EC62608AB9A4| 1.4.0| ebee9893| 12:16:05 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.235:5353: Cannot decode name (buffer overflow) Shelly Pro2PM EC62608C9C00| 1.4.0| ebee9893| 12:16:28 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.242:5353: Cannot decode name (buffer overflow) Shelly DALI Dimmer Gen3 84FCE636832C| 1.4.99-dev101226| b1cdeea9| 12:18:01 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.220:5353: Cannot decode name (buffer overflow) Shelly MiniPMG3 84FCE63957F4| 1.4.0| ebee9893| 12:29:36 | Feedback
[11:58:27.609] [MdnsScanner] Failed to decode mDNS message from 192.168.1.221:5353: Cannot decode name (buffer overflow) Shelly Mini1G3 543204547478| 1.4.0| ebee9893| 12:30:01 | Feedback
*/
