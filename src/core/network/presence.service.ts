import { P2PTransport, TransportEnvelope } from './transport';

interface PresencePayload {
  nodeId: string;
  timestamp: number;
}

interface PresenceMessage {
  envelope: TransportEnvelope;
  nodeId?: string;
}

export interface PresenceServiceOptions {
  intervalMs?: number;
  timeoutMs?: number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

const DEFAULT_INTERVAL_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 30_000;

export class PresenceService {
  private running = false;
  private heartbeatTimer?: NodeJS.Timeout;
  private readonly intervalMs: number;
  private readonly timeoutMs: number;
  private readonly logger: Pick<Console, 'info' | 'warn'>;
  private readonly lastSeenByPeer = new Map<string, number>();

  constructor(
    private readonly transport: P2PTransport,
    options: PresenceServiceOptions = {},
  ) {
    this.intervalMs = Math.max(1_000, options.intervalMs ?? DEFAULT_INTERVAL_MS);
    this.timeoutMs = Math.max(this.intervalMs, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.logger = options.logger ?? console;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.transport.on('message', this.onMessage);
    this.heartbeatTimer = setInterval(() => {
      this.broadcastPing();
      this.pruneStalePeers();
    }, this.intervalMs);
    this.heartbeatTimer.unref();
    this.broadcastPing();
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.transport.off('message', this.onMessage);
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    this.lastSeenByPeer.clear();
  }

  peersOnline(): string[] {
    this.pruneStalePeers();
    return [...this.lastSeenByPeer.keys()].sort();
  }

  private broadcastPing(): void {
    const payload: PresencePayload = {
      nodeId: this.transport.nodeId,
      timestamp: Date.now(),
    };
    this.transport.broadcast('presence.ping', payload, 1);
  }

  private readonly onMessage = (message: PresenceMessage): void => {
    const envelope = message.envelope;
    if (envelope.type === 'presence.ping') {
      this.handlePing(message);
      return;
    }
    if (envelope.type === 'presence.pong') {
      this.handlePong(message);
    }
  };

  private handlePing(message: PresenceMessage): void {
    const payload = this.readPayload(message.envelope.payload);
    if (!payload || !message.nodeId) {
      return;
    }

    this.lastSeenByPeer.set(message.nodeId, Date.now());
    const pong: PresencePayload = {
      nodeId: this.transport.nodeId,
      timestamp: Date.now(),
    };
    this.transport.sendToNode(message.nodeId, 'presence.pong', pong, 1);
  }

  private handlePong(message: PresenceMessage): void {
    const payload = this.readPayload(message.envelope.payload);
    if (!payload || !message.nodeId) {
      return;
    }

    this.lastSeenByPeer.set(message.nodeId, Date.now());
  }

  private pruneStalePeers(): void {
    const cutoff = Date.now() - this.timeoutMs;
    for (const [peer, seenAt] of this.lastSeenByPeer) {
      if (seenAt < cutoff) {
        this.lastSeenByPeer.delete(peer);
        this.logger.warn(`[presence] peer timed out ${peer}`);
      }
    }
  }

  private readPayload(payload: unknown): PresencePayload | null {
    if (!this.isRecord(payload)) {
      return null;
    }
    if (typeof payload.nodeId !== 'string' || typeof payload.timestamp !== 'number') {
      return null;
    }
    return {
      nodeId: payload.nodeId,
      timestamp: payload.timestamp,
    };
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
