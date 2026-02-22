import { PeerAddress, P2PTransport, TransportPeerInfo } from './transport';

export interface PeerServiceOptions {
  seeds?: PeerAddress[];
  reconnectIntervalMs?: number;
  logger?: Pick<Console, 'info' | 'warn'>;
}

const DEFAULT_RECONNECT_INTERVAL_MS = 15_000;

export class PeerService {
  private reconnectTimer?: NodeJS.Timeout;
  private readonly logger: Pick<Console, 'info' | 'warn'>;

  constructor(
    private readonly transport: P2PTransport,
    private readonly options: PeerServiceOptions = {},
  ) {
    this.logger = options.logger ?? console;
  }

  async start(): Promise<void> {
    await this.transport.start();
    await this.connectSeeds();

    const interval = this.options.reconnectIntervalMs ?? DEFAULT_RECONNECT_INTERVAL_MS;
    if ((this.options.seeds?.length ?? 0) > 0 && interval > 0) {
      this.reconnectTimer = setInterval(() => {
        void this.connectSeeds();
      }, interval);
      this.reconnectTimer.unref();
    }
  }

  async stop(): Promise<void> {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    await this.transport.stop();
  }

  peers(): TransportPeerInfo[] {
    return this.transport.getPeers();
  }

  private async connectSeeds(): Promise<void> {
    const seeds = this.options.seeds ?? [];
    if (seeds.length === 0) {
      return;
    }

    for (const seed of seeds) {
      if (this.isAlreadyConnected(seed)) {
        continue;
      }

      try {
        await this.transport.connect(seed);
        this.logger.info(`[peer] connected seed ${seed.host}:${seed.port}`);
      } catch {
        this.logger.warn(`[peer] failed connecting seed ${seed.host}:${seed.port}`);
      }
    }
  }

  private isAlreadyConnected(seed: PeerAddress): boolean {
    return this.transport
      .getPeers()
      .some((peer) => peer.remote.port === seed.port && this.sameHost(peer.remote.host, seed.host));
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
}
