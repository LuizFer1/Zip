import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import net, { AddressInfo, Socket } from 'node:net';

export interface PeerAddress {
  host: string;
  port: number;
}

export interface TransportEnvelope<T = unknown> {
  id: string;
  type: string;
  source: string;
  ttl: number;
  timestamp: number;
  payload: T;
}

export interface TransportPeerInfo {
  connectionId: string;
  nodeId?: string;
  remote: PeerAddress;
}

export interface P2PTransportOptions {
  nodeId?: string;
  host?: string;
  port: number;
  maxTTL?: number;
  dedupeSize?: number;
  dedupeWindowMs?: number;
}

interface SocketState {
  connectionId: string;
  socket: Socket;
  buffer: string;
  remote: PeerAddress;
  peerNodeId?: string;
}

const DEFAULT_MAX_TTL = 6;
const DEFAULT_DEDUPE_SIZE = 10_000;
const DEFAULT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export class P2PTransport extends EventEmitter {
  readonly nodeId: string;

  private readonly host: string;
  private readonly port: number;
  private readonly maxTTL: number;
  private readonly dedupeSize: number;
  private readonly dedupeWindowMs: number;
  private readonly server: net.Server;
  private readonly sockets = new Map<string, SocketState>();
  private readonly seenMessages = new Map<string, number>();
  private readonly pruneTimer: NodeJS.Timeout;
  private started = false;

  constructor(options: P2PTransportOptions) {
    super();

    if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
      throw new Error('Invalid P2P port: expected a value between 1 and 65535');
    }

    this.nodeId = (options.nodeId ?? randomUUID()).trim();
    this.host = options.host ?? '0.0.0.0';
    this.port = options.port;
    this.maxTTL = Math.max(1, options.maxTTL ?? DEFAULT_MAX_TTL);
    this.dedupeSize = Math.max(100, options.dedupeSize ?? DEFAULT_DEDUPE_SIZE);
    this.dedupeWindowMs = Math.max(10_000, options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS);

    this.server = net.createServer((socket) => {
      this.registerSocket(socket);
    });

    this.server.on('error', (error) => {
      this.emit('warning', { error });
    });

    this.pruneTimer = setInterval(() => {
      this.pruneSeenMessages();
    }, 60_000);
    this.pruneTimer.unref();
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        this.server.off('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        this.server.off('error', onError);
        resolve();
      };

      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.port, this.host);
    });

    this.started = true;
    this.emit('listening', this.address());
  }

  async stop(): Promise<void> {
    this.pruneTimer.unref();
    clearInterval(this.pruneTimer);

    for (const connection of this.sockets.values()) {
      connection.socket.destroy();
    }
    this.sockets.clear();

    if (!this.started) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.server.close(() => resolve());
    });
    this.started = false;
  }

  async connect(peer: PeerAddress): Promise<string> {
    if (!this.started) {
      throw new Error('P2P transport is not started');
    }

    const existing = this.findConnectionByAddress(peer);
    if (existing) {
      return existing.connectionId;
    }

    return new Promise<string>((resolve, reject) => {
      const socket = net.createConnection(peer.port, peer.host);

      const onError = (error: Error) => {
        socket.off('connect', onConnect);
        reject(error);
      };

      const onConnect = () => {
        socket.off('error', onError);
        const connectionId = this.registerSocket(socket);
        resolve(connectionId);
      };

      socket.once('error', onError);
      socket.once('connect', onConnect);
    });
  }

  address(): { host: string; port: number } {
    const addr = this.server.address();
    if (!addr || typeof addr === 'string') {
      return { host: this.host, port: this.port };
    }
    const parsed = addr as AddressInfo;
    return {
      host: parsed.address,
      port: parsed.port,
    };
  }

  getPeers(): TransportPeerInfo[] {
    return [...this.sockets.values()].map((socket) => ({
      connectionId: socket.connectionId,
      nodeId: socket.peerNodeId,
      remote: socket.remote,
    }));
  }

  broadcast<T>(type: string, payload: T, ttl = this.maxTTL): string {
    const envelope = this.createEnvelope(type, payload, ttl);
    this.rememberMessage(envelope.id);
    this.sendToAll(envelope);
    return envelope.id;
  }

  sendToNode<T>(nodeId: string, type: string, payload: T, ttl = this.maxTTL): boolean {
    const connection = [...this.sockets.values()].find((s) => s.peerNodeId === nodeId);
    if (!connection) {
      return false;
    }
    const envelope = this.createEnvelope(type, payload, ttl);
    this.rememberMessage(envelope.id);
    this.sendEnvelope(connection, envelope);
    return true;
  }

  private createEnvelope<T>(type: string, payload: T, ttl: number): TransportEnvelope<T> {
    return {
      id: randomUUID(),
      type,
      source: this.nodeId,
      ttl: Math.max(1, ttl),
      timestamp: Date.now(),
      payload,
    };
  }

  private registerSocket(socket: Socket): string {
    socket.setNoDelay(true);
    socket.setEncoding('utf8');

    const connectionId = randomUUID();
    const state: SocketState = {
      connectionId,
      socket,
      buffer: '',
      remote: {
        host: socket.remoteAddress ?? 'unknown',
        port: socket.remotePort ?? 0,
      },
    };

    this.sockets.set(connectionId, state);

    socket.on('data', (chunk: string | Buffer) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      this.consumeData(state, text);
    });

    socket.on('error', (error) => {
      this.emit('warning', { connectionId, error });
    });

    socket.on('close', () => {
      this.unregisterSocket(connectionId);
    });

    this.sendEnvelope(state, this.createEnvelope('hello', {
      nodeId: this.nodeId,
      protocol: 'zip/1',
      listenPort: this.port,
    }, 1));

    return connectionId;
  }

  private unregisterSocket(connectionId: string): void {
    const state = this.sockets.get(connectionId);
    if (!state) {
      return;
    }
    this.sockets.delete(connectionId);
    this.emit('peer:disconnected', {
      connectionId,
      nodeId: state.peerNodeId,
      remote: state.remote,
    });
  }

  private consumeData(state: SocketState, chunk: string): void {
    state.buffer += chunk;
    let lineEnd = state.buffer.indexOf('\n');

    while (lineEnd >= 0) {
      const line = state.buffer.slice(0, lineEnd).trim();
      state.buffer = state.buffer.slice(lineEnd + 1);

      if (line.length > 0) {
        this.consumeLine(state, line);
      }

      lineEnd = state.buffer.indexOf('\n');
    }
  }

  private consumeLine(state: SocketState, line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.emit('warning', {
        connectionId: state.connectionId,
        error: new Error(`Invalid JSON frame: ${(error as Error).message}`),
      });
      return;
    }

    const envelope = this.parseEnvelope(parsed);
    if (!envelope) {
      this.emit('warning', {
        connectionId: state.connectionId,
        error: new Error('Invalid envelope shape'),
      });
      return;
    }

    this.processEnvelope(state, envelope);
  }

  private processEnvelope(state: SocketState, envelope: TransportEnvelope): void {
    if (this.hasSeenMessage(envelope.id)) {
      return;
    }
    this.rememberMessage(envelope.id);

    if (envelope.type === 'hello') {
      const firstTime = !state.peerNodeId;
      const nodeId = this.parseHelloNodeId(envelope.payload);
      if (nodeId) {
        state.peerNodeId = nodeId;
      }
      if (firstTime) {
        this.emit('peer:connected', {
          connectionId: state.connectionId,
          nodeId: state.peerNodeId ?? envelope.source,
          remote: state.remote,
        });
      }
      return;
    }

    this.emit('message', {
      connectionId: state.connectionId,
      envelope,
      nodeId: state.peerNodeId ?? envelope.source,
    });

    if (envelope.ttl > 1) {
      const relayed: TransportEnvelope = {
        ...envelope,
        ttl: envelope.ttl - 1,
      };
      this.sendToAll(relayed, state.connectionId);
    }
  }

  private sendToAll(envelope: TransportEnvelope, exceptConnectionId?: string): void {
    for (const connection of this.sockets.values()) {
      if (connection.connectionId === exceptConnectionId) {
        continue;
      }
      this.sendEnvelope(connection, envelope);
    }
  }

  private sendEnvelope(connection: SocketState, envelope: TransportEnvelope): void {
    if (connection.socket.destroyed) {
      return;
    }
    try {
      connection.socket.write(`${JSON.stringify(envelope)}\n`);
    } catch (error) {
      this.emit('warning', { connectionId: connection.connectionId, error });
    }
  }

  private parseEnvelope(value: unknown): TransportEnvelope | null {
    if (!this.isRecord(value)) {
      return null;
    }

    const id = value.id;
    const type = value.type;
    const source = value.source;
    const ttl = typeof value.ttl === 'number' ? value.ttl : Number.NaN;
    const timestamp = typeof value.timestamp === 'number' ? value.timestamp : Number.NaN;

    if (
      typeof id !== 'string'
      || typeof type !== 'string'
      || typeof source !== 'string'
      || !Number.isInteger(ttl)
      || ttl < 1
      || !Number.isFinite(timestamp)
    ) {
      return null;
    }

    return {
      id,
      type,
      source,
      ttl,
      timestamp,
      payload: value.payload,
    };
  }

  private parseHelloNodeId(payload: unknown): string | undefined {
    if (!this.isRecord(payload)) {
      return undefined;
    }
    if (typeof payload.nodeId !== 'string' || payload.nodeId.trim().length === 0) {
      return undefined;
    }
    return payload.nodeId;
  }

  private hasSeenMessage(id: string): boolean {
    return this.seenMessages.has(id);
  }

  private rememberMessage(id: string): void {
    if (this.seenMessages.has(id)) {
      return;
    }
    this.seenMessages.set(id, Date.now());

    while (this.seenMessages.size > this.dedupeSize) {
      const oldest = this.seenMessages.keys().next();
      if (oldest.done) {
        break;
      }
      this.seenMessages.delete(oldest.value);
    }
  }

  private pruneSeenMessages(): void {
    const threshold = Date.now() - this.dedupeWindowMs;
    for (const [id, seenAt] of this.seenMessages) {
      if (seenAt < threshold) {
        this.seenMessages.delete(id);
      }
    }
  }

  private findConnectionByAddress(peer: PeerAddress): SocketState | undefined {
    return [...this.sockets.values()].find((socket) =>
      socket.remote.port === peer.port
      && this.sameHost(socket.remote.host, peer.host),
    );
  }

  private sameHost(a: string, b: string): boolean {
    const normalize = (value: string) => {
      const cleaned = value
        .replace('::ffff:', '')
        .replace('[', '')
        .replace(']', '')
        .trim()
        .toLowerCase();
      if (cleaned === 'localhost' || cleaned === '::1') {
        return '127.0.0.1';
      }
      return cleaned;
    };
    return normalize(a) === normalize(b);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
