import { app, BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import 'dotenv/config';
import { IdentityService } from '../core/indentity/identity.service';
import { PeerService } from '../core/network/peer.service';
import { PresenceService } from '../core/network/presence.service';
import { P2PTransport, PeerAddress } from '../core/network/transport';
import { StructuredLogger } from '../core/observability/logger';
import { EventSerializer } from '../core/protocol/event.serializer';
import { EventService } from '../core/protocol/event.service';
import { GossipService } from '../core/replication/gossip.service';
import { SyncService } from '../core/replication/sync.service';
import {
  BackupService,
  CompositeBackupService,
  FileBackupService,
  HttpBackupService,
} from '../core/storage/backup.service';
import { resolveDatabasePath } from '../core/storage/database.path';
import { prisma } from '../core/storage/prisma.client';
import { ChannelRepository } from '../core/storage/chanel.repository';
import { PrismaChannelRepository } from '../infrastructure/persistence/prisma/prisma-channel.repository';
import { PrismaEventStore } from '../infrastructure/persistence/prisma/prisma-event.store';
import { PrismaIdentityRepository } from '../infrastructure/persistence/prisma/prisma-identity.repository';
import type {
  Event,
  UIP2PStatus,
  UIEventUpdate,
  UIProfile,
  UIChannel,
  UIMessage,
} from '../core/model';

// ── Services ─────────────────────────────────────────────────

const identityRepo = new PrismaIdentityRepository();
const identityService = new IdentityService(identityRepo);
const channelRepository: ChannelRepository = new PrismaChannelRepository();
const eventStore = new PrismaEventStore();
const eventService = new EventService(eventStore);
const syncService = new SyncService(eventService);
const p2pLogger = new StructuredLogger('p2p');
let peerService: PeerService | null = null;
let gossipService: GossipService | null = null;
let presenceService: PresenceService | null = null;
let gossipMetricsTimer: NodeJS.Timeout | null = null;
let backupService: BackupService | null = null;
let backupTimer: NodeJS.Timeout | null = null;

const P2P_ENABLED = (process.env.ZIP_P2P_ENABLED ?? 'true').toLowerCase() !== 'false';
const P2P_HOST = process.env.ZIP_P2P_HOST ?? '0.0.0.0';
const P2P_PORT = parsePort(process.env.ZIP_P2P_PORT, 7070);
const P2P_SEEDS = parsePeerSeeds(process.env.ZIP_P2P_SEEDS ?? process.env.ZIP_P2P_SEED);
const P2P_NODE_ID = process.env.ZIP_P2P_NODE_ID?.trim();
const BACKUP_ENABLED = (process.env.ZIP_BACKUP_ENABLED ?? 'false').toLowerCase() === 'true';
const BACKUP_INTERVAL_MS = parsePositiveInt(process.env.ZIP_BACKUP_INTERVAL_MS, 5 * 60_000);
const BACKUP_DIR = process.env.ZIP_BACKUP_DIR;
const BACKUP_HTTP_ENDPOINT = process.env.ZIP_BACKUP_HTTP_ENDPOINT?.trim();
const BACKUP_HTTP_TOKEN = process.env.ZIP_BACKUP_HTTP_TOKEN?.trim();

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

function normalizePublicKey(value: unknown): string {
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

function emitUIEventUpdate(event: Event, source: UIEventUpdate['source']): void {
  const payload: UIEventUpdate = {
    id: event.id,
    channelId: event.channelId,
    type: event.type,
    source,
    timestamp: event.timestamp,
  };

  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('events:changed', payload);
  }
}

function getP2PStatus(): UIP2PStatus {
  return {
    enabled: P2P_ENABLED,
    connected: peerService !== null && gossipService !== null,
    peers: peerService?.peers().length ?? 0,
    host: P2P_HOST,
    port: P2P_PORT,
  };
}

function emitP2PStatus(): void {
  const status = getP2PStatus();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('p2p:status-changed', status);
  }
}

function parsePort(rawPort: string | undefined, fallback: number): number {
  if (!rawPort) {
    return fallback;
  }
  const parsed = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return fallback;
  }
  return parsed;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  if (!rawValue) {
    return fallback;
  }
  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function parsePeerSeeds(rawSeeds: string | undefined): PeerAddress[] {
  if (!rawSeeds) {
    return [];
  }

  const parsed: PeerAddress[] = [];
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

function isSameHost(a: string, b: string): boolean {
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

function createBackupService(): BackupService | null {
  if (!BACKUP_ENABLED) {
    return null;
  }

  const dbPath = resolveDatabasePath();
  const services: BackupService[] = [
    new FileBackupService(dbPath, BACKUP_DIR),
  ];

  if (BACKUP_HTTP_ENDPOINT) {
    services.push(new HttpBackupService(dbPath, BACKUP_HTTP_ENDPOINT, BACKUP_HTTP_TOKEN));
  }

  return new CompositeBackupService(services);
}

function startBackupLoop(): void {
  backupService = createBackupService();
  if (!backupService) {
    return;
  }

  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }

  const runBackup = async (): Promise<void> => {
    if (!backupService) {
      return;
    }
    try {
      await backupService.backup();
      p2pLogger.info('backup.success', { intervalMs: BACKUP_INTERVAL_MS });
    } catch (error) {
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

function stopBackupLoop(): void {
  if (backupTimer) {
    clearInterval(backupTimer);
    backupTimer = null;
  }
}

async function startP2P(): Promise<void> {
  if (!P2P_ENABLED || peerService || gossipService) {
    return;
  }

  const identity = await identityService.loadLocalIdentity();
  const nodeId = P2P_NODE_ID && P2P_NODE_ID.length > 0
    ? P2P_NODE_ID
    : (identity ? normalizePublicKey(identity.publicKey) : randomUUID());
  const seeds = P2P_SEEDS.filter((seed) => !(seed.port === P2P_PORT && isSameHost(seed.host, P2P_HOST)));
  const transport = new P2PTransport({
    nodeId,
    host: P2P_HOST,
    port: P2P_PORT,
  });

  transport.on('warning', ({ error }: { error: unknown }) => {
    const details = error instanceof Error ? error.message : String(error);
    p2pLogger.warn('transport.warning', { details });
  });

  transport.on('peer:connected', ({ nodeId: remoteNodeId, remote }: { nodeId?: string; remote: PeerAddress }) => {
    p2pLogger.info('peer.connected', {
      remoteNodeId: remoteNodeId ?? 'unknown',
      host: remote.host,
      port: remote.port,
    });
    emitP2PStatus();
    if (remoteNodeId && gossipService) {
      void gossipService.requestSyncFromPeer(remoteNodeId);
    }
  });

  transport.on('peer:disconnected', ({ nodeId: remoteNodeId, remote }: { nodeId?: string; remote: PeerAddress }) => {
    p2pLogger.info('peer.disconnected', {
      remoteNodeId: remoteNodeId ?? 'unknown',
      host: remote.host,
      port: remote.port,
    });
    emitP2PStatus();
  });

  peerService = new PeerService(transport, {
    seeds,
    logger: {
      info: (message: string) => p2pLogger.info('peer.info', { message }),
      warn: (message: string) => p2pLogger.warn('peer.warn', { message }),
    },
  });
  gossipService = new GossipService(transport, eventService, {
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
      info: (message: string) => p2pLogger.info('gossip.info', { message }),
      warn: (message: string) => p2pLogger.warn('gossip.warn', { message }),
    },
    sync: {
      buildCursor: () => syncService.buildCursor(),
      collectMissingEvents: (cursors, maxEvents) => syncService.collectMissingEvents(cursors, maxEvents),
    },
  });
  presenceService = new PresenceService(transport, {
    logger: {
      info: (message: string) => p2pLogger.info('presence.info', { message }),
      warn: (message: string) => p2pLogger.warn('presence.warn', { message }),
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
      }, 30_000);
      gossipMetricsTimer.unref();
    }
    emitP2PStatus();
  } catch (error) {
    presenceService.stop();
    presenceService = null;
    gossipService.stop();
    gossipService = null;
    peerService = null;
    emitP2PStatus();
    throw error;
  }
}

async function stopP2P(): Promise<void> {
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

  emitP2PStatus();
}

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('identity:get', async (): Promise<UIProfile | null> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) return null;
  return {
    publicKey: normalizePublicKey(identity.publicKey),
    username: identity.username,
    avatar: initials(identity.username),
  };
});

ipcMain.handle('identity:create', async (_event, username: string): Promise<UIProfile> => {
  const identity = await identityService.createLocalIdentity(username, null);

  return {
    publicKey: normalizePublicKey(identity.publicKey),
    username: identity.username,
    avatar: initials(identity.username),
  };
});

ipcMain.handle('channel:list', async (): Promise<UIChannel[]> => {
  const channels = await channelRepository.list();
  const result: UIChannel[] = [];
  for (const ch of channels) {
    const events = await eventService.listByChannel(ch.id, {
      types: ['member.join', 'message.create'],
    });
    let memberCount = 0;
    let lastMessage: string | undefined;
    for (const event of events) {
      if (event.type === 'member.join') {
        memberCount += 1;
        continue;
      }
      if (event.type === 'message.create') {
        try {
          const payload = EventSerializer.decodePayload<{ content: string }>(event.payload);
          lastMessage = payload.content;
        } catch {
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

ipcMain.handle('channel:create', async (_event, name: string, description?: string): Promise<UIChannel> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) throw new Error('No identity');

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

ipcMain.handle('message:list', async (_event, channelId: string): Promise<UIMessage[]> => {
  const identity = await identityService.loadLocalIdentity();
  const myKey = identity ? normalizePublicKey(identity.publicKey) : null;

  const events = await eventService.listByChannel(channelId, {
    types: ['message.create', 'message.edit', 'message.delete'],
  });

  // Build derived messages from events
  const messages = new Map<string, UIMessage>();
  for (const ev of events) {
    if (ev.type === 'message.create') {
      let payload: { content: string };
      try {
        payload = EventSerializer.decodePayload<{ content: string }>(ev.payload);
      } catch {
        continue;
      }
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
      let payload: { targetEventId: string; newContent: string };
      try {
        payload = EventSerializer.decodePayload<{ targetEventId: string; newContent: string }>(ev.payload);
      } catch {
        continue;
      }
      const target = messages.get(payload.targetEventId as string);
      if (target) {
        messages.set(target.id, { ...target, content: payload.newContent as string, edited: true });
      }
    } else if (ev.type === 'message.delete') {
      let payload: { targetEventId: string };
      try {
        payload = EventSerializer.decodePayload<{ targetEventId: string }>(ev.payload);
      } catch {
        continue;
      }
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
  if (!identity) throw new Error('No identity');

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

ipcMain.handle('p2p:status', async (): Promise<UIP2PStatus> => {
  return getP2PStatus();
});

ipcMain.handle('p2p:connect', async (): Promise<UIP2PStatus> => {
  try {
    await startP2P();
  } catch (error) {
    p2pLogger.warn('connect.failed', {
      message: (error as Error).message,
    });
  }
  return getP2PStatus();
});

ipcMain.handle('p2p:disconnect', async (): Promise<UIP2PStatus> => {
  await stopP2P();
  return getP2PStatus();
});

// ── Window ────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 640,
    minHeight: 480,
    backgroundColor: '#101014',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const placeholderHtml = [
    '<!doctype html>',
    '<html lang="pt-BR">',
    '<head><meta charset="utf-8"><title>Zip</title></head>',
    '<body style="margin:0;display:grid;place-items:center;height:100vh;font-family:Segoe UI,Arial,sans-serif;background:#101014;color:#e5e7eb;">',
    '<main style="text-align:center;max-width:540px;padding:24px;">',
    '<h1 style="margin:0 0 12px;font-size:28px;">Frontend removido</h1>',
    '<p style="margin:0;color:#9ca3af;line-height:1.5;">A interface anterior foi apagada para iniciar um novo design.</p>',
    '</main>',
    '</body>',
    '</html>',
  ].join('');

  void mainWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(placeholderHtml)}`);
}

app.whenReady().then(() => {
  startBackupLoop();
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

app.on('before-quit', () => {
  stopBackupLoop();
  void stopP2P();
});
