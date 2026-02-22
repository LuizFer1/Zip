"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerService = void 0;
const DEFAULT_RECONNECT_INTERVAL_MS = 15000;
class PeerService {
    constructor(transport, options = {}) {
        this.transport = transport;
        this.options = options;
    }
    async start() {
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
    async stop() {
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        await this.transport.stop();
    }
    peers() {
        return this.transport.getPeers();
    }
    async connectSeeds() {
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
            }
            catch {
                // Best-effort reconnection for unstable P2P links.
            }
        }
    }
    isAlreadyConnected(seed) {
        return this.transport
            .getPeers()
            .some((peer) => peer.remote.port === seed.port && this.sameHost(peer.remote.host, seed.host));
    }
    sameHost(a, b) {
        const normalize = (value) => {
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
exports.PeerService = PeerService;
