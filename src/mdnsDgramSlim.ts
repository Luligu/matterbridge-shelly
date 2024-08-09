/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import dgram from 'dgram';
import dnsPacket from 'dns-packet';

const multicastAddressIpv4 = '224.0.0.251';
const multicastAddressIpv6 = 'ff02::fb';
const multicastPort = 5353;

const queryShelly = dnsPacket.encode({
  type: 'query',
  id: 0,
  flags: 0,
  questions: [
    {
      type: 'PTR',
      name: '_shelly._tcp.local',
    },
  ],
});

const queryHttp = dnsPacket.encode({
  type: 'query',
  id: 0,
  flags: 0,
  questions: [
    {
      type: 'PTR',
      name: '_http._tcp.local',
    },
  ],
});

const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// If you remove the bind, the socket should not receive any messages but instead it receives all messages from shelly plus devices!!!
// It is like the plus devices send their responses to the device that send the query and not to the multicast address... possible?
socket.bind(multicastPort, () => {
  socket.setMulticastTTL(255);
  socket.setMulticastLoopback(true);
  socket.addMembership(multicastAddressIpv4);
  console.log(`Socket listening on ${multicastAddressIpv4}:${multicastPort}`);
});

socket.on('error', (err) => {
  console.log(`Socket error: ${err}`);
});

socket.on('warning', (err) => {
  console.log(`Socket warning: ${err}`);
});

socket.on('message', (message, rinfo) => {
  console.log(`message from ${rinfo.address}`);
  // console.log(dnsPacket.decode(message));
});

socket.send(queryShelly, 0, queryShelly.length, multicastPort, multicastAddressIpv4, (err) => {
  if (err) console.error('Error sending _shelly._tcp.local query', err);
});

socket.send(queryHttp, 0, queryHttp.length, multicastPort, multicastAddressIpv4, (err) => {
  if (err) console.error('Error sending _http._tcp.local query', err);
});
