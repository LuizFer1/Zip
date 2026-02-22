"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PresenceService = void 0;
const DEFAULT_INTERVAL_MS = 10000;
const DEFAULT_TIMEOUT_MS = 30000;
class PresenceService {
    constructor(transport, options = {}) {
        this.transport = transport;
        this.running = false;
        this.lastSeenByPeer = new Map();
        this.onMessage = (message) => {
            const envelope = message.envelope;
            if (envelope.type === 'presence.ping') {
                this.handlePing(message);
                return;
            }
            if (envelope.type === 'presence.pong') {
                this.handlePong(message);
            }
        };
        this.intervalMs = Math.max(1000, options.intervalMs ?? DEFAULT_INTERVAL_MS);
        this.timeoutMs = Math.max(this.intervalMs, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        this.logger = options.logger ?? console;
    }
    start() {
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
    stop() {
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
    peersOnline() {
        this.pruneStalePeers();
        return [...this.lastSeenByPeer.keys()].sort();
    }
    broadcastPing() {
        const payload = {
            nodeId: this.transport.nodeId,
            timestamp: Date.now(),
        };
        this.transport.broadcast('presence.ping', payload, 1);
    }
    handlePing(message) {
        const payload = this.readPayload(message.envelope.payload);
        if (!payload || !message.nodeId) {
            return;
        }
        this.lastSeenByPeer.set(message.nodeId, Date.now());
        const pong = {
            nodeId: this.transport.nodeId,
            timestamp: Date.now(),
        };
        this.transport.sendToNode(message.nodeId, 'presence.pong', pong, 1);
    }
    handlePong(message) {
        const payload = this.readPayload(message.envelope.payload);
        if (!payload || !message.nodeId) {
            return;
        }
        this.lastSeenByPeer.set(message.nodeId, Date.now());
    }
    pruneStalePeers() {
        const cutoff = Date.now() - this.timeoutMs;
        for (const [peer, seenAt] of this.lastSeenByPeer) {
            if (seenAt < cutoff) {
                this.lastSeenByPeer.delete(peer);
                this.logger.warn(`[presence] peer timed out ${peer}`);
            }
        }
    }
    readPayload(payload) {
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
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
exports.PresenceService = PresenceService;
