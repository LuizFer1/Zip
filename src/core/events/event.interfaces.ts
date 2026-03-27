import { AttachmentRef } from "../media/media.interfaces";

/* ==========================================================
   BASE TYPES
========================================================== */

export type HashHex = string;
export type PublicKeyHex = string;
export type UnixTime = number;

export type ChannelKind = "text" | "voice" | "dm";

export type BuiltinRoleId = "owner" | "admin" | "mod" | "member";

export type BanKind = "reviewable" | "permanent";

export type BanDecision =
  | "uphold"
  | "revoke"
  | "escalate_to_perm";

/* ==========================================================
   PERMISSIONS
========================================================== */

export type Permission =
  | "member.mute"
  | "member.kick"
  | "member.ban.temp"
  | "member.ban.perm"
  | "staff.manage"
  | "group.manage"
  | "channel.manage"
  | "message.delete.any"
  | "message.edit.any";

/* ==========================================================
   EVENT SYSTEM
========================================================== */

export type EventType =
  | "group.create"
  | "group.update"
  | "group.delete"
  | "channel.create"
  | "channel.update"
  | "channel.delete"
  | "member.join"
  | "member.leave"
  | "member.mute"
  | "member.unmute"
  | "member.kick"
  | "member.ban"
  | "member.unban"
  | "role.create"
  | "role.update"
  | "role.delete"
  | "role.grant"
  | "role.revoke"
  | "ban.appeal"
  | "ban.review.resolve"
  | "message.create"
  | "message.edit"
  | "message.delete"
  | "media.add"
  | "media.remove";

export interface Event<TPayload = unknown> {
  channelId: string;
  author: PublicKeyHex;
  timestamp: UnixTime;
  type: EventType;
  payload: TPayload;
  prev: HashHex;
  receivedAt?: UnixTime;
}

export interface EventSigned extends Event {
  id: HashHex;
  signature: string;
}


/* ==========================================================
   PAYLOADS
========================================================== */

export interface MessageCreatePayload {
  channelId: string;
  content: string;
  attachments?: AttachmentRef[];
}

export interface MemberBanPayload {
  groupId: string;
  target: PublicKeyHex;
  kind: BanKind;
  durationSeconds?: number;
  reason?: string;
  caseId: string;
}

export interface BanAppealPayload {
  groupId: string;
  caseId: string;
  message: string;
}

export interface BanResolvePayload {
  groupId: string;
  caseId: string;
  decision: BanDecision;
  reason?: string;
}

/* ==========================================================
   EVENT INFRA INTERFACES
========================================================== */

export interface EventSerializer {
  serialize(event: Omit<Event, "id" | "signature">): Uint8Array;
  deserialize(data: Uint8Array): unknown;
}

export interface EventHasher {
  hash(data: Uint8Array): Promise<HashHex>;
}

export interface EventSigner {
  publicKey(): PublicKeyHex;
  sign(data: Uint8Array): Promise<string>;
}

export interface EventValidator {
  validate(event: Event): Promise<void>;
}

export interface EventStore {
  append(event: Event): Promise<void>;
  getById(id: HashHex): Promise<Event | null>;
  getByChannel(channelId: string, opts?: {
    after?: UnixTime;
    limit?: number;
  }): Promise<Event[]>;
  has(id: HashHex): Promise<boolean>;
}

export interface HeadStore {
  getHeads(channelId: string): Promise<HashHex[]>;
  setHeads(channelId: string, heads: HashHex[]): Promise<void>;
}

