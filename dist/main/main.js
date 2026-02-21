"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const identity_repository_1 = require("../core/indentity/identity.repository");
const identity_service_1 = require("../core/indentity/identity.service");
const prisma_client_1 = require("../core/storage/prisma.client");
// ── Services ─────────────────────────────────────────────────
const identityRepo = new identity_repository_1.IdentityRepository();
const identityService = new identity_service_1.IdentityService(identityRepo);
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
// ── IPC Handlers ──────────────────────────────────────────────
electron_1.ipcMain.handle('identity:get', async () => {
    const identity = await identityService.loadLocalIdentity();
    if (!identity || typeof identity === 'string')
        return null;
    return {
        publicKey: Buffer.isBuffer(identity.publicKey)
            ? identity.publicKey.toString('hex')
            : String(identity.publicKey),
        username: identity.username,
        avatar: initials(identity.username),
    };
});
electron_1.ipcMain.handle('identity:create', async (_event, username) => {
    const identity = await identityService.createLocalIdentity(username, null);
    return {
        publicKey: Buffer.isBuffer(identity.publicKey)
            ? identity.publicKey.toString('hex')
            : String(identity.publicKey),
        username: identity.username,
        avatar: initials(identity.username),
    };
});
electron_1.ipcMain.handle('channel:list', async () => {
    const channels = await prisma_client_1.prisma.channel.findMany({ orderBy: { createdAt: 'asc' } });
    const result = [];
    for (const ch of channels) {
        // Count members via member.join events
        const memberCount = await prisma_client_1.prisma.event.count({
            where: { channelId: ch.id, type: 'member.join' },
        });
        // Get last message
        const last = await prisma_client_1.prisma.event.findFirst({
            where: { channelId: ch.id, type: 'message.create' },
            orderBy: { timestamp: 'desc' },
        });
        let lastMessage;
        if (last) {
            const payload = JSON.parse(last.payload.toString());
            lastMessage = payload.content;
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
    if (!identity || typeof identity === 'string')
        throw new Error('No identity');
    const publicKeyHex = Buffer.isBuffer(identity.publicKey)
        ? identity.publicKey.toString('hex')
        : String(identity.publicKey);
    const channelId = name.toLowerCase().replace(/\s+/g, '-');
    // Persist channel
    await prisma_client_1.prisma.channel.upsert({
        where: { id: channelId },
        update: {},
        create: { id: channelId, creator: publicKeyHex, createdAt: Date.now() },
    });
    // Emit channel.create event
    const payload = JSON.stringify({ name, description: description ?? '' });
    const eventId = `${channelId}-create-${Date.now()}`;
    await prisma_client_1.prisma.event.create({
        data: {
            id: eventId,
            channelId,
            author: publicKeyHex,
            timestamp: Date.now(),
            type: 'channel.create',
            payload: Buffer.from(payload),
            prev: JSON.stringify([]),
            signature: '',
        },
    });
    // Emit member.join for creator
    const joinEventId = `${channelId}-join-${publicKeyHex.slice(0, 8)}-${Date.now()}`;
    await prisma_client_1.prisma.event.create({
        data: {
            id: joinEventId,
            channelId,
            author: publicKeyHex,
            timestamp: Date.now() + 1,
            type: 'member.join',
            payload: Buffer.from(JSON.stringify({ member: publicKeyHex })),
            prev: JSON.stringify([eventId]),
            signature: '',
        },
    });
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
    const myKey = identity && typeof identity !== 'string'
        ? (Buffer.isBuffer(identity.publicKey)
            ? identity.publicKey.toString('hex')
            : String(identity.publicKey))
        : null;
    const events = await prisma_client_1.prisma.event.findMany({
        where: { channelId, type: { in: ['message.create', 'message.edit', 'message.delete'] } },
        orderBy: { timestamp: 'asc' },
    });
    // Build derived messages from events
    const messages = new Map();
    for (const ev of events) {
        const payload = JSON.parse(ev.payload.toString());
        if (ev.type === 'message.create') {
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
            const target = messages.get(payload.targetEventId);
            if (target) {
                messages.set(target.id, { ...target, content: payload.newContent, edited: true });
            }
        }
        else if (ev.type === 'message.delete') {
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
    if (!identity || typeof identity === 'string')
        throw new Error('No identity');
    const publicKeyHex = Buffer.isBuffer(identity.publicKey)
        ? identity.publicKey.toString('hex')
        : String(identity.publicKey);
    const eventId = `msg-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await prisma_client_1.prisma.event.create({
        data: {
            id: eventId,
            channelId,
            author: publicKeyHex,
            timestamp: Date.now(),
            type: 'message.create',
            payload: Buffer.from(JSON.stringify({ content })),
            prev: JSON.stringify([]),
            signature: '',
        },
    });
});
// ── Window ────────────────────────────────────────────────────
function createWindow() {
    const mainWindow = new electron_1.BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#07071a',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: node_path_1.default.join(__dirname, 'preload.js'),
        },
    });
    mainWindow.maximize();
    mainWindow.loadFile(node_path_1.default.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
}
electron_1.app.whenReady().then(() => {
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
