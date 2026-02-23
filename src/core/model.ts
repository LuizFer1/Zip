// ── Core Event Types ─────────────────────────────────────────

export type EventType =
  | 'channel.create'
  | 'channel.update'
  | 'channel.delete'
  | 'member.join'
  | 'member.leave'
  | 'role.grant'
  | 'role.revoke'
  | 'message.create'
  | 'message.edit'
  | 'message.delete'
  | 'profile.update';

// ─────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────

export interface Identity {
  publicKey: string;
  privateKey?: string;
  username: string;
  avatar: string | null;
  createdAt: number;
}

export interface LocalIdentity extends Identity {
  privateKey?: string;
}

// ─────────────────────────────────────────────
// Channels
// ─────────────────────────────────────────────

export interface Channel {
  id: string;
  creator: string;
  createdAt: number;
}

// ─────────────────────────────────────────────
// Contacts
// ─────────────────────────────────────────────

export interface Contact {
  publicKey: string;
  nickname?: string;
  addedAt: number;
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────

export interface EventRef {
  id: string;
  hash: string;
}

export interface Event<T = any> {
  id: string;
  channelId: string;
  author: string;
  timestamp: number;
  type: EventType;
  payload: Uint8Array;
  prev: EventRef;
  signature: string;
}

export interface SerializedEvent {
  id: string;
  channelId: string;
  author: string;
  timestamp: number;
  type: EventType;
  payload: string;
  prev: EventRef;
  signature: string;
}

// ─────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────

export interface ChannelCreatePayload {
  name: string;
  description?: string;
}

export interface ChannelUpdatePayload {
  name?: string;
  description?: string;
}

export interface MemberJoinPayload {
  member: string;
}

export interface MemberLeavePayload {
  member: string;
}

export interface RoleGrantPayload {
  member: string;
  role: string;
}

export interface RoleRevokePayload {
  member: string;
  role: string;
}

export interface MessageCreatePayload {
  content: string;
}

export interface MessageEditPayload {
  targetEventId: string;
  newContent: string;
}

export interface MessageDeletePayload {
  targetEventId: string;
}

export interface ProfileUpdatePayload {
  username?: string;
  avatar?: string;
}

// ─────────────────────────────────────────────
// Derived Models (State from DAG)
// ─────────────────────────────────────────────

export interface DerivedMessage {
  id: string;
  author: string;  // publicKey
  content: string;
  timestamp: number;
  edited: boolean;
  deleted: boolean;
}

export interface DerivedChannelState {
  channel: Channel;
  members: Map<string, string[]>;
  messages: DerivedMessage[];
}

// ─────────────────────────────────────────────
// UI Layer Types
// ─────────────────────────────────────────────

export interface UIProfile {
  publicKey: string;
  username: string;
  avatar: string;  // initials or URL
}

export interface UIChannel {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  channelType?: 'group' | 'text' | 'voice_video' | 'direct';
  parentGroupId?: string;
  lastMessage?: string;
}

export interface UIMessage {
  id: string;
  author: string;  // display name
  authorKey: string;  // publicKey
  own: boolean;
  content: string;
  time: string;
  edited: boolean;
  deleted: boolean;
}

export interface UIContact {
  nodeId: string;
  publicKey: string;
  username: string;
  avatar: string;
  connected: boolean;
}

export interface UIInvite {
  id: string;
  channelId: string;
  channelName: string;
  fromNodeId: string;
  fromPublicKey: string;
  fromUsername: string;
  createdAt: number;
}

export interface UIEventUpdate {
  id: string;
  channelId: string;
  type: EventType;
  source: 'local' | 'remote';
  timestamp: number;
}

export interface UIP2PStatus {
  enabled: boolean;
  connected: boolean;
  peers: number;
  host: string;
  port: number;
}

export interface UIAppState {
  profile: UIProfile | null;
  channels: UIChannel[];
  activeChannelId: string | null;
  messages: UIMessage[];
}

// ─────────────────────────────────────────────
// IPC API (exposed via preload bridge)
// ─────────────────────────────────────────────

export interface ZipAPI {
  getIdentity(): Promise<UIProfile | null>;
  createIdentity(username: string): Promise<UIProfile>;
  listChannels(): Promise<UIChannel[]>;
  createChannel(
    name: string,
    description?: string,
    options?: { channelType?: 'group' | 'text' | 'voice_video'; parentGroupId?: string },
  ): Promise<UIChannel>;
  listMessages(channelId: string): Promise<UIMessage[]>;
  sendMessage(channelId: string, content: string): Promise<void>;
  connectP2P(): Promise<UIP2PStatus>;
  disconnectP2P(): Promise<UIP2PStatus>;
  getP2PStatus(): Promise<UIP2PStatus>;
  listContacts(): Promise<UIContact[]>;
  startDirectChat(nodeId: string): Promise<UIChannel>;
  invitePeerToChannel(channelId: string, nodeId: string): Promise<void>;
  listInvites(): Promise<UIInvite[]>;
  respondInvite(inviteId: string, accept: boolean): Promise<void>;
  onEventsChanged(listener: (update: UIEventUpdate) => void): () => void;
  onP2PStatusChanged(listener: (status: UIP2PStatus) => void): () => void;
  onContactsChanged(listener: (contacts: UIContact[]) => void): () => void;
  onInvitesChanged(listener: (invites: UIInvite[]) => void): () => void;
}

// ─────────────────────────────────────────────
// Hashing and Signature Types
// ─────────────────────────────────────────────

export interface EventHasher {
  hash(data: Uint8Array): string;
}

export interface EventSigner {
  sign(event: Event, privateKey: Uint8Array): string;
  verify(event: Event, publicKey: Uint8Array): boolean;
}


// ─────────────────────────────────────────────
// Validation and Error Types
// ─────────────────────────────────────────────

export interface EventValidator {
  validate(event: Event): Promise<void>;
}
