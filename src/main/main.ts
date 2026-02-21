import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { IdentityRepository } from '../core/indentity/identity.repository';
import { IdentityService } from '../core/indentity/identity.service';
import { prisma } from '../core/storage/prisma.client';
import type { UIProfile, UIChannel, UIMessage } from '../core/model';

// ── Services ─────────────────────────────────────────────────

const identityRepo = new IdentityRepository();
const identityService = new IdentityService(identityRepo);

// ── IPC Helpers ───────────────────────────────────────────────

function initials(username: string): string {
  return username
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('identity:get', async (): Promise<UIProfile | null> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity || typeof identity === 'string') return null;
  return {
    publicKey: Buffer.isBuffer(identity.publicKey)
      ? (identity.publicKey as Buffer).toString('hex')
      : String(identity.publicKey),
    username: identity.username,
    avatar: initials(identity.username),
  };
});

ipcMain.handle('identity:create', async (_event, username: string): Promise<UIProfile> => {
  const identity = await identityService.createLocalIdentity(username, null);
  return {
    publicKey: Buffer.isBuffer(identity.publicKey)
      ? (identity.publicKey as Buffer).toString('hex')
      : String(identity.publicKey),
    username: identity.username,
    avatar: initials(identity.username),
  };
});

ipcMain.handle('channel:list', async (): Promise<UIChannel[]> => {
  const channels = await prisma.channel.findMany({ orderBy: { createdAt: 'asc' } });
  const result: UIChannel[] = [];
  for (const ch of channels) {
    // Count members via member.join events
    const memberCount = await prisma.event.count({
      where: { channelId: ch.id, type: 'member.join' },
    });
    // Get last message
    const last = await prisma.event.findFirst({
      where: { channelId: ch.id, type: 'message.create' },
      orderBy: { timestamp: 'desc' },
    });
    let lastMessage: string | undefined;
    if (last) {
      const payload = JSON.parse(last.payload.toString());
      lastMessage = payload.content as string;
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

ipcMain.handle('channel:create', async (_event, name: string, description?: string): Promise<UIChannel> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity || typeof identity === 'string') throw new Error('No identity');

  const publicKeyHex = Buffer.isBuffer(identity.publicKey)
    ? (identity.publicKey as Buffer).toString('hex')
    : String(identity.publicKey);

  const channelId = name.toLowerCase().replace(/\s+/g, '-');

  // Persist channel
  await prisma.channel.upsert({
    where: { id: channelId },
    update: {},
    create: { id: channelId, creator: publicKeyHex, createdAt: Date.now() },
  });

  // Emit channel.create event
  const payload = JSON.stringify({ name, description: description ?? '' });
  const eventId = `${channelId}-create-${Date.now()}`;
  await prisma.event.create({
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
  await prisma.event.create({
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

ipcMain.handle('message:list', async (_event, channelId: string): Promise<UIMessage[]> => {
  const identity = await identityService.loadLocalIdentity();
  const myKey = identity && typeof identity !== 'string'
    ? (Buffer.isBuffer(identity.publicKey)
      ? (identity.publicKey as Buffer).toString('hex')
      : String(identity.publicKey))
    : null;

  const events = await prisma.event.findMany({
    where: { channelId, type: { in: ['message.create', 'message.edit', 'message.delete'] } },
    orderBy: { timestamp: 'asc' },
  });

  // Build derived messages from events
  const messages = new Map<string, UIMessage>();
  for (const ev of events) {
    const payload = JSON.parse(ev.payload.toString());
    if (ev.type === 'message.create') {
      // Look up username for author
      const authorId = await prisma.identity.findUnique({ where: { publicKey: ev.author } });
      const authorName = authorId?.username ?? ev.author.slice(0, 8) + '…';
      messages.set(ev.id, {
        id: ev.id,
        author: authorName,
        authorKey: ev.author,
        own: ev.author === myKey,
        content: payload.content as string,
        time: formatTime(ev.timestamp),
        edited: false,
        deleted: false,
      });
    } else if (ev.type === 'message.edit') {
      const target = messages.get(payload.targetEventId as string);
      if (target) {
        messages.set(target.id, { ...target, content: payload.newContent as string, edited: true });
      }
    } else if (ev.type === 'message.delete') {
      const target = messages.get(payload.targetEventId as string);
      if (target) {
        messages.set(target.id, { ...target, content: '[mensagem apagada]', deleted: true });
      }
    }
  }

  return [...messages.values()];
});

ipcMain.handle('message:send', async (_event, channelId: string, content: string): Promise<void> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity || typeof identity === 'string') throw new Error('No identity');

  const publicKeyHex = Buffer.isBuffer(identity.publicKey)
    ? (identity.publicKey as Buffer).toString('hex')
    : String(identity.publicKey);

  const eventId = `msg-${channelId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await prisma.event.create({
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

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#07071a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
