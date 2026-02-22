"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2PTransport = void 0;
const node_crypto_1 = require("node:crypto");
const node_events_1 = require("node:events");
const node_net_1 = __importDefault(require("node:net"));
const DEFAULT_MAX_TTL = 6;
const DEFAULT_DEDUPE_SIZE = 10000;
const DEFAULT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;
class P2PTransport extends node_events_1.EventEmitter {
    constructor(options) {
        super();
        this.sockets = new Map();
        this.seenMessages = new Map();
        this.started = false;
        if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
            throw new Error('Invalid P2P port: expected a value between 1 and 65535');
        }
        this.nodeId = (options.nodeId ?? (0, node_crypto_1.randomUUID)()).trim();
        this.host = options.host ?? '0.0.0.0';
        this.port = options.port;
        this.maxTTL = Math.max(1, options.maxTTL ?? DEFAULT_MAX_TTL);
        this.dedupeSize = Math.max(100, options.dedupeSize ?? DEFAULT_DEDUPE_SIZE);
        this.dedupeWindowMs = Math.max(10000, options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS);
        this.server = node_net_1.default.createServer((socket) => {
            this.registerSocket(socket);
        });
        this.server.on('error', (error) => {
            this.emit('warning', { error });
        });
        this.pruneTimer = setInterval(() => {
            this.pruneSeenMessages();
        }, 60000);
        this.pruneTimer.unref();
    }
    async start() {
        if (this.started) {
            return;
        }
        await new Promise((resolve, reject) => {
            const onError = (error) => {
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
    async stop() {
        this.pruneTimer.unref();
        clearInterval(this.pruneTimer);
        for (const connection of this.sockets.values()) {
            connection.socket.destroy();
        }
        this.sockets.clear();
        if (!this.started) {
            return;
        }
        await new Promise((resolve) => {
            this.server.close(() => resolve());
        });
        this.started = false;
    }
    async connect(peer) {
        if (!this.started) {
            throw new Error('P2P transport is not started');
        }
        const existing = this.findConnectionByAddress(peer);
        if (existing) {
            return existing.connectionId;
        }
        return new Promise((resolve, reject) => {
            const socket = node_net_1.default.createConnection(peer.port, peer.host);
            const onError = (error) => {
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
    address() {
        const addr = this.server.address();
        if (!addr || typeof addr === 'string') {
            return { host: this.host, port: this.port };
        }
        const parsed = addr;
        return {
            host: parsed.address,
            port: parsed.port,
        };
    }
    getPeers() {
        return [...this.sockets.values()].map((socket) => ({
            connectionId: socket.connectionId,
            nodeId: socket.peerNodeId,
            remote: socket.remote,
        }));
    }
    broadcast(type, payload, ttl = this.maxTTL) {
        const envelope = this.createEnvelope(type, payload, ttl);
        this.rememberMessage(envelope.id);
        this.sendToAll(envelope);
        return envelope.id;
    }
    sendToNode(nodeId, type, payload, ttl = this.maxTTL) {
        const connection = [...this.sockets.values()].find((s) => s.peerNodeId === nodeId);
        if (!connection) {
            return false;
        }
        const envelope = this.createEnvelope(type, payload, ttl);
        this.rememberMessage(envelope.id);
        this.sendEnvelope(connection, envelope);
        return true;
    }
    createEnvelope(type, payload, ttl) {
        return {
            id: (0, node_crypto_1.randomUUID)(),
            type,
            source: this.nodeId,
            ttl: Math.max(1, ttl),
            timestamp: Date.now(),
            payload,
        };
    }
    registerSocket(socket) {
        socket.setNoDelay(true);
        socket.setEncoding('utf8');
        const connectionId = (0, node_crypto_1.randomUUID)();
        const state = {
            connectionId,
            socket,
            buffer: '',
            remote: {
                host: socket.remoteAddress ?? 'unknown',
                port: socket.remotePort ?? 0,
            },
        };
        this.sockets.set(connectionId, state);
        socket.on('data', (chunk) => {
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
    unregisterSocket(connectionId) {
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
    consumeData(state, chunk) {
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
    consumeLine(state, line) {
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (error) {
            this.emit('warning', {
                connectionId: state.connectionId,
                error: new Error(`Invalid JSON frame: ${error.message}`),
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
    processEnvelope(state, envelope) {
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
            const relayed = {
                ...envelope,
                ttl: envelope.ttl - 1,
            };
            this.sendToAll(relayed, state.connectionId);
        }
    }
    sendToAll(envelope, exceptConnectionId) {
        for (const connection of this.sockets.values()) {
            if (connection.connectionId === exceptConnectionId) {
                continue;
            }
            this.sendEnvelope(connection, envelope);
        }
    }
    sendEnvelope(connection, envelope) {
        if (connection.socket.destroyed) {
            return;
        }
        try {
            connection.socket.write(`${JSON.stringify(envelope)}\n`);
        }
        catch (error) {
            this.emit('warning', { connectionId: connection.connectionId, error });
        }
    }
    parseEnvelope(value) {
        if (!this.isRecord(value)) {
            return null;
        }
        const id = value.id;
        const type = value.type;
        const source = value.source;
        const ttl = typeof value.ttl === 'number' ? value.ttl : Number.NaN;
        const timestamp = typeof value.timestamp === 'number' ? value.timestamp : Number.NaN;
        if (typeof id !== 'string'
            || typeof type !== 'string'
            || typeof source !== 'string'
            || !Number.isInteger(ttl)
            || ttl < 1
            || !Number.isFinite(timestamp)) {
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
    parseHelloNodeId(payload) {
        if (!this.isRecord(payload)) {
            return undefined;
        }
        if (typeof payload.nodeId !== 'string' || payload.nodeId.trim().length === 0) {
            return undefined;
        }
        return payload.nodeId;
    }
    hasSeenMessage(id) {
        return this.seenMessages.has(id);
    }
    rememberMessage(id) {
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
    pruneSeenMessages() {
        const threshold = Date.now() - this.dedupeWindowMs;
        for (const [id, seenAt] of this.seenMessages) {
            if (seenAt < threshold) {
                this.seenMessages.delete(id);
            }
        }
    }
    findConnectionByAddress(peer) {
        return [...this.sockets.values()].find((socket) => socket.remote.port === peer.port
            && this.sameHost(socket.remote.host, peer.host));
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
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
exports.P2PTransport = P2PTransport;
