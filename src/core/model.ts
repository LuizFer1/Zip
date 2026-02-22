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
  publicKey: any;
  privateKey?: any;
  username: string;
  avatar: string | null;
  createdAt: number;
}

export interface LocalIdentity extends Identity {
  privateKey?: any;
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
  author: string;           // publicKey
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
  avatar: string;           // initials or URL
}

export interface UIChannel {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  lastMessage?: string;
}

export interface UIMessage {
  id: string;
  author: string;           // display name
  authorKey: string;        // publicKey
  own: boolean;
  content: string;
  time: string;
  edited: boolean;
  deleted: boolean;
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
  createChannel(name: string, description?: string): Promise<UIChannel>;
  listMessages(channelId: string): Promise<UIMessage[]>;
  sendMessage(channelId: string, content: string): Promise<void>;
}