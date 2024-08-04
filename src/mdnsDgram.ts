/* eslint-disable no-console */
import dgram from 'dgram';
import { AnsiLogger, CYAN, db, debugStringify, er, GREEN, hk, idn, ign, LogLevel, nf, rs, TimestampFormat, YELLOW, zb } from 'node-ansi-logger';
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

  /*
  [09:42:33.452] [MdnsScanner] Received message from 192.168.1.233:5353
  [09:42:33.452] [MdnsScanner] Answer: PTR _services._dns-sd._udp.local Data: _http._tcp.local
  [09:42:33.453] [MdnsScanner] Answer: PTR _http._tcp.local Data: shellybutton1-485519F31EA3._http._tcp.local
  [09:42:33.453] [MdnsScanner] Answer: SRV shellybutton1-485519F31EA3._http._tcp.local Data: { priority: 0, weight: 0, port: 80, target: 'shellybutton1-485519F31EA3.local' }
  [09:42:33.454] [MdnsScanner] Answer: A shellybutton1-485519F31EA3.local Data: 192.168.1.233
  [09:42:33.454] [MdnsScanner] Answer: NSEC shellybutton1-485519F31EA3.local Data: { nextDomain: 'shellybutton1-485519F31EA3.local', rrtypes: [ 'A' ] }   
ShellyPlus1PM-441793D69718 ShellyPlus1PM-441793D69718
  */
  private onMessage = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
    // if (this.devices.has(rinfo.address)) return;
    // if (rinfo.address !== '192.168.1.181' && rinfo.address !== '192.168.1.217' && rinfo.address !== '192.168.1.218') return;
    this.log.info(`Received message from ${ign}${rinfo.address}:${rinfo.port}${rs}`);
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
      console.log('\n');

      this.parseMdnsResponse(msg);
      console.log('\n');
    } catch (error) {
      this.errorDevices.set(rinfo.address, { address: rinfo.address, port: rinfo.port });
      this.log.error(`Failed to decode mDNS message from ${rinfo.address}:${rinfo.port}: ${error instanceof Error ? error.message : error}`);
    }
    */
    try {
      this.parseMdnsResponse(msg);
      console.log('\n');
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

  public query(name = '_services._dns-sd._udp.local', type = 'PTR', classId = 1) {
    const queryBuffer = this.buildQuery(name, type, classId);
    this.socketUdp4.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv4, (err: Error | null) => {
      if (err) this.log.error(`MdnsScannererr error sending query on udp4: ${err.message}`);
      else this.log.info(`Query sent on udp4 with name: ${CYAN}${name}${nf} and type: ${CYAN}${type}${nf} class: ${CYAN}${classId}${nf}`);
    });
    this.socketUdp6?.send(queryBuffer, 0, queryBuffer.length, this.multicastPort, this.multicastAddressIpv6, (err: Error | null) => {
      if (err) this.log.error(`MdnsScannererr error sending query on udp6: ${err.message}`);
      else this.log.info(`Query sent on udp6 with name: ${CYAN}${name}${nf} and type: ${CYAN}${type}${nf} class: ${CYAN}${classId}${nf}`);
    });
  }

  private buildQuery(name: string, type: string, classId = 1): Buffer {
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

        console.log(`${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}`);
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
            // eslint-disable-next-line no-case-declarations
            const { nextDomain, rrtypes } = this.decodeNSEC(msg, offset - rdlength);
            decoded = 'nextDomain ' + nextDomain + ' rrtypes ' + rrtypes.join(', ');
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(`${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${decoded}`);
      }

      if (nscount > 0) console.log(`${GREEN}Authority RRs:${rs}`);
      for (let i = 0; i < nscount; i++) {
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
          case 2: // NS
            decoded = this.decodeNS(msg, offset - rdlength).nsdname; // Pointers inside !!!
            break;
          case 12: // PTR
            decoded = this.decodePTR(msg, offset - rdlength); // Pointers inside !!!
            break;
          case 16: // TXT
            decoded = this.decodeTXT(rdata, 0, rdlength);
            break;
          case 33: // SRV
            // eslint-disable-next-line no-case-declarations
            const { priority, weight, port, target } = this.decodeSRV(msg, offset - rdlength); // Pointers inside !!!
            decoded = `Priority: ${priority}, Weight: ${weight}, Port: ${port}, Target: ${target}`;
            break;
          case 47: // NSEC
            // eslint-disable-next-line no-case-declarations
            const { nextDomain, rrtypes } = this.decodeNSEC(msg, offset - rdlength);
            decoded = 'nextDomain ' + nextDomain + ' rrtypes ' + rrtypes.join(', ');
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(`${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${decoded}`);
      }

      if (arcount > 0) console.log(`${GREEN}Additional RRs:${rs}`);
      for (let i = 0; i < arcount; i++) {
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
            // eslint-disable-next-line no-case-declarations
            const { nextDomain, rrtypes } = this.decodeNSEC(msg, offset - rdlength);
            decoded = 'nextDomain ' + nextDomain + ' rrtypes ' + rrtypes.join(', ');
            break;
          default:
            decoded = er + rdata.toString('hex') + rs;
            break;
        }
        console.log(`${name.padEnd(50, ' ')} ${idn}${this.rrTypeToString(type)}${rs}, Class: ${qclass}, TTL: ${ttl}, Data: ${decoded}`);
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
    const { name: nsdname, newOffset } = this.readDomainName(msg, offset);
    return { nsdname, newOffset };
  }

  // Function to decode NSEC records from an mDNS message
  private decodeNSEC(msg: Buffer, offset: number) {
    const labels = [];
    const rrtypes: string[] = [];
    let jumpOffset = undefined;
    const originalOffset = offset;

    while (msg[offset] !== 0) {
      if ((msg[offset] & 0xc0) === 0xc0) {
        if (jumpOffset === undefined) {
          jumpOffset = offset + 2;
          this.log.warn(`decodeNSEC: jump found at ${offset} jumpOffset ${jumpOffset} ${msg[jumpOffset]}`);
        }
        offset = ((msg[offset] & 0x3f) << 8) | msg[offset + 1];
        if (offset >= msg.length) {
          this.log.error(`decodeNSEC: pointer ${offset} out of bounds jumping from ${labels.join('.')}`);
          break;
        }
      } else {
        const length = msg[offset];
        labels.push(msg.toString('utf8', offset + 1, offset + 1 + length));
        offset += length + 1;
        if (offset >= msg.length) {
          this.log.error(`decodeNSEC: offset ${offset} out of bounds from ${labels.join('.')}`);
          break;
        }
      }
    }
    if (jumpOffset !== undefined) {
      offset = offset + 1;
      this.log.warn(
        `***NSEC rrtypes originalOffset ${originalOffset} jumpOffset ${jumpOffset} offset ${offset}`,
        msg.toString('hex', originalOffset),
        msg.toString('hex', jumpOffset),
        msg.toString('hex', offset),
      );
      return { nextDomain: labels.join('.'), rrtypes };
    } else
      this.log.warn(
        `***NSEC rrtypes originalOffset ${originalOffset} jumpOffset ${jumpOffset} offset ${offset}`,
        msg.toString('hex', originalOffset),
        msg.toString('hex', jumpOffset),
        msg.toString('hex', offset),
      );

    // Offset to the beginning of the bitmap
    const length = msg[offset];
    let bitmapOffset = offset + 1 + length;
    const endOfMsg = msg.length;

    // Loop through each bit in the bitmap
    while (bitmapOffset < endOfMsg) {
      const windowBlock = msg[bitmapOffset];
      const bitmapLength = msg[bitmapOffset + 1];

      for (let i = 0; i < bitmapLength; i++) {
        const byte = msg[bitmapOffset + 2 + i];
        for (let bit = 0; bit < 8; bit++) {
          if ((byte & (1 << (7 - bit))) !== 0) {
            const rrtype = (windowBlock << 8) | (i * 8 + bit);
            rrtypes.push(this.rrTypeToString(rrtype));
          }
        }
      }

      // Move to the next window block
      bitmapOffset += 2 + bitmapLength;
    }
    return { nextDomain: labels.join('.'), rrtypes };
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
      25: 'SIG',
      28: 'AAAA',
      33: 'SRV',
      39: 'DNAME',
      41: 'OPT',
      47: 'NSEC',
      48: 'DNSKEY',
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
}

MdnsScanner.listNetworkInterfaces(); // List available network interfaces

const scanner = new MdnsScanner(process.argv[2], false);

scanner.query('_shelly._tcp.local', 'PTR', 32769);
scanner.query('_shelly._tcp.local', 'PTR');

scanner.query('_http._tcp.local', 'PTR', 32769);
scanner.query('_http._tcp.local', 'PTR');
// scanner.query('_services._dns-sd._udp.local', 'PTR');

// scanner.query('_services._dns-sd._udp.local', 'PTR', 32769);

const interval = setInterval(() => {
  scanner.query('_http._tcp.local', 'PTR');
  scanner.query('_shelly._tcp.local', 'PTR');
  scanner.query('_services._dns-sd._udp.local', 'PTR');
}, 60000); // Query every 60 seconds

setTimeout(() => {
  // scanner.stop();
}, 30000); // Stop scanning after 10 seconds

process.on('SIGINT', () => {
  clearInterval(interval);
  scanner.stop();

  // Collect devices into an array
  const shellyArray = Array.from(scanner.shellyDevices.entries());
  // Sort the array by device address
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shellyArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.log(`Found ${shellyArray.length} Shelly devices:`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  shellyArray.forEach(([key, device]) => {
    console.log(`Shelly id: ${hk}${device.id}${rs} host ${zb}${device.address}${rs} gen: ${YELLOW}${device.gen}${rs}`);
  });

  // Collect devices into an array
  const devicesArray = Array.from(scanner.devices.entries());
  // Sort the array by device address
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  devicesArray.sort(([keyA, deviceA], [keyB, deviceB]) => deviceA.address.localeCompare(deviceB.address));
  // Log the sorted devices
  console.log(`Found ${devicesArray.length} devices:`);
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
  console.error(`Found ${errorDevicesArray.length} devices with errors:`);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  errorDevicesArray.forEach(([key, device]) => {
    console.error(`Device with error: ${device.address}:${device.port}`);
  });
});

/*



[21:51:49.227] [MdnsScanner] Received message from 192.168.1.44:5353
ID: 0
Flags: 33792
Questions: 0
Answers: 1
Authority RRs: 0
Additional RRs: 1
Answers:
MSL320-bfde._hap._tcp.local                        TXT, Class: 32769, TTL: 4500, Data: c#=2 ff=2 id=0E:65:DD:3F:BA:01 md=MSL320 pv=1.1 s#=1 sf=0 ci=5 sh=pJNf+Q==
Additional RRs:
[21:51:49.230] [MdnsScanner] decodeNSEC: jump found at 138 jumpOffset 140 0
[21:51:49.230] [MdnsScanner] NSEC rrtypes originalOffset 138 jumpOffset 140 offset 41 c00c00050000800040 00050000800040 0010800100001194004b0463233d320466663d321469643d30453a36353a44443a33463a42413a3031096d643d4d534c3332300670763d312e310473233d310473663d300463693d350b73683d704a4e662b513d3dc00c002f8001000011940009c00c00050000800040
MSL320-bfde._hap._tcp.local                        NSEC, Class: 32769, TTL: 4500, Data: nextDomain MSL320-bfde._hap._tcp.local rrtypes




[21:51:49.231] [MdnsScanner] Received message from fe80::4ae1:e9ff:fe68:bfde%9:5353
ID: 0
Flags: 33792
Questions: 0
Answers: 1
Authority RRs: 0
Additional RRs: 1
Answers:
MSL320-bfde._hap._tcp.local                        TXT, Class: 32769, TTL: 4500, Data: c#=2 ff=2 id=0E:65:DD:3F:BA:01 md=MSL320 pv=1.1 s#=1 sf=0 ci=5 sh=pJNf+Q==
Additional RRs:
[21:51:49.232] [MdnsScanner] decodeNSEC: jump found at 138 jumpOffset 140 0
[21:51:49.232] [MdnsScanner] NSEC rrtypes originalOffset 138 jumpOffset 140 offset 41 c00c00050000800040 00050000800040 0010800100001194004b0463233d320466663d321469643d30453a36353a44443a33463a42413a3031096d643d4d534c3332300670763d312e310473233d310473663d300463693d350b73683d704a4e662b513d3dc00c002f8001000011940009c00c00050000800040
MSL320-bfde._hap._tcp.local                        NSEC, Class: 32769, TTL: 4500, Data: nextDomain MSL320-bfde._hap._tcp.local rrtypes


[21:52:35.612] [MdnsScanner] Received message from 192.168.1.12:5353
ID: 0
Flags: 33792
Questions: 0
Answers: 3
Authority RRs: 0
Additional RRs: 1
Answers:
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fe80:0000:0000:0000:1c3f:f97c:0122:af6d
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fd78:cbf8:4939:0746:180d:e446:c47d:68c8
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fd78:cbf8:4939:0746:0002:fd28:06df:8c5d
Additional RRs:
[21:52:35.614] [MdnsScanner] decodeNSEC: jump found at 136 jumpOffset 138 0
[21:52:35.614] [MdnsScanner] NSEC rrtypes originalOffset 136 jumpOffset 138 offset 42 c00c000440000008 000440000008 001c8001000011940010fe800000000000001c3ff97c0122af6dc00c001c8001000011940010fd78cbf849390746180de446c47d68c8c00c001c8001000011940010fd78cbf8493907460002fd2806df8c5dc00c002f8001000011940008c00c000440000008
Living-room-HomePod-Sx.local                       NSEC, Class: 32769, TTL: 4500, Data: nextDomain Living-room-HomePod-Sx.local rrtypes




[21:52:35.615] [MdnsScanner] Received message from fe80::1c3f:f97c:122:af6d%9:5353
ID: 0
Flags: 33792
Questions: 0
Answers: 3
Authority RRs: 0
Additional RRs: 1
Answers:
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fe80:0000:0000:0000:1c3f:f97c:0122:af6d
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fd78:cbf8:4939:0746:180d:e446:c47d:68c8
Living-room-HomePod-Sx.local                       AAAA, Class: 32769, TTL: 4500, Data: fd78:cbf8:4939:0746:0002:fd28:06df:8c5d
Additional RRs:
[21:52:35.617] [MdnsScanner] decodeNSEC: jump found at 136 jumpOffset 138 0
[21:52:35.617] [MdnsScanner] NSEC rrtypes originalOffset 136 jumpOffset 138 offset 42 c00c000440000008 000440000008 001c8001000011940010fe800000000000001c3ff97c0122af6dc00c001c8001000011940010fd78cbf849390746180de446c47d68c8c00c001c8001000011940010fd78cbf8493907460002fd2806df8c5dc00c002f8001000011940008c00c000440000008
Living-room-HomePod-Sx.local                       NSEC, Class: 32769, TTL: 4500, Data: nextDomain Living-room-HomePod-Sx.local rrtypes



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
