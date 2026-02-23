"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
require("dotenv/config");
const identity_service_1 = require("../core/indentity/identity.service");
const peer_service_1 = require("../core/network/peer.service");
const presence_service_1 = require("../core/network/presence.service");
const transport_1 = require("../core/network/transport");
const logger_1 = require("../core/observability/logger");
const event_serializer_1 = require("../core/protocol/event.serializer");
const event_service_1 = require("../core/protocol/event.service");
const gossip_service_1 = require("../core/replication/gossip.service");
const sync_service_1 = require("../core/replication/sync.service");
const backup_service_1 = require("../core/storage/backup.service");
const database_path_1 = require("../core/storage/database.path");
const prisma_client_1 = require("../core/storage/prisma.client");
const prisma_channel_repository_1 = require("../infrastructure/persistence/prisma/prisma-channel.repository");
const prisma_event_store_1 = require("../infrastructure/persistence/prisma/prisma-event.store");
const prisma_identity_repository_1 = require("../infrastructure/persistence/prisma/prisma-identity.repository");
// ── Services ─────────────────────────────────────────────────
const identityRepo = new prisma_identity_repository_1.PrismaIdentityRepository();
const identityService = new identity_service_1.IdentityService(identityRepo);
const channelRepository = new prisma_channel_repository_1.PrismaChannelRepository();
const eventStore = new prisma_event_store_1.PrismaEventStore();
const eventService = new event_service_1.EventService(eventStore);
const syncService = new sync_service_1.SyncService(eventService);
const p2pLogger = new logger_1.StructuredLogger('p2p');
let peerService = null;
let gossipService = null;
let presenceService = null;
let transportRef = null;
let gossipMetricsTimer = null;
let backupService = null;
let backupTimer = null;
const contactsByNodeId = new Map();
const pendingInvites = new Map();
const P2P_ENABLED = (process.env.ZIP_P2P_ENABLED ?? 'true').toLowerCase() !== 'false';
const P2P_HOST = process.env.ZIP_P2P_HOST ?? '0.0.0.0';
const P2P_PORT = parsePort(process.env.ZIP_P2P_PORT, 7070);
const P2P_SEEDS = parsePeerSeeds(process.env.ZIP_P2P_SEEDS ?? process.env.ZIP_P2P_SEED);
const P2P_NODE_ID = process.env.ZIP_P2P_NODE_ID?.trim();
const BACKUP_ENABLED = (process.env.ZIP_BACKUP_ENABLED ?? 'false').toLowerCase() === 'true';
const BACKUP_INTERVAL_MS = parsePositiveInt(process.env.ZIP_BACKUP_INTERVAL_MS, 5 * 60000);
const BACKUP_DIR = process.env.ZIP_BACKUP_DIR;
const BACKUP_HTTP_ENDPOINT = process.env.ZIP_BACKUP_HTTP_ENDPOINT?.trim();
const BACKUP_HTTP_TOKEN = process.env.ZIP_BACKUP_HTTP_TOKEN?.trim();
// ── IPC Helpers ───────────────────────────────────────────────
function initials(username) {
    return username
        .trim()
        .split(/\s+/)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
        .slice(0, 2);
}
function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
function normalizePublicKey(value) {
    if (typeof value === 'string') {
        const normalized = value.trim();
        if (/^[0-9a-fA-F]{64}$/.test(normalized)) {
            return normalized.toLowerCase();
        }
        if (/^\d+(,\d+){31}$/.test(normalized)) {
            const bytes = normalized
                .split(',')
                .map((v) => Number.parseInt(v, 10));
            return Buffer.from(bytes).toString('hex');
        }
        return normalized;
    }
    if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
        return Buffer.from(value).toString('hex');
    }
    return String(value);
}
function emitUIEventUpdate(event, source) {
    const payload = {
        id: event.id,
        channelId: event.channelId,
        type: event.type,
        source,
        timestamp: event.timestamp,
    };
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        win.webContents.send('events:changed', payload);
    }
}
function getP2PStatus() {
    return {
        enabled: P2P_ENABLED,
        connected: peerService !== null && gossipService !== null,
        peers: peerService?.peers().length ?? 0,
        host: P2P_HOST,
        port: P2P_PORT,
    };
}
function emitP2PStatus() {
    const status = getP2PStatus();
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        win.webContents.send('p2p:status-changed', status);
    }
}
function listContacts() {
    return [...contactsByNodeId.values()].sort((a, b) => a.username.localeCompare(b.username));
}
function emitContactsChanged() {
    const payload = listContacts();
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        win.webContents.send('contacts:changed', payload);
    }
}
function listInvites() {
    return [...pendingInvites.values()].sort((a, b) => b.createdAt - a.createdAt);
}
function emitInvitesChanged() {
    const payload = listInvites();
    for (const win of electron_1.BrowserWindow.getAllWindows()) {
        win.webContents.send('invites:changed', payload);
    }
}
function defaultContactName(nodeId) {
    return `Peer ${nodeId.slice(0, 8)}`;
}
function readIdentitySharePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const data = payload;
    if (typeof data.nodeId !== 'string' || data.nodeId.trim().length === 0)
        return null;
    if (typeof data.publicKey !== 'string' || data.publicKey.trim().length === 0)
        return null;
    if (typeof data.username !== 'string' || data.username.trim().length === 0)
        return null;
    if (data.avatar !== undefined && typeof data.avatar !== 'string')
        return null;
    return {
        nodeId: data.nodeId,
        publicKey: data.publicKey,
        username: data.username,
        avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
    };
}
function readInvitePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const data = payload;
    if (typeof data.inviteId !== 'string' || !data.inviteId.trim())
        return null;
    if (typeof data.channelId !== 'string' || !data.channelId.trim())
        return null;
    if (typeof data.channelName !== 'string' || !data.channelName.trim())
        return null;
    if (typeof data.fromNodeId !== 'string' || !data.fromNodeId.trim())
        return null;
    if (typeof data.fromPublicKey !== 'string' || !data.fromPublicKey.trim())
        return null;
    if (typeof data.fromUsername !== 'string' || !data.fromUsername.trim())
        return null;
    return {
        inviteId: data.inviteId,
        channelId: data.channelId,
        channelName: data.channelName,
        fromNodeId: data.fromNodeId,
        fromPublicKey: data.fromPublicKey,
        fromUsername: data.fromUsername,
    };
}
function readInviteResponsePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const data = payload;
    if (typeof data.inviteId !== 'string' || !data.inviteId.trim())
        return null;
    if (typeof data.channelId !== 'string' || !data.channelId.trim())
        return null;
    if (typeof data.accepted !== 'boolean')
        return null;
    if (typeof data.responderNodeId !== 'string' || !data.responderNodeId.trim())
        return null;
    if (typeof data.responderPublicKey !== 'string' || !data.responderPublicKey.trim())
        return null;
    if (typeof data.responderUsername !== 'string' || !data.responderUsername.trim())
        return null;
    return {
        inviteId: data.inviteId,
        channelId: data.channelId,
        accepted: data.accepted,
        responderNodeId: data.responderNodeId,
        responderPublicKey: data.responderPublicKey,
        responderUsername: data.responderUsername,
    };
}
function parsePort(rawPort, fallback) {
    if (!rawPort) {
        return fallback;
    }
    const parsed = Number.parseInt(rawPort, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return fallback;
    }
    return parsed;
}
function parsePositiveInt(rawValue, fallback) {
    if (!rawValue) {
        return fallback;
    }
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
}
function parsePeerSeeds(rawSeeds) {
    if (!rawSeeds) {
        return [];
    }
    const parsed = [];
    for (const token of rawSeeds.split(',')) {
        const value = token.trim();
        if (value.length === 0) {
            continue;
        }
        const separator = value.lastIndexOf(':');
        if (separator <= 0 || separator === value.length - 1) {
            continue;
        }
        const host = value.slice(0, separator).trim();
        const portValue = Number.parseInt(value.slice(separator + 1), 10);
        if (!host || !Number.isInteger(portValue) || portValue < 1 || portValue > 65535) {
            continue;
        }
        parsed.push({ host, port: portValue });
    }
    return parsed;
}
function isSameHost(a, b) {
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
function createBackupService() {
    if (!BACKUP_ENABLED) {
        return null;
    }
    const dbPath = (0, database_path_1.resolveDatabasePath)();
    const services = [
        new backup_service_1.FileBackupService(dbPath, BACKUP_DIR),
    ];
    if (BACKUP_HTTP_ENDPOINT) {
        services.push(new backup_service_1.HttpBackupService(dbPath, BACKUP_HTTP_ENDPOINT, BACKUP_HTTP_TOKEN));
    }
    return new backup_service_1.CompositeBackupService(services);
}
function startBackupLoop() {
    backupService = createBackupService();
    if (!backupService) {
        return;
    }
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }
    const runBackup = async () => {
        if (!backupService) {
            return;
        }
        try {
            await backupService.backup();
            p2pLogger.info('backup.success', { intervalMs: BACKUP_INTERVAL_MS });
        }
        catch (error) {
            p2pLogger.warn('backup.failed', {
                message: error instanceof Error ? error.message : String(error),
            });
        }
    };
    backupTimer = setInterval(() => {
        void runBackup();
    }, BACKUP_INTERVAL_MS);
    backupTimer.unref();
    void runBackup();
}
function stopBackupLoop() {
    if (backupTimer) {
        clearInterval(backupTimer);
        backupTimer = null;
    }
}
async function sendLocalIdentityToNode(nodeId) {
    if (!transportRef)
        return;
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        return;
    transportRef.sendToNode(nodeId, 'identity.share', {
        nodeId: transportRef.nodeId,
        publicKey: normalizePublicKey(identity.publicKey),
        username: identity.username,
        avatar: identity.avatar ?? undefined,
    });
}
async function upsertRemoteIdentityFromShare(payload) {
    await identityService.createOrUpdateIdentity({
        publicKey: normalizePublicKey(payload.publicKey),
        username: payload.username,
        avatar: payload.avatar ?? null,
        createdAt: Date.now(),
    });
    const previous = contactsByNodeId.get(payload.nodeId);
    contactsByNodeId.set(payload.nodeId, {
        nodeId: payload.nodeId,
        publicKey: normalizePublicKey(payload.publicKey),
        username: payload.username || defaultContactName(payload.nodeId),
        avatar: payload.avatar ?? initials(payload.username),
        connected: previous?.connected ?? true,
    });
    emitContactsChanged();
}
async function handleInviteReceived(payload) {
    await channelRepository.createIfMissing({
        id: payload.channelId,
        creator: payload.fromPublicKey,
        createdAt: Date.now(),
    });
    pendingInvites.set(payload.inviteId, {
        id: payload.inviteId,
        channelId: payload.channelId,
        channelName: payload.channelName,
        fromNodeId: payload.fromNodeId,
        fromPublicKey: payload.fromPublicKey,
        fromUsername: payload.fromUsername,
        createdAt: Date.now(),
    });
    emitInvitesChanged();
}
async function handleInviteResponseReceived(payload) {
    if (!payload.accepted) {
        return;
    }
    const local = await identityService.loadLocalIdentity();
    if (!local) {
        return;
    }
    const privateKey = await identityService.getLocalPrivateKey();
    try {
        const memberJoined = await eventService.publish({
            channelId: payload.channelId,
            author: normalizePublicKey(local.publicKey),
            type: 'member.join',
            payload: { member: payload.responderPublicKey },
            privateKey,
        });
        emitUIEventUpdate(memberJoined, 'local');
        gossipService?.broadcastEvent(memberJoined);
    }
    catch (error) {
        if (!(error instanceof event_service_1.DuplicateEventError)) {
            throw error;
        }
    }
}
async function handleTransportMessage(message) {
    if (message.envelope.type === 'identity.share') {
        const payload = readIdentitySharePayload(message.envelope.payload);
        if (!payload)
            return;
        await upsertRemoteIdentityFromShare(payload);
        if (message.nodeId) {
            await sendLocalIdentityToNode(message.nodeId);
        }
        return;
    }
    if (message.envelope.type === 'group.invite') {
        const payload = readInvitePayload(message.envelope.payload);
        if (!payload)
            return;
        await handleInviteReceived(payload);
        return;
    }
    if (message.envelope.type === 'group.invite.response') {
        const payload = readInviteResponsePayload(message.envelope.payload);
        if (!payload)
            return;
        await handleInviteResponseReceived(payload);
    }
}
async function startP2P() {
    if (!P2P_ENABLED || peerService || gossipService) {
        return;
    }
    const identity = await identityService.loadLocalIdentity();
    const nodeId = P2P_NODE_ID && P2P_NODE_ID.length > 0
        ? P2P_NODE_ID
        : (identity ? normalizePublicKey(identity.publicKey) : (0, node_crypto_1.randomUUID)());
    const seeds = P2P_SEEDS.filter((seed) => !(seed.port === P2P_PORT && isSameHost(seed.host, P2P_HOST)));
    const transport = new transport_1.P2PTransport({
        nodeId,
        host: P2P_HOST,
        port: P2P_PORT,
    });
    transportRef = transport;
    transport.on('warning', ({ error }) => {
        const details = error instanceof Error ? error.message : String(error);
        p2pLogger.warn('transport.warning', { details });
    });
    transport.on('peer:connected', ({ nodeId: remoteNodeId, remote }) => {
        p2pLogger.info('peer.connected', {
            remoteNodeId: remoteNodeId ?? 'unknown',
            host: remote.host,
            port: remote.port,
        });
        emitP2PStatus();
        if (remoteNodeId && gossipService) {
            void gossipService.requestSyncFromPeer(remoteNodeId);
            void sendLocalIdentityToNode(remoteNodeId);
            const current = contactsByNodeId.get(remoteNodeId);
            contactsByNodeId.set(remoteNodeId, {
                nodeId: remoteNodeId,
                publicKey: current?.publicKey ?? remoteNodeId,
                username: current?.username ?? defaultContactName(remoteNodeId),
                avatar: current?.avatar ?? initials(current?.username ?? remoteNodeId),
                connected: true,
            });
            emitContactsChanged();
        }
    });
    transport.on('peer:disconnected', ({ nodeId: remoteNodeId, remote }) => {
        p2pLogger.info('peer.disconnected', {
            remoteNodeId: remoteNodeId ?? 'unknown',
            host: remote.host,
            port: remote.port,
        });
        if (remoteNodeId) {
            const current = contactsByNodeId.get(remoteNodeId);
            if (current) {
                contactsByNodeId.set(remoteNodeId, { ...current, connected: false });
                emitContactsChanged();
            }
        }
        emitP2PStatus();
    });
    transport.on('message', (message) => {
        void handleTransportMessage(message);
    });
    peerService = new peer_service_1.PeerService(transport, {
        seeds,
        logger: {
            info: (message) => p2pLogger.info('peer.info', { message }),
            warn: (message) => p2pLogger.warn('peer.warn', { message }),
        },
    });
    gossipService = new gossip_service_1.GossipService(transport, eventService, {
        onEventIngested: async (event) => {
            if (event.type === 'channel.create') {
                await channelRepository.createIfMissing({
                    id: event.channelId,
                    creator: event.author,
                    createdAt: event.timestamp,
                });
            }
            emitUIEventUpdate(event, 'remote');
        },
        logger: {
            info: (message) => p2pLogger.info('gossip.info', { message }),
            warn: (message) => p2pLogger.warn('gossip.warn', { message }),
        },
        sync: {
            buildCursor: () => syncService.buildCursor(),
            collectMissingEvents: (cursors, maxEvents) => syncService.collectMissingEvents(cursors, maxEvents),
        },
    });
    presenceService = new presence_service_1.PresenceService(transport, {
        logger: {
            info: (message) => p2pLogger.info('presence.info', { message }),
            warn: (message) => p2pLogger.warn('presence.warn', { message }),
        },
    });
    gossipService.start();
    presenceService.start();
    try {
        await peerService.start();
        p2pLogger.info('listening', { host: P2P_HOST, port: P2P_PORT, seeds: seeds.length });
        if (!gossipMetricsTimer) {
            gossipMetricsTimer = setInterval(() => {
                if (!gossipService) {
                    return;
                }
                p2pLogger.info('metrics', { ...gossipService.snapshotMetrics() });
            }, 30000);
            gossipMetricsTimer.unref();
        }
        for (const peer of peerService.peers()) {
            if (peer.nodeId) {
                void sendLocalIdentityToNode(peer.nodeId);
            }
        }
        emitP2PStatus();
    }
    catch (error) {
        presenceService.stop();
        presenceService = null;
        gossipService.stop();
        gossipService = null;
        peerService = null;
        transportRef = null;
        emitP2PStatus();
        throw error;
    }
}
async function stopP2P() {
    if (gossipMetricsTimer) {
        clearInterval(gossipMetricsTimer);
        gossipMetricsTimer = null;
    }
    if (gossipService) {
        gossipService.stop();
        gossipService = null;
    }
    if (presenceService) {
        presenceService.stop();
        presenceService = null;
    }
    if (peerService) {
        await peerService.stop();
        peerService = null;
    }
    transportRef = null;
    for (const [nodeId, contact] of contactsByNodeId) {
        contactsByNodeId.set(nodeId, { ...contact, connected: false });
    }
    emitContactsChanged();
    emitP2PStatus();
}
// ── IPC Handlers ──────────────────────────────────────────────
electron_1.ipcMain.handle('identity:get', async () => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        return null;
    return {
        publicKey: normalizePublicKey(identity.publicKey),
        username: identity.username,
        avatar: initials(identity.username),
    };
});
electron_1.ipcMain.handle('identity:create', async (_event, username) => {
    const identity = await identityService.createLocalIdentity(username, null);
    return {
        publicKey: normalizePublicKey(identity.publicKey),
        username: identity.username,
        avatar: initials(identity.username),
    };
});
electron_1.ipcMain.handle('channel:list', async () => {
    const channels = await channelRepository.list();
    const result = [];
    for (const ch of channels) {
        const events = await eventService.listByChannel(ch.id, {
            types: ['member.join', 'message.create'],
        });
        let memberCount = 0;
        let lastMessage;
        for (const event of events) {
            if (event.type === 'member.join') {
                memberCount += 1;
                continue;
            }
            if (event.type === 'message.create') {
                try {
                    const payload = event_serializer_1.EventSerializer.decodePayload(event.payload);
                    lastMessage = payload.content;
                }
                catch {
                    // Ignore malformed payload and keep listing.
                }
            }
        }
        result.push({
            id: ch.id,
            name: ch.id, // channel id is used as name (set during creation)
            description: '',
            memberCount: memberCount || 1,
            lastMessage,
        });
    }
    return result;
});
electron_1.ipcMain.handle('channel:create', async (_event, name, description) => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        throw new Error('No identity');
    const publicKeyHex = normalizePublicKey(identity.publicKey);
    const privateKey = await identityService.getLocalPrivateKey();
    const channelId = name.toLowerCase().replace(/\s+/g, '-');
    await channelRepository.createIfMissing({
        id: channelId,
        creator: publicKeyHex,
        createdAt: Date.now(),
    });
    const channelCreated = await eventService.publish({
        channelId,
        author: publicKeyHex,
        type: 'channel.create',
        payload: { name, description: description ?? '' },
        privateKey,
    });
    emitUIEventUpdate(channelCreated, 'local');
    gossipService?.broadcastEvent(channelCreated);
    const memberJoined = await eventService.publish({
        channelId,
        author: publicKeyHex,
        type: 'member.join',
        payload: { member: publicKeyHex },
        privateKey,
    });
    emitUIEventUpdate(memberJoined, 'local');
    gossipService?.broadcastEvent(memberJoined);
    return {
        id: channelId,
        name,
        description: description ?? '',
        memberCount: 1,
        lastMessage: undefined,
    };
});
electron_1.ipcMain.handle('message:list', async (_event, channelId) => {
    const identity = await identityService.loadLocalIdentity();
    const myKey = identity ? normalizePublicKey(identity.publicKey) : null;
    const events = await eventService.listByChannel(channelId, {
        types: ['message.create', 'message.edit', 'message.delete'],
    });
    // Build derived messages from events
    const messages = new Map();
    for (const ev of events) {
        if (ev.type === 'message.create') {
            let payload;
            try {
                payload = event_serializer_1.EventSerializer.decodePayload(ev.payload);
            }
            catch {
                continue;
            }
            // Look up username for author
            const authorId = await prisma_client_1.prisma.identity.findUnique({ where: { publicKey: ev.author } });
            const authorName = authorId?.username ?? ev.author.slice(0, 8) + '…';
            messages.set(ev.id, {
                id: ev.id,
                author: authorName,
                authorKey: ev.author,
                own: ev.author === myKey,
                content: payload.content,
                time: formatTime(ev.timestamp),
                edited: false,
                deleted: false,
            });
        }
        else if (ev.type === 'message.edit') {
            let payload;
            try {
                payload = event_serializer_1.EventSerializer.decodePayload(ev.payload);
            }
            catch {
                continue;
            }
            const target = messages.get(payload.targetEventId);
            if (target) {
                messages.set(target.id, { ...target, content: payload.newContent, edited: true });
            }
        }
        else if (ev.type === 'message.delete') {
            let payload;
            try {
                payload = event_serializer_1.EventSerializer.decodePayload(ev.payload);
            }
            catch {
                continue;
            }
            const target = messages.get(payload.targetEventId);
            if (target) {
                messages.set(target.id, { ...target, content: '[mensagem apagada]', deleted: true });
            }
        }
    }
    return [...messages.values()];
});
electron_1.ipcMain.handle('message:send', async (_event, channelId, content) => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        throw new Error('No identity');
    const publicKeyHex = normalizePublicKey(identity.publicKey);
    const privateKey = await identityService.getLocalPrivateKey();
    const messageCreated = await eventService.publish({
        channelId,
        author: publicKeyHex,
        type: 'message.create',
        payload: { content },
        privateKey,
    });
    emitUIEventUpdate(messageCreated, 'local');
    gossipService?.broadcastEvent(messageCreated);
});
electron_1.ipcMain.handle('p2p:status', async () => {
    return getP2PStatus();
});
electron_1.ipcMain.handle('p2p:connect', async () => {
    try {
        await startP2P();
    }
    catch (error) {
        p2pLogger.warn('connect.failed', {
            message: error.message,
        });
    }
    return getP2PStatus();
});
electron_1.ipcMain.handle('p2p:disconnect', async () => {
    await stopP2P();
    return getP2PStatus();
});
electron_1.ipcMain.handle('contacts:list', async () => {
    return listContacts();
});
electron_1.ipcMain.handle('contacts:start-direct-chat', async (_event, nodeId) => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        throw new Error('No identity');
    const contact = contactsByNodeId.get(nodeId);
    if (!contact)
        throw new Error('Unknown contact');
    const localKey = normalizePublicKey(identity.publicKey);
    const remoteKey = normalizePublicKey(contact.publicKey);
    const sorted = [localKey, remoteKey].sort();
    const channelId = `dm-${sorted[0].slice(0, 12)}-${sorted[1].slice(0, 12)}`;
    const channelName = `DM ${identity.username} x ${contact.username}`;
    await channelRepository.createIfMissing({
        id: channelId,
        creator: localKey,
        createdAt: Date.now(),
    });
    const privateKey = await identityService.getLocalPrivateKey();
    try {
        const channelCreated = await eventService.publish({
            channelId,
            author: localKey,
            type: 'channel.create',
            payload: { name: channelName, description: 'direct' },
            privateKey,
        });
        emitUIEventUpdate(channelCreated, 'local');
        gossipService?.broadcastEvent(channelCreated);
    }
    catch (error) {
        if (!(error instanceof event_service_1.DuplicateEventError)) {
            throw error;
        }
    }
    try {
        const memberJoined = await eventService.publish({
            channelId,
            author: localKey,
            type: 'member.join',
            payload: { member: localKey },
            privateKey,
        });
        emitUIEventUpdate(memberJoined, 'local');
        gossipService?.broadcastEvent(memberJoined);
    }
    catch (error) {
        if (!(error instanceof event_service_1.DuplicateEventError)) {
            throw error;
        }
    }
    if (transportRef && nodeId) {
        const inviteId = (0, node_crypto_1.randomUUID)();
        transportRef.sendToNode(nodeId, 'group.invite', {
            inviteId,
            channelId,
            channelName,
            fromNodeId: transportRef.nodeId,
            fromPublicKey: localKey,
            fromUsername: identity.username,
        });
    }
    return {
        id: channelId,
        name: channelName,
        description: 'direct',
        memberCount: 1,
        lastMessage: undefined,
    };
});
electron_1.ipcMain.handle('channel:invite', async (_event, channelId, nodeId) => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        throw new Error('No identity');
    if (!transportRef)
        throw new Error('P2P not connected');
    const channel = await channelRepository.list();
    const target = channel.find((item) => item.id === channelId);
    const channelName = target?.id ?? channelId;
    const localKey = normalizePublicKey(identity.publicKey);
    transportRef.sendToNode(nodeId, 'group.invite', {
        inviteId: (0, node_crypto_1.randomUUID)(),
        channelId,
        channelName,
        fromNodeId: transportRef.nodeId,
        fromPublicKey: localKey,
        fromUsername: identity.username,
    });
});
electron_1.ipcMain.handle('invite:list', async () => {
    return listInvites();
});
electron_1.ipcMain.handle('invite:respond', async (_event, inviteId, accept) => {
    const invite = pendingInvites.get(inviteId);
    if (!invite)
        return;
    pendingInvites.delete(inviteId);
    emitInvitesChanged();
    const identity = await identityService.loadLocalIdentity();
    if (!identity)
        return;
    if (accept) {
        await channelRepository.createIfMissing({
            id: invite.channelId,
            creator: invite.fromPublicKey,
            createdAt: Date.now(),
        });
        const privateKey = await identityService.getLocalPrivateKey();
        try {
            const memberJoined = await eventService.publish({
                channelId: invite.channelId,
                author: normalizePublicKey(identity.publicKey),
                type: 'member.join',
                payload: { member: normalizePublicKey(identity.publicKey) },
                privateKey,
            });
            emitUIEventUpdate(memberJoined, 'local');
            gossipService?.broadcastEvent(memberJoined);
        }
        catch (error) {
            if (!(error instanceof event_service_1.DuplicateEventError)) {
                throw error;
            }
        }
    }
    if (transportRef) {
        transportRef.sendToNode(invite.fromNodeId, 'group.invite.response', {
            inviteId,
            channelId: invite.channelId,
            accepted: accept,
            responderNodeId: transportRef.nodeId,
            responderPublicKey: normalizePublicKey(identity.publicKey),
            responderUsername: identity.username,
        });
    }
});
// ── Window ────────────────────────────────────────────────────
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 960,
        height: 640,
        minWidth: 640,
        minHeight: 480,
        backgroundColor: '#101014',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: node_path_1.default.resolve(__dirname, '..', 'preload', 'preload.js'),
        },
    });
    const rendererPath = node_path_1.default.resolve(__dirname, '..', 'renderer', 'index.html');
    void mainWindow.loadFile(rendererPath);
}
electron_1.app.whenReady().then(() => {
    startBackupLoop();
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', () => {
    stopBackupLoop();
    void stopP2P();
});
