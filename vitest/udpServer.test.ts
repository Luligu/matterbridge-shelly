/**
 * @file vitest/udpServer.test.ts
 * @description This file contains the tests for the UdpServer class.
 * @author Luca Liguori
 */

const NAME = 'UdpServer';

import { createSocket, type Socket } from 'node:dgram';

import { LogLevel } from 'matterbridge/logger';
import { setupTest } from 'matterbridge/vitest-utils';

import type { UdpRequestFrame } from '../src/udpServer.js';
import { UdpServer } from '../src/udpServer.js';

await setupTest(NAME, false);

interface UdpServerInternals {
  udpServer?: {
    emit(event: 'error', error: Error): boolean;
    socket: Socket;
  };
}

function getServerSocket(server: UdpServer): Socket {
  const udpServer = (server as unknown as UdpServerInternals).udpServer;
  if (!udpServer) throw new Error('UDP server is not started');
  return udpServer.socket;
}

function getServerPort(server: UdpServer): number {
  return getServerSocket(server).address().port;
}

async function startServer(server: UdpServer): Promise<void> {
  return new Promise((resolve) => {
    server.once('started', resolve);
    server.start();
  });
}

async function stopServer(server: UdpServer): Promise<void> {
  return new Promise((resolve) => {
    getServerSocket(server).once('close', resolve);
    server.stop();
  });
}

async function sendDatagram(port: number, message: object | string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = createSocket('udp4');
    const data = Buffer.from(typeof message === 'string' ? message : JSON.stringify(message));
    socket.send(data, port, '127.0.0.1', (error) => {
      socket.close();
      if (error) reject(error);
      else resolve();
    });
  });
}

async function bindGateway(onMessage: (message: UdpRequestFrame, socket: Socket, port: number) => void): Promise<{ socket: Socket; port: number }> {
  return new Promise((resolve) => {
    const socket = createSocket('udp4');
    socket.on('message', (data, remoteInfo) => {
      onMessage(JSON.parse(data.toString()), socket, remoteInfo.port);
    });
    socket.bind(0, '127.0.0.1', () => {
      resolve({ socket, port: socket.address().port });
    });
  });
}

describe('UdpServer', () => {
  const servers: UdpServer[] = [];
  const sockets: Socket[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    for (const server of servers) {
      if ((server as unknown as UdpServerInternals).udpServer) await stopServer(server);
    }
    servers.length = 0;
    for (const socket of sockets) {
      if (socket.address() instanceof Object) socket.close();
    }
    sockets.length = 0;
  });

  test('should start and stop the real UDP listener', async () => {
    const server = new UdpServer(0, undefined, LogLevel.DEBUG);
    servers.push(server);
    const started = vi.fn();
    const stopped = vi.fn();
    server.on('started', started);
    server.on('stopped', stopped);

    await startServer(server);
    expect(server.isListening).toBeTruthy();
    expect(getServerPort(server)).toBeGreaterThan(0);
    expect(started).toHaveBeenCalledOnce();

    server.start();
    await stopServer(server);
    expect(server.isListening).toBeFalsy();
    expect(stopped).toHaveBeenCalledOnce();
  });

  test('should receive updates, events, and RPC responses over UDP', async () => {
    const server = new UdpServer(0);
    servers.push(server);
    await startServer(server);
    const port = getServerPort(server);

    const update = vi.fn();
    const event = vi.fn();
    const response = vi.fn();
    server.on('udpupdate', update);
    server.on('udpevent', event);
    server.on('udpresponse', response);

    await sendDatagram(port, { src: 'shelly2pmg4-aabbccddeeff', dst: '*', method: 'NotifyStatus', params: { state: true } });
    await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());
    await sendDatagram(port, { src: 'shelly2pmg4-aabbccddeeff', dst: '*', method: 'NotifyFullStatus', params: { state: false } });
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    await sendDatagram(port, { src: 'shelly2pmg4-aabbccddeeff', dst: '*', method: 'NotifyEvent', params: { events: [] } });
    await vi.waitFor(() => expect(event).toHaveBeenCalledOnce());
    await sendDatagram(port, { id: 1, src: 'shelly2pmg4-aabbccddeeff', dst: 'Matterbridge', result: {} });
    await vi.waitFor(() => expect(response).toHaveBeenCalledOnce());

    expect(update).toHaveBeenNthCalledWith(1, 'shelly2pmg4-AABBCCDDEEFF', { state: true });
    expect(update).toHaveBeenNthCalledWith(2, 'shelly2pmg4-AABBCCDDEEFF', { state: false });
    expect(event).toHaveBeenCalledWith('shelly2pmg4-AABBCCDDEEFF', { events: [] });
    expect(response).toHaveBeenCalledWith('shelly2pmg4-AABBCCDDEEFF', {});
  });

  test('should apply and clear the source filter to real datagrams', async () => {
    const server = new UdpServer(0);
    servers.push(server);
    await startServer(server);
    const port = getServerPort(server);
    const update = vi.fn();
    server.on('udpupdate', update);
    server.setFilter(['shelly2pmg4-aabbccddeeff']);

    await sendDatagram(port, { src: 'shelly1pmg4-112233445566', dst: '*', method: 'NotifyStatus', params: { state: false } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(update).not.toHaveBeenCalled();

    await sendDatagram(port, { src: 'shelly2pmg4-aabbccddeeff', dst: '*', method: 'NotifyStatus', params: { state: true } });
    await vi.waitFor(() => expect(update).toHaveBeenCalledOnce());

    server.setFilter([]);
    await sendDatagram(port, { src: 'shelly1pmg4-112233445566', dst: '*', method: 'NotifyStatus', params: { state: false } });
    await vi.waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  });

  test('should not send an RPC request before the server starts', () => {
    const server = new UdpServer();
    const request: UdpRequestFrame = { src: 'Matterbridge', method: 'Shelly.GetStatus', params: {} };

    server.sendRpc(request, '127.0.0.1', 8585);

    expect(request.id).toBeUndefined();
  });

  test('should exchange a real UDP RPC request and response', async () => {
    const response = vi.fn();
    const gateway = await bindGateway((request, socket, port) => {
      socket.send(Buffer.from(JSON.stringify({ id: request.id, src: 'shelly2pmg4-aabbccddeeff', dst: request.src, result: { status: 'ok' } })), port, '127.0.0.1');
    });
    sockets.push(gateway.socket);
    const server = new UdpServer(0);
    servers.push(server);
    server.on('udpresponse', response);
    await startServer(server);
    const request: UdpRequestFrame = { src: 'Matterbridge', method: 'Shelly.GetStatus', params: {} };

    server.sendRpc(request, '127.0.0.1', gateway.port);

    await vi.waitFor(() => expect(response).toHaveBeenCalledWith('shelly2pmg4-AABBCCDDEEFF', { status: 'ok' }));
    expect(request.id).toBe(1);
  });

  test('should resend a real UDP RPC request with digest authentication', async () => {
    const requests: UdpRequestFrame[] = [];
    const response = vi.fn();
    const gateway = await bindGateway((request, socket, port) => {
      requests.push(request);
      if (request.auth) {
        socket.send(Buffer.from(JSON.stringify({ id: request.id, src: 'shelly2pmg4-aabbccddeeff', dst: request.src, result: { authenticated: true } })), port, '127.0.0.1');
        return;
      }
      const challenge = { auth_type: 'digest', nonce: 'challenge', realm: 'shelly2pmg4-aabbccddeeff', algorithm: 'SHA-256' };
      socket.send(
        Buffer.from(JSON.stringify({ id: request.id, src: 'shelly2pmg4-aabbccddeeff', dst: request.src, error: { code: 401, message: JSON.stringify(challenge) } })),
        port,
        '127.0.0.1',
      );
    });
    sockets.push(gateway.socket);
    const server = new UdpServer(0, 'secret');
    servers.push(server);
    server.on('udpresponse', response);
    await startServer(server);

    server.sendRpc({ src: 'Matterbridge', method: 'Shelly.GetStatus', params: {} }, '127.0.0.1', gateway.port);

    await vi.waitFor(() => expect(response).toHaveBeenCalledWith('shelly2pmg4-AABBCCDDEEFF', { authenticated: true }));
    expect(requests).toHaveLength(2);
    expect(requests[1].auth).toMatchObject({ realm: 'shelly2pmg4-aabbccddeeff', username: 'admin', nonce: 'challenge', nc: '00000001', algorithm: 'SHA-256' });
    expect(requests[1].auth?.response).toMatch(/^[a-f0-9]{64}$/);
  });

  test('should not retry a real authentication challenge without a password', async () => {
    const requests: UdpRequestFrame[] = [];
    const gateway = await bindGateway((request, socket, port) => {
      requests.push(request);
      const challenge = { auth_type: 'digest', nonce: 'challenge', realm: 'shelly2pmg4-aabbccddeeff', algorithm: 'SHA-256' };
      socket.send(
        Buffer.from(JSON.stringify({ id: request.id, src: 'shelly2pmg4-aabbccddeeff', dst: request.src, error: { code: 401, message: JSON.stringify(challenge) } })),
        port,
        '127.0.0.1',
      );
    });
    sockets.push(gateway.socket);
    const server = new UdpServer(0);
    servers.push(server);
    await startServer(server);

    server.sendRpc({ id: 42, src: 'Matterbridge', method: 'Shelly.GetStatus', params: {} }, '127.0.0.1', gateway.port);

    await vi.waitFor(() => expect(requests).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toHaveLength(1);
  });

  test('should handle malformed datagrams and socket errors', async () => {
    const server = new UdpServer(0);
    servers.push(server);
    const errorListener = vi.fn();
    const update = vi.fn();
    server.on('error', errorListener);
    server.on('udpupdate', update);
    await startServer(server);

    await sendDatagram(getServerPort(server), 'not-json');
    await new Promise((resolve) => setTimeout(resolve, 20));
    (server as unknown as UdpServerInternals).udpServer?.emit('error', new Error('socket failed'));

    expect(update).not.toHaveBeenCalled();
    expect(errorListener).toHaveBeenCalledWith(expect.objectContaining({ message: 'socket failed' }));
    expect(server.isListening).toBeFalsy();
  });
});
