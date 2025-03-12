/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import { AnsiLogger, CYAN, db, debugStringify, er, GREEN, hk, idn, ign, LogLevel, nf, rs, TimestampFormat, wr, YELLOW, zb } from 'node-ansi-logger';
import dgram from 'node:dgram';
import os, { NetworkInterfaceInfoIPv4, NetworkInterfaceInfoIPv6 } from 'node:os';

class MdnsScanner {
  private readonly log;

  private socketUdp4: dgram.Socket;
  private socketUdp6?: dgram.Socket;
  private multicastAddressIpv4 = '224.0.0.251';
  private multicastAddressIpv6 = 'ff02::fb';
  private multicastPort = 5353;
  private useIpv4Only: boolean;

  private networkInterfaceAddressIpv4: string | undefined;
  private networkInterfaceAddressIpv6: string | undefined;
  private networkInterfaceScopeIpv6: string | undefined;

  public decodeError = false;

  public devices = new Map<string, { address: string; port: number }>();
  public errorDevices = new Map<string, { address: string; port: number }>();
  public shellyDevices = new Map<string, { address: string; id: string; gen: number }>();

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
      this.socketUdp4.setMulticastLoopback(true); // TODO: Remove before you deploy
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
        this.socketUdp6?.setMulticastLoopback(true); // TODO: Remove before you deploy
        const address = this.socketUdp6?.address();
        this.log.notice(
          `MdnsScanner IPv6 is listening using network interface address ${this.networkInterfaceAddressIpv6} bound on ${address?.family} ${address?.address}:${address?.port}`,
        );
      });
    }
  }

  private onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    // if (this.devices.has(rinfo.address)) return;
    // if (rinfo.address !== '192.168.1.181' && rinfo.address !== '192.168.1.217' && rinfo.address !== '192.168.1.218') return;
    // if (rinfo.address !== '192.168.1.227' && rinfo.address !== '192.168.1.217' && rinfo.address !== '192.168.1.218') return;
    this.log.info(`Received mDNS message from ${ign}${rinfo.address}${rs}${nf}:${rinfo.port}`);
    this.devices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });

    /*
    try {
      const decoded = dnsPacket.decode(msg);
      decoded.questions?.forEach((question) => {
        // class 32769
        this.log.debug(`Question: ${idn}${question.type}${rs}${db} name ${question.name} class: ${question.class}`);
      });
      decoded.answers?.forEach((answer) => {
        if (answer.type === 'PTR' && answer.data.startsWith('shelly') && !this.shellyDevices.has(rinfo.address)) {
          this.log.info(`****Answer: ${idn}${answer.type}${rs}${nf} ${answer.name} Data: ${answer.data}`);
        }
        if (answer.type === 'TXT' && answer.name.startsWith('shelly')) {
          const [name, mac] = answer.name.split('.')[0].split('-');
          const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          if (this.shellyDevices.has(rinfo.address)) return;
          if (answer.data.toString().includes('gen=2')) {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}2${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 2 });
          } else if (answer.data.toString().includes('gen=3')) {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}3${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 3 });
          } else {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}1${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 1 });
          }
        }
        if (answer.type === 'PTR') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'TXT') {
          if (typeof answer.data === 'string') this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data}`);
          else if (Buffer.isBuffer(answer.data)) this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.toString()}`);
          else if (Array.isArray(answer.data)) this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.map((d) => d.toString()).join(', ')}`);
        } else if (answer.type === 'SRV') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'NSEC') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'A') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'AAAA') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name}`);
        }
      });
      decoded.authorities?.forEach((answer) => {
        if (answer.type === 'PTR') {
          this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'TXT') {
          if (typeof answer.data === 'string') this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data}`);
          else if (Buffer.isBuffer(answer.data)) this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.toString()}`);
          else if (Array.isArray(answer.data)) this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.map((d) => d.toString()).join(', ')}`);
        } else if (answer.type === 'SRV') {
          this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'NSEC') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'A') {
          this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'AAAA') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else {
          this.log.debug(`Authority: ${idn}${answer.type}${rs}${db} ${answer.name}`);
        }
      });
      decoded.additionals?.forEach((answer) => {
        if (answer.type === 'TXT' && answer.name.startsWith('shelly')) {
          const [name, mac] = answer.name.split('.')[0].split('-');
          const deviceId = name.toLowerCase() + '-' + mac.toUpperCase();
          if (this.shellyDevices.has(rinfo.address)) return;
          if (answer.data.toString().includes('gen=2')) {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}2${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 2 });
          } else if (answer.data.toString().includes('gen=3')) {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}3${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 3 });
          } else {
            this.log.info(`***Discovered a shelly id ${hk}${deviceId}${nf} gen ${CYAN}1${nf} at ${ign}${rinfo.address}${rs}`);
            this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: deviceId, gen: 1 });
          }
        }
        if (answer.type === 'PTR') {
          this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'TXT') {
          if (typeof answer.data === 'string') this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data}`);
          else if (Buffer.isBuffer(answer.data)) this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.toString()}`);
          else if (Array.isArray(answer.data)) this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${answer.data.map((d) => d.toString()).join(', ')}`);
        } else if (answer.type === 'SRV') {
          this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'NSEC') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'A') {
          this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else if (answer.type === 'AAAA') {
          this.log.debug(`Answer: ${idn}${answer.type}${rs}${db} ${answer.name} Data: ${typeof answer.data === 'object' ? debugStringify(answer.data) : answer.data}`);
        } else {
          this.log.debug(`Additional: ${idn}${answer.type}${rs}${db} ${answer.name}`);
        }
      });
      // console.log('\n');
    } catch (error) {
      this.errorDevices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });
      this.log.error(`Failed to decode mDNS message from ${rinfo.address}:${rinfo.port}: ${error instanceof Error ? error.message : error}`);
    }
    */

    try {
      this.parseMdnsResponse(msg, rinfo);
    } catch (error) {
      this.errorDevices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });
      this.log.error(`Failed to decode mDNS message from ${ign}${rinfo.address}${rs}${er}:${rinfo.port}: ${error instanceof Error ? error.message : error}`);
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

  public query(name = '_services._dns-sd._udp.local', type = 'PTR', classId = 1) {
    const queryBuffer = this.buildQuery(name, type, classId);
    this.socketUdp4.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv4, (err: Error | null) => {
      if (err) this.log.error(`Error sending query on udp4: ${err.message}`);
      else this.log.info(`Query sent on udp4 with name: ${CYAN}${name}${nf} type: ${CYAN}${type}${nf} class: ${CYAN}${classId}${nf}`);
    });
    this.socketUdp6?.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv6, (err: Error | null) => {
      if (err) this.log.error(`Error sending query on udp6: ${err.message}`);
      else this.log.info(`Query sent on udp6 with name: ${CYAN}${name}${nf} type: ${CYAN}${type}${nf} class: ${CYAN}${classId}${nf}`);
    });
  }

  private buildQuery(name: string, type: string, classId = 1): Buffer {
    /*
    return dnsPacket.encode({
      type: 'query',
      id: 0,
      flags: 0,
      questions: [
        {
          type: 'PTR',
          name,
        },
      ],
    });
    */

    // Build an mDNS query packet
    const parts = name.split('.').filter((part) => part.length > 0);
    const query = Buffer.alloc(12 + parts.reduce((len, part) => len + part.length + 1, 0) + 5);

    // Transaction ID: 2 bytes
    query.writeUInt16BE(8283, 0);

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
    query.writeUInt16BE(classId, offset);

    return query;
  }

  public stop = () => {
    this.socketUdp4.dropMembership(this.multicastAddressIpv4, this.networkInterfaceAddressIpv4);
    this.socketUdp4.close();
    if (this.socketUdp6) {
      this.socketUdp6.dropMembership(this.multicastAddressIpv6, this.networkInterfaceAddressIpv6);
      this.socketUdp6.close();
    }
  };

  private parseMdnsResponse = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
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

      if (qdcount > 0) console.log(`${GREEN}Questions ${qdcount}:${rs}`);
      for (let i = 0; i < qdcount; i++) {
        const { name, newOffset } = this.decodeDomainName(msg, offset);
        offset = newOffset;
        const type = msg.readUInt16BE(offset);
        offset += 2;
        const qclass = msg.readUInt16BE(offset);
        offset += 2;

        console.log(`${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}`);
      }

      if (ancount > 0) console.log(`${GREEN}Answers ${ancount}:${rs}`);
      for (let i = 0; i < ancount; i++) {
        const { name, newOffset } = this.decodeDomainName(msg, offset);
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

        let decoded;

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
            decoded = this.decodeSRV(msg, offset - rdlength);
            break;
          case 47: // NSEC
            decoded = this.decodeNSEC(msg, offset - rdlength);
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(
          `${name.startsWith('shelly') ? wr : ''}${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${typeof decoded === 'object' ? debugStringify(decoded) : decoded}`,
        );
        if (name.startsWith('shelly') && this.normalizeShellyId(name.split('.')[0]))
          this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: this.normalizeShellyId(name.split('.')[0]) ?? name.split('.')[0], gen: 0 });
      }

      if (nscount > 0) console.log(`${GREEN}Authority RRs ${nscount}:${rs}`);
      for (let i = 0; i < nscount; i++) {
        const { name, newOffset } = this.decodeDomainName(msg, offset);
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

        let decoded;

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
            decoded = this.decodeSRV(msg, offset - rdlength);
            break;
          case 47: // NSEC
            decoded = this.decodeNSEC(msg, offset - rdlength);
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(
          `${name.startsWith('shelly') ? wr : ''}${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${typeof decoded === 'object' ? debugStringify(decoded) : decoded}`,
        );
        if (name.startsWith('shelly') && this.normalizeShellyId(name.split('.')[0]))
          this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: this.normalizeShellyId(name.split('.')[0]) ?? name.split('.')[0], gen: 0 });
      }

      if (arcount > 0) console.log(`${GREEN}Additional RRs ${arcount}:${rs}`);
      for (let i = 0; i < arcount; i++) {
        const { name, newOffset } = this.decodeDomainName(msg, offset);
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

        let decoded;

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
            decoded = this.decodeSRV(msg, offset - rdlength);
            break;
          case 47: // NSEC
            decoded = this.decodeNSEC(msg, offset - rdlength);
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(
          `${name.startsWith('shelly') ? wr : ''}${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${typeof decoded === 'object' ? debugStringify(decoded) : decoded}`,
        );
        if (name.startsWith('shelly') && this.normalizeShellyId(name.split('.')[0]))
          this.shellyDevices.set(rinfo.address, { address: rinfo.address, id: this.normalizeShellyId(name.split('.')[0]) ?? name.split('.')[0], gen: 0 });
      }
    } catch (error) {
      console.error('Failed to parse mDNS response:', error);
    }
    console.log('\n');
  };

  private decodeDomainName(buffer: Buffer, offset: number): { name: string; newOffset: number } {
    const labels = [];
    let jumped = false;
    let jumpOffset = offset;
    let length = buffer.readUInt8(offset);

    while (length !== 0) {
      // Check for pointer and jump to the offset
      if ((length & 0xc0) === 0xc0) {
        if (!jumped) {
          jumpOffset = offset + 2;
        }
        const pointer = buffer.readUInt16BE(offset) & 0x3fff;
        offset = pointer;
        if (offset >= buffer.length) {
          this.log.error(`Pointer offset out of bounds jumping: ${pointer}`);
          return { name: labels.join('.'), newOffset: offset };
        }
        length = buffer.readUInt8(offset);
        jumped = true;
      } else {
        labels.push(buffer.toString('utf8', offset + 1, offset + 1 + length));
        offset += length + 1;
        if (offset >= buffer.length) {
          this.log.error(`Buffer offset out of bounds: ${offset}`);
          return { name: labels.join('.'), newOffset: offset };
        }
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
        if (offset >= msg.length) {
          this.log.error(`decodePTR: pointer ${offset} out of bounds jumping`);
          return labels.join('.');
        }
      } else {
        const length = msg[offset];
        labels.push(msg.toString('utf8', offset + 1, offset + 1 + length));
        offset += length + 1;
        if (offset >= msg.length) {
          this.log.error(`decodePTR: offset ${offset} out of bounds`);
          return labels.join('.');
        }
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
    const { name: nsdname, newOffset } = this.decodeDomainName(msg, offset);
    return { nsdname, newOffset };
  }

  private decodeNSEC(msg: Buffer, offset: number) {
    const { name, newOffset } = this.decodeDomainName(msg, offset);
    // this.log.warn(`***NSEC rrtypes offset ${offset} newOffset ${newOffset}`, msg.toString('hex', offset), msg.toString('hex', newOffset));
    offset = newOffset;

    const rrTypes: string[] = [];
    const blockNumber = msg[offset];
    const bitmapLength = msg[offset + 1];
    if (offset + 2 + bitmapLength > msg.length) {
      this.log.error(`NSEC bitmap out of bounds`);
      return { nextDomain: name, rrTypes };
    }
    const bitmap = msg.slice(offset + 2, offset + 2 + bitmapLength);

    for (let i = 0; i < bitmapLength * 8; i++) {
      if (bitmap[Math.floor(i / 8)] & (0x80 >> i % 8)) {
        const rrType = i + blockNumber * 256;
        rrTypes.push(this.rrTypeToString(rrType));
      }
    }
    return { nextDomain: name, rrTypes };
  }

  // Function to convert RR type number to a string
  private rrTypeToString(rrtype: number): string {
    const rrTypeMap: Record<number, string> = {
      1: 'A',
      2: 'NS',
      5: 'CNAME',
      6: 'SOA',
      12: 'PTR',
      15: 'MX',
      16: 'TXT',
      25: 'KEY',
      28: 'AAAA',
      33: 'SRV',
      39: 'DNAME',
      41: 'OPT',
      47: 'NSEC',
      48: 'DNSKEY',
      255: 'ANY',
      257: 'CAA',
    };
    return rrTypeMap[rrtype] || `TYPE${rrtype}`;
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

  /**
   * Normalizes a Shelly device ID by converting it to a standard format.
   * @param {string} shellyId - The Shelly device ID to normalize.
   * @returns {string | undefined} The normalized Shelly device ID, or undefined if the ID is invalid.
   * @example
   * // Normalize a Shelly device ID
   * const normalizedId = mdnsScanner.normalizeShellyId('ShellyPlug-S-c38345.local');
   * console.log(normalizedId); // Output: 'shellyplug-s-C38345'
   */
  normalizeShellyId(shellyId: string): string | undefined {
    const parts = shellyId.replace('.local', '').split('-');
    if (parts.length < 2) return undefined;
    const mac = parts.pop(); // Extract the MAC address (last part)
    if (!mac) return undefined;
    const name = parts.join('-'); // Join the remaining parts to form the device name
    return name.toLowerCase() + '-' + mac.toUpperCase();
  }
}

/*
MdnsScanner.listNetworkInterfaces(); // List available network interfaces

const scanner = new MdnsScanner(process.argv[2], process.argv[3] === 'true' ? true : false);

scanner.query('_shelly._tcp.local', 'PTR');
scanner.query('_http._tcp.local', 'PTR');
scanner.query('_services._dns-sd._udp.local', 'PTR');

const interval = setInterval(() => {
  scanner.query('_shelly._tcp.local', 'PTR');
  scanner.query('_http._tcp.local', 'PTR');
  scanner.query('_services._dns-sd._udp.local', 'PTR');
}, 10000); // Query every 10 seconds

setTimeout(() => {
  clearInterval(interval);
  scanner.stop();
  logDevices();
}, 60000); // Stop scanning after 60 seconds

function logDevices() {
  // Collect devices into an array
  const shellyArray = Array.from(scanner.shellyDevices.entries());
  // Sort the array by device address

  shellyArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.log(`Found ${shellyArray.length} Shelly devices (sorted by host):`);

  shellyArray.forEach(([key, device]) => {
    console.log(`Shelly id: ${hk}${device.id}${rs} host ${zb}${device.address}${rs} gen: ${YELLOW}${device.gen}${rs}`);
  });

  shellyArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.id.localeCompare(deviceB.id));
  // Log the sorted devices
  console.log(`\nFound ${shellyArray.length} Shelly devices (sorted by id):`);

  shellyArray.forEach(([key, device]) => {
    console.log(`Shelly id: ${hk}${device.id}${rs} host ${zb}${device.address}${rs} gen: ${YELLOW}${device.gen}${rs}`);
  });

  // Collect devices into an array
  const devicesArray = Array.from(scanner.devices.entries());
  // Sort the array by device address

  devicesArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.log(`Found ${devicesArray.length} devices:`);

  devicesArray.forEach(([key, device]) => {
    console.log(`Device: ${device.address}:${device.port}`);
  });

  // Collect devices into an array
  const errorDevicesArray = Array.from(scanner.errorDevices.entries());
  // Sort the array by device address

  errorDevicesArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.error(`Found ${errorDevicesArray.length} devices with errors:`);

  errorDevicesArray.forEach(([key, device]) => {
    console.error(`Device with error: ${device.address}:${device.port}`);
  });
}

process.on('SIGINT', () => {
  clearInterval(interval);
  scanner.stop();
  logDevices();
});
*/
