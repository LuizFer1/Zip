import { app, BrowserWindow, ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import 'dotenv/config';
import { IdentityService } from '../core/indentity/identity.service';
import { PeerService } from '../core/network/peer.service';
import { PresenceService } from '../core/network/presence.service';
import { P2PTransport, PeerAddress } from '../core/network/transport';
import { StructuredLogger } from '../core/observability/logger';
import { EventSerializer } from '../core/protocol/event.serializer';
import { DuplicateEventError, EventService } from '../core/protocol/event.service';
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
  UIContact,
  UIGroupMember,
  UIInvite,
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
let transportRef: P2PTransport | null = null;
let gossipMetricsTimer: NodeJS.Timeout | null = null;
let backupService: BackupService | null = null;
let backupTimer: NodeJS.Timeout | null = null;
const contactsByNodeId = new Map<string, UIContact>();
const pendingInvites = new Map<string, UIInvite>();

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
const DIRECT_CHANNEL_PREFIX = 'dm-';
const CHAT_ROLES = ['admin', 'suporte', 'membro'] as const;

type UIChannelType = 'group' | 'text' | 'voice_video' | 'direct';
type ChatRole = typeof CHAT_ROLES[number];

interface ChannelCreateMeta {
  name: string;
  description: string;
  channelType: UIChannelType;
  parentGroupId?: string;
  allowedRoles?: ChatRole[];
  participantsNodeIds?: [string, string];
}

interface ChannelCreateRequestOptions {
  channelType?: 'group' | 'text' | 'voice_video';
  parentGroupId?: string;
  allowedRoles?: ChatRole[];
}

interface DirectChannelOpenPayload {
  channelId: string;
  fromNodeId: string;
  fromPublicKey: string;
  fromUsername: string;
  fromAvatar?: string;
  participantsNodeIds: [string, string];
  bootstrapEvents: string[];
}

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

function listContacts(): UIContact[] {
  return [...contactsByNodeId.values()].sort((a, b) => a.username.localeCompare(b.username));
}

function emitContactsChanged(): void {
  const payload = listContacts();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('contacts:changed', payload);
  }
}

function listInvites(): UIInvite[] {
  return [...pendingInvites.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function emitInvitesChanged(): void {
  const payload = listInvites();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('invites:changed', payload);
  }
}

function defaultContactName(nodeId: string): string {
  return `Peer ${nodeId.slice(0, 8)}`;
}

function readIdentitySharePayload(payload: unknown): {
  nodeId: string;
  publicKey: string;
  username: string;
  avatar?: string;
} | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.nodeId !== 'string' || data.nodeId.trim().length === 0) return null;
  if (typeof data.publicKey !== 'string' || data.publicKey.trim().length === 0) return null;
  if (typeof data.username !== 'string' || data.username.trim().length === 0) return null;
  if (data.avatar !== undefined && typeof data.avatar !== 'string') return null;

  return {
    nodeId: data.nodeId,
    publicKey: data.publicKey,
    username: data.username,
    avatar: typeof data.avatar === 'string' ? data.avatar : undefined,
  };
}

function readInvitePayload(payload: unknown): {
  inviteId: string;
  channelId: string;
  channelName: string;
  fromNodeId: string;
  fromPublicKey: string;
  fromUsername: string;
} | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.inviteId !== 'string' || !data.inviteId.trim()) return null;
  if (typeof data.channelId !== 'string' || !data.channelId.trim()) return null;
  if (typeof data.channelName !== 'string' || !data.channelName.trim()) return null;
  if (typeof data.fromNodeId !== 'string' || !data.fromNodeId.trim()) return null;
  if (typeof data.fromPublicKey !== 'string' || !data.fromPublicKey.trim()) return null;
  if (typeof data.fromUsername !== 'string' || !data.fromUsername.trim()) return null;

  return {
    inviteId: data.inviteId,
    channelId: data.channelId,
    channelName: data.channelName,
    fromNodeId: data.fromNodeId,
    fromPublicKey: data.fromPublicKey,
    fromUsername: data.fromUsername,
  };
}

function readInviteResponsePayload(payload: unknown): {
  inviteId: string;
  channelId: string;
  accepted: boolean;
  responderNodeId: string;
  responderPublicKey: string;
  responderUsername: string;
} | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.inviteId !== 'string' || !data.inviteId.trim()) return null;
  if (typeof data.channelId !== 'string' || !data.channelId.trim()) return null;
  if (typeof data.accepted !== 'boolean') return null;
  if (typeof data.responderNodeId !== 'string' || !data.responderNodeId.trim()) return null;
  if (typeof data.responderPublicKey !== 'string' || !data.responderPublicKey.trim()) return null;
  if (typeof data.responderUsername !== 'string' || !data.responderUsername.trim()) return null;

  return {
    inviteId: data.inviteId,
    channelId: data.channelId,
    accepted: data.accepted,
    responderNodeId: data.responderNodeId,
    responderPublicKey: data.responderPublicKey,
    responderUsername: data.responderUsername,
  };
}

function readDirectChatOpenPayload(payload: unknown): DirectChannelOpenPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  if (typeof data.channelId !== 'string' || !data.channelId.trim()) return null;
  if (typeof data.fromNodeId !== 'string' || !data.fromNodeId.trim()) return null;
  if (typeof data.fromPublicKey !== 'string' || !data.fromPublicKey.trim()) return null;
  if (typeof data.fromUsername !== 'string' || !data.fromUsername.trim()) return null;
  if (data.fromAvatar !== undefined && typeof data.fromAvatar !== 'string') return null;
  if (!Array.isArray(data.participantsNodeIds) || data.participantsNodeIds.length !== 2) return null;
  if (!Array.isArray(data.bootstrapEvents)) return null;

  const [left, right] = data.participantsNodeIds;
  if (typeof left !== 'string' || !left.trim() || typeof right !== 'string' || !right.trim()) return null;
  if (!data.bootstrapEvents.every((entry) => typeof entry === 'string')) return null;

  return {
    channelId: data.channelId,
    fromNodeId: data.fromNodeId,
    fromPublicKey: data.fromPublicKey,
    fromUsername: data.fromUsername,
    fromAvatar: typeof data.fromAvatar === 'string' ? data.fromAvatar : undefined,
    participantsNodeIds: [left, right],
    bootstrapEvents: data.bootstrapEvents as string[],
  };
}

function slugify(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return normalized.length > 0 ? normalized : randomUUID().slice(0, 8);
}

function buildGroupChannelId(name: string, parentGroupId?: string): string {
  const base = slugify(name);
  return parentGroupId ? `${parentGroupId}::${base}` : base;
}

function buildDirectChannelId(localNodeId: string, remoteNodeId: string): string {
  const [a, b] = [localNodeId.trim(), remoteNodeId.trim()].sort();
  return `${DIRECT_CHANNEL_PREFIX}${a.slice(0, 16)}-${b.slice(0, 16)}`;
}

function parseChannelCreateMeta(payload: Uint8Array, channelId: string): ChannelCreateMeta {
  let decoded: Record<string, unknown> = {};
  try {
    decoded = EventSerializer.decodePayload<Record<string, unknown>>(payload);
  } catch {
    // Keep default values if event payload is malformed.
  }

  const name = typeof decoded.name === 'string' && decoded.name.trim()
    ? decoded.name.trim()
    : channelId;
  const description = typeof decoded.description === 'string' ? decoded.description : '';

  let channelType: UIChannelType = 'group';
  if (description === 'direct') {
    channelType = 'direct';
  }
  if (
    decoded.channelType === 'group'
    || decoded.channelType === 'text'
    || decoded.channelType === 'voice_video'
    || decoded.channelType === 'direct'
  ) {
    channelType = decoded.channelType;
  }

  const parentGroupId = typeof decoded.parentGroupId === 'string' && decoded.parentGroupId.trim()
    ? decoded.parentGroupId.trim()
    : undefined;
  const allowedRoles = Array.isArray(decoded.allowedRoles)
    ? decoded.allowedRoles.filter((role): role is ChatRole => (
      typeof role === 'string' && (CHAT_ROLES as readonly string[]).includes(role)
    ))
    : undefined;

  let participantsNodeIds: [string, string] | undefined;
  if (Array.isArray(decoded.participantsNodeIds) && decoded.participantsNodeIds.length === 2) {
    const [left, right] = decoded.participantsNodeIds;
    if (
      typeof left === 'string'
      && typeof right === 'string'
      && left.trim().length > 0
      && right.trim().length > 0
    ) {
      participantsNodeIds = [left, right];
    }
  }

  return {
    name,
    description,
    channelType,
    parentGroupId,
    allowedRoles,
    participantsNodeIds,
  };
}

function directPeerNodeId(meta: ChannelCreateMeta, localNodeId: string): string | null {
  if (meta.channelType !== 'direct' || !meta.participantsNodeIds) {
    return null;
  }
  if (meta.participantsNodeIds[0] === localNodeId) {
    return meta.participantsNodeIds[1];
  }
  if (meta.participantsNodeIds[1] === localNodeId) {
    return meta.participantsNodeIds[0];
  }
  return null;
}

async function loadChannelMeta(channelId: string): Promise<{ meta: ChannelCreateMeta; createdAt: number } | null> {
  const events = await eventService.listByChannel(channelId, { types: ['channel.create'] });
  const created = events.find((event) => event.type === 'channel.create');
  if (!created) {
    return null;
  }
  return {
    meta: parseChannelCreateMeta(created.payload, channelId),
    createdAt: created.timestamp,
  };
}

async function canAccessChannel(channelId: string, localPublicKey: string, localNodeId: string): Promise<boolean> {
  const metaData = await loadChannelMeta(channelId);
  if (!metaData) {
    return false;
  }

  if (metaData.meta.channelType === 'direct') {
    const participants: string[] = metaData.meta.participantsNodeIds
      ? [...metaData.meta.participantsNodeIds]
      : [];
    return participants.includes(localNodeId);
  }
  const groupId = metaData.meta.parentGroupId ?? channelId;
  const rolesByMember = await resolveGroupRoles(groupId);
  const myRoles = rolesByMember.get(localPublicKey);
  if (!myRoles || myRoles.size === 0) {
    return false;
  }

  const allowedRoles = metaData.meta.allowedRoles ?? [];
  if (
    (metaData.meta.channelType === 'text' || metaData.meta.channelType === 'voice_video')
    && allowedRoles.length > 0
  ) {
    return allowedRoles.some((role) => myRoles.has(role));
  }

  return true;
}

async function resolveChannelMemberPublicKeys(channelId: string): Promise<Set<string>> {
  const membershipEvents = await eventService.listByChannel(channelId, {
    types: ['member.join', 'member.leave'],
  });

  const members = new Set<string>();
  for (const event of membershipEvents) {
    try {
      const payload = EventSerializer.decodePayload<{ member?: string }>(event.payload);
      const member = typeof payload.member === 'string' ? normalizePublicKey(payload.member) : '';
      if (!member) {
        continue;
      }
      if (event.type === 'member.join') {
        members.add(member);
      } else if (event.type === 'member.leave') {
        members.delete(member);
      }
    } catch {
      // Ignore malformed payload and continue deriving state.
    }
  }

  return members;
}

async function resolveGroupMembers(groupId: string): Promise<UIGroupMember[]> {
  const members = await resolveChannelMemberPublicKeys(groupId);
  const localIdentity = await identityService.loadLocalIdentity();
  if (localIdentity) {
    members.add(normalizePublicKey(localIdentity.publicKey));
  }

  if (members.size === 0) {
    return [];
  }

  const publicKeys = [...members.values()];
  const remoteIdentities = await prisma.identity.findMany({
    where: { publicKey: { in: publicKeys } },
  });
  const rolesByMember = await resolveGroupRoles(groupId);
  const identityByKey = new Map(remoteIdentities.map((row) => [normalizePublicKey(row.publicKey), row]));
  const localPublicKey = localIdentity ? normalizePublicKey(localIdentity.publicKey) : '';

  const result: UIGroupMember[] = publicKeys.map((publicKey) => {
    if (localIdentity && publicKey === localPublicKey) {
      const nodeId = transportRef?.nodeId ?? localPublicKey;
      return {
        publicKey,
        username: localIdentity.username,
        avatar: localIdentity.avatar ?? initials(localIdentity.username),
        nodeId,
        connected: true,
        roles: [...(rolesByMember.get(publicKey) ?? new Set<ChatRole>())],
      };
    }

    const remote = identityByKey.get(publicKey);
    const nodeId = remote?.nodeId ?? undefined;
    const connected = nodeId ? (contactsByNodeId.get(nodeId)?.connected ?? false) : false;
    return {
      publicKey,
      username: remote?.username?.trim() || `${publicKey.slice(0, 8)}...`,
      avatar: remote?.avatar ?? undefined,
      nodeId,
      connected,
      roles: [...(rolesByMember.get(publicKey) ?? new Set<ChatRole>())],
    };
  });

  return result.sort((a, b) => a.username.localeCompare(b.username));
}

async function resolveGroupRoles(groupId: string): Promise<Map<string, Set<ChatRole>>> {
  const members = await resolveChannelMemberPublicKeys(groupId);
  const rolesByMember = new Map<string, Set<ChatRole>>();

  for (const member of members) {
    rolesByMember.set(member, new Set<ChatRole>(['membro']));
  }

  const roleEvents = await eventService.listByChannel(groupId, {
    types: ['role.grant', 'role.revoke'],
  });

  for (const event of roleEvents) {
    try {
      const payload = EventSerializer.decodePayload<{ member?: string; role?: string }>(event.payload);
      const member = typeof payload.member === 'string' ? normalizePublicKey(payload.member) : '';
      const role = typeof payload.role === 'string' ? payload.role : '';
      if (!member || !(CHAT_ROLES as readonly string[]).includes(role)) {
        continue;
      }
      const roleKey = role as ChatRole;
      const set = rolesByMember.get(member) ?? new Set<ChatRole>(['membro']);
      if (event.type === 'role.grant') {
        set.add(roleKey);
      } else {
        set.delete(roleKey);
      }
      if (set.size === 0) {
        set.add('membro');
      }
      rolesByMember.set(member, set);
    } catch {
      // Ignore malformed payload and continue deriving roles.
    }
  }

  return rolesByMember;
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

async function sendLocalIdentityToNode(nodeId: string): Promise<void> {
  if (!transportRef) return;

  const identity = await identityService.loadLocalIdentity();
  if (!identity) return;

  transportRef.sendToNode(nodeId, 'identity.share', {
    nodeId: transportRef.nodeId,
    publicKey: normalizePublicKey(identity.publicKey),
    username: identity.username,
    avatar: identity.avatar ?? undefined,
  });
}

async function upsertRemoteIdentityFromShare(payload: {
  nodeId: string;
  publicKey: string;
  username: string;
  avatar?: string;
}): Promise<void> {
  await identityService.createOrUpdateIdentity({
    publicKey: normalizePublicKey(payload.publicKey),
    username: payload.username,
    avatar: payload.avatar ?? null,
    nodeId: payload.nodeId,
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

async function handleInviteReceived(payload: {
  inviteId: string;
  channelId: string;
  channelName: string;
  fromNodeId: string;
  fromPublicKey: string;
  fromUsername: string;
}): Promise<void> {
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

async function handleInviteResponseReceived(payload: {
  inviteId: string;
  channelId: string;
  accepted: boolean;
  responderNodeId: string;
  responderPublicKey: string;
  responderUsername: string;
}): Promise<void> {
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
  } catch (error) {
    if (!(error instanceof DuplicateEventError)) {
      throw error;
    }
  }
}

async function handleDirectChatOpenReceived(payload: DirectChannelOpenPayload): Promise<void> {
  const localIdentity = await identityService.loadLocalIdentity();
  if (!localIdentity) {
    return;
  }

  await upsertRemoteIdentityFromShare({
    nodeId: payload.fromNodeId,
    publicKey: payload.fromPublicKey,
    username: payload.fromUsername,
    avatar: payload.fromAvatar,
  });

  await channelRepository.createIfMissing({
    id: payload.channelId,
    creator: normalizePublicKey(payload.fromPublicKey),
    createdAt: Date.now(),
  });

  for (const serializedEvent of payload.bootstrapEvents) {
    try {
      const event = await eventService.deserializeAndIngest(serializedEvent);
      emitUIEventUpdate(event, 'remote');
    } catch (error) {
      if (!(error instanceof DuplicateEventError)) {
        throw error;
      }
    }
  }
}

async function handleTransportMessage(message: { envelope: { type: string; payload: unknown }; nodeId?: string }): Promise<void> {
  if (message.envelope.type === 'identity.share') {
    const payload = readIdentitySharePayload(message.envelope.payload);
    if (!payload) return;
    await upsertRemoteIdentityFromShare(payload);
    if (message.nodeId) {
      await sendLocalIdentityToNode(message.nodeId);
    }
    return;
  }

  if (message.envelope.type === 'group.invite') {
    const payload = readInvitePayload(message.envelope.payload);
    if (!payload) return;
    await handleInviteReceived(payload);
    return;
  }

  if (message.envelope.type === 'group.invite.response') {
    const payload = readInviteResponsePayload(message.envelope.payload);
    if (!payload) return;
    await handleInviteResponseReceived(payload);
    return;
  }

  if (message.envelope.type === 'direct-chat.open') {
    const payload = readDirectChatOpenPayload(message.envelope.payload);
    if (!payload) return;
    await handleDirectChatOpenReceived(payload);
  }
}

async function startP2P(): Promise<void> {
  if (!P2P_ENABLED || peerService || gossipService) {
    return;
  }

  const identity = await identityService.loadLocalIdentity();
  const nodeId = identity
    ? normalizePublicKey(identity.publicKey)
    : (P2P_NODE_ID && P2P_NODE_ID.length > 0 ? P2P_NODE_ID : randomUUID());
  const seeds = P2P_SEEDS.filter((seed) => !(seed.port === P2P_PORT && isSameHost(seed.host, P2P_HOST)));
  const transport = new P2PTransport({
    nodeId,
    host: P2P_HOST,
    port: P2P_PORT,
  });
  transportRef = transport;

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

  transport.on('peer:disconnected', ({ nodeId: remoteNodeId, remote }: { nodeId?: string; remote: PeerAddress }) => {
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

  transport.on('message', (message: { envelope: { type: string; payload: unknown }; nodeId?: string }) => {
    void handleTransportMessage(message);
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
    for (const peer of peerService.peers()) {
      if (peer.nodeId) {
        void sendLocalIdentityToNode(peer.nodeId);
      }
    }
    emitP2PStatus();
  } catch (error) {
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

  transportRef = null;
  for (const [nodeId, contact] of contactsByNodeId) {
    contactsByNodeId.set(nodeId, { ...contact, connected: false });
  }
  emitContactsChanged();

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
  const existing = await identityService.loadLocalIdentity();
  const identity = existing ?? await identityService.createLocalIdentity(username, null);

  return {
    publicKey: normalizePublicKey(identity.publicKey),
    username: identity.username,
    avatar: initials(identity.username),
  };
});

ipcMain.handle('channel:list', async (): Promise<UIChannel[]> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) {
    return [];
  }

  const localPublicKey = normalizePublicKey(identity.publicKey);
  const localNodeId = transportRef?.nodeId ?? localPublicKey;
  const channelIds = await eventService.listChannelIds();
  const result: UIChannel[] = [];

  for (const channelId of channelIds) {
    const metaData = await loadChannelMeta(channelId);
    if (!metaData) {
      continue;
    }

    const accessible = await canAccessChannel(channelId, localPublicKey, localNodeId);
    if (!accessible) {
      continue;
    }

    const events = await eventService.listByChannel(channelId, {
      types: ['message.create'],
    });
    const memberSourceChannelId = metaData.meta.parentGroupId ?? channelId;
    const members = await resolveChannelMemberPublicKeys(memberSourceChannelId);
    let lastMessage: string | undefined;
    for (const event of events) {
      if (event.type === 'message.create') {
        try {
          const payload = EventSerializer.decodePayload<{ content: string }>(event.payload);
          lastMessage = payload.content;
        } catch {
          // Ignore malformed payload and keep listing.
        }
      }
    }

    const peerNodeId = directPeerNodeId(metaData.meta, localNodeId);
    const displayName = metaData.meta.channelType === 'direct'
      ? (peerNodeId ? (contactsByNodeId.get(peerNodeId)?.username ?? metaData.meta.name) : metaData.meta.name)
      : metaData.meta.name;

    result.push({
      id: channelId,
      name: displayName,
      description: metaData.meta.description,
      channelType: metaData.meta.channelType,
      parentGroupId: metaData.meta.parentGroupId,
      memberCount: metaData.meta.channelType === 'direct' ? 2 : Math.max(1, members.size),
      lastMessage,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
});

ipcMain.handle(
  'channel:create',
  async (
    _event,
    name: string,
    description?: string,
    options?: ChannelCreateRequestOptions,
  ): Promise<UIChannel> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) throw new Error('No identity');

  const publicKeyHex = normalizePublicKey(identity.publicKey);
  const privateKey = await identityService.getLocalPrivateKey();
  const channelType: UIChannelType = options?.channelType ?? 'group';
  const parentGroupId = options?.parentGroupId?.trim() || undefined;
  const channelId = buildGroupChannelId(name, parentGroupId);
  const metaPayload: Record<string, unknown> = {
    name,
    description: description ?? '',
    channelType,
  };
  if (parentGroupId) {
    metaPayload.parentGroupId = parentGroupId;
  }
  if (options?.allowedRoles && options.allowedRoles.length > 0) {
    metaPayload.allowedRoles = options.allowedRoles;
  }

  const createdAt = Date.now();
  await channelRepository.createIfMissing({
    id: channelId,
    creator: publicKeyHex,
    createdAt,
  });

  const channelCreated = await eventService.publish({
    channelId,
    author: publicKeyHex,
    type: 'channel.create',
    payload: metaPayload,
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

  if (channelType === 'group') {
    const roleGranted = await eventService.publish({
      channelId,
      author: publicKeyHex,
      type: 'role.grant',
      payload: { member: publicKeyHex, role: 'admin' },
      privateKey,
    });
    emitUIEventUpdate(roleGranted, 'local');
    gossipService?.broadcastEvent(roleGranted);
  }

  return {
    id: channelId,
    name,
    description: description ?? '',
    channelType,
    parentGroupId,
    memberCount: 1,
    lastMessage: undefined,
  };
});

ipcMain.handle('message:list', async (_event, channelId: string): Promise<UIMessage[]> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) {
    return [];
  }
  const myKey = identity ? normalizePublicKey(identity.publicKey) : null;
  const localNodeId = transportRef?.nodeId ?? myKey ?? '';
  const allowed = await canAccessChannel(channelId, myKey ?? '', localNodeId);
  if (!allowed) {
    return [];
  }

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
  const localNodeId = transportRef?.nodeId ?? publicKeyHex;
  const allowed = await canAccessChannel(channelId, publicKeyHex, localNodeId);
  if (!allowed) {
    throw new Error('Channel is not accessible for this identity');
  }
  const privateKey = await identityService.getLocalPrivateKey();

  const messageCreated = await eventService.publish({
    channelId,
    author: publicKeyHex,
    type: 'message.create',
    payload: { content },
    privateKey,
  });
  emitUIEventUpdate(messageCreated, 'local');

  const metaData = await loadChannelMeta(channelId);
  if (metaData?.meta.channelType === 'direct') {
    const peerNodeId = directPeerNodeId(metaData.meta, localNodeId);
    if (!peerNodeId) {
      throw new Error('Direct channel peer not found');
    }
    const sent = gossipService?.sendEventToNode(peerNodeId, messageCreated) ?? false;
    if (!sent) {
      throw new Error('Direct peer is offline');
    }
    return;
  }

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

ipcMain.handle('contacts:list', async (): Promise<UIContact[]> => {
  return listContacts();
});

ipcMain.handle('contacts:start-direct-chat', async (_event, nodeId: string): Promise<UIChannel> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) throw new Error('No identity');

  const contact = contactsByNodeId.get(nodeId);
  if (!contact) throw new Error('Unknown contact');

  const localKey = normalizePublicKey(identity.publicKey);
  const localNodeId = transportRef?.nodeId ?? localKey;
  const channelId = buildDirectChannelId(localNodeId, nodeId);
  const channelName = contact.username;
  const participantsNodeIds = [localNodeId, nodeId].sort() as [string, string];

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
      payload: {
        name: channelName,
        description: 'direct',
        channelType: 'direct',
        participantsNodeIds,
      },
      privateKey,
    });
    emitUIEventUpdate(channelCreated, 'local');
  } catch (error) {
    if (!(error instanceof DuplicateEventError)) {
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
  } catch (error) {
    if (!(error instanceof DuplicateEventError)) {
      throw error;
    }
  }

  if (transportRef && nodeId) {
    const bootstrapEvents = await eventService.listByChannel(channelId);
    const serializedEvents = bootstrapEvents.map((event) => EventSerializer.serialize(event));
    transportRef.sendToNode(nodeId, 'direct-chat.open', {
      channelId,
      fromNodeId: transportRef.nodeId,
      fromPublicKey: localKey,
      fromUsername: identity.username,
      fromAvatar: identity.avatar ?? undefined,
      participantsNodeIds,
      bootstrapEvents: serializedEvents,
    });
  }

  return {
    id: channelId,
    name: channelName,
    description: 'direct',
    channelType: 'direct',
    memberCount: 2,
    lastMessage: undefined,
  };
});

ipcMain.handle('channel:invite', async (_event, channelId: string, nodeId: string): Promise<void> => {
  const identity = await identityService.loadLocalIdentity();
  if (!identity) throw new Error('No identity');
  if (!transportRef) throw new Error('P2P not connected');

  const channelMeta = await loadChannelMeta(channelId);
  const channelName = channelMeta?.meta.name ?? channelId;
  const localKey = normalizePublicKey(identity.publicKey);

  transportRef.sendToNode(nodeId, 'group.invite', {
    inviteId: randomUUID(),
    channelId,
    channelName,
    fromNodeId: transportRef.nodeId,
    fromPublicKey: localKey,
    fromUsername: identity.username,
  });
});

ipcMain.handle('group:members', async (_event, groupId: string): Promise<UIGroupMember[]> => {
  const normalizedGroupId = String(groupId ?? '').trim();
  if (!normalizedGroupId) {
    return [];
  }
  const channelMeta = await loadChannelMeta(normalizedGroupId);
  if (!channelMeta || channelMeta.meta.channelType !== 'group') {
    return [];
  }
  return resolveGroupMembers(normalizedGroupId);
});

ipcMain.handle(
  'group:set-role',
  async (_event, groupId: string, memberPublicKey: string, role: ChatRole): Promise<void> => {
    const normalizedGroupId = String(groupId ?? '').trim();
    const normalizedMember = normalizePublicKey(memberPublicKey);
    if (!normalizedGroupId || !normalizedMember) {
      throw new Error('Invalid group/member');
    }
    if (!(CHAT_ROLES as readonly string[]).includes(role)) {
      throw new Error('Invalid role');
    }

    const localIdentity = await identityService.loadLocalIdentity();
    if (!localIdentity) {
      throw new Error('No identity');
    }
    const localKey = normalizePublicKey(localIdentity.publicKey);
    const rolesByMember = await resolveGroupRoles(normalizedGroupId);
    const localRoles = rolesByMember.get(localKey);
    if (!localRoles || !localRoles.has('admin')) {
      throw new Error('Only admins can manage roles');
    }

    const privateKey = await identityService.getLocalPrivateKey();
    const existing = rolesByMember.get(normalizedMember) ?? new Set<ChatRole>(['membro']);
    for (const existingRole of existing) {
      if (existingRole === role) continue;
      try {
        const revoked = await eventService.publish({
          channelId: normalizedGroupId,
          author: localKey,
          type: 'role.revoke',
          payload: { member: normalizedMember, role: existingRole },
          privateKey,
        });
        emitUIEventUpdate(revoked, 'local');
        gossipService?.broadcastEvent(revoked);
      } catch (error) {
        if (!(error instanceof DuplicateEventError)) {
          throw error;
        }
      }
    }

    try {
      const granted = await eventService.publish({
        channelId: normalizedGroupId,
        author: localKey,
        type: 'role.grant',
        payload: { member: normalizedMember, role },
        privateKey,
      });
      emitUIEventUpdate(granted, 'local');
      gossipService?.broadcastEvent(granted);
    } catch (error) {
      if (!(error instanceof DuplicateEventError)) {
        throw error;
      }
    }
  },
);

ipcMain.handle('invite:list', async (): Promise<UIInvite[]> => {
  return listInvites();
});

ipcMain.handle('invite:respond', async (_event, inviteId: string, accept: boolean): Promise<void> => {
  const invite = pendingInvites.get(inviteId);
  if (!invite) return;

  pendingInvites.delete(inviteId);
  emitInvitesChanged();

  const identity = await identityService.loadLocalIdentity();
  if (!identity) return;

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
    } catch (error) {
      if (!(error instanceof DuplicateEventError)) {
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
      preload: path.resolve(__dirname, '..', 'preload', 'preload.js'),
    },
  });

  const rendererPath = path.resolve(__dirname, '..', 'renderer', 'index.html');
  void mainWindow.loadFile(rendererPath);
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
