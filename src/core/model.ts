// ── Types ───────────────────────────────────────────────────

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
// Contacts (substitui Friend)
// ─────────────────────────────────────────────

export interface Contact {
  publicKey: string;
  nickname?: string;
  addedAt: number;
}

// ─────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────


export interface Event<T = any> {
  id: string;               // hash determinístico
  channelId: string;
  author: string;           // publicKey
  timestamp: number;
  type: EventType;
  payload: T;
  prev: string[];           // DAG refs
  signature: string;        // assinatura ed25519
}

// ─────────────────────────────────────────────
// Payloads
// ─────────────────────────────────────────────

// Channel

export interface ChannelCreatePayload {
  name: string;
  description?: string;
}

export interface ChannelUpdatePayload {
  name?: string;
  description?: string;
}

// Members

export interface MemberJoinPayload {
  member: string;           // publicKey
}

export interface MemberLeavePayload {
  member: string;
}

// Roles

export interface RoleGrantPayload {
  member: string;
  role: string;
}

export interface RoleRevokePayload {
  member: string;
  role: string;
}

// Messages

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

// Profile

export interface ProfileUpdatePayload {
  username?: string;
  avatar?: string;
}

// ─────────────────────────────────────────────
// Derived Models (UI Layer)
// ─────────────────────────────────────────────

export interface DerivedMessage {
  id: string;
  author: string;
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