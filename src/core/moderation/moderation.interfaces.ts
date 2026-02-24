// Scaffold only: structure placeholder (no business logic).
// File: moderation.interfaces.ts

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
   MODERATION
========================================================== */

export interface ModerationCase {
  id: string;
  groupId: string;
  targetKey: PublicKeyHex;
  kind: BanKind;
  status:
    | "open"
    | "appealed"
    | "upheld"
    | "revoked"
    | "escalated";
  createdAt: UnixTime;
  createdBy: PublicKeyHex;
  reason?: string;
  resolvedAt?: UnixTime;
  resolvedBy?: PublicKeyHex;
  resolution?: string;
}

export interface ModerationService {
  mute(
    groupId: string,
    actor: PublicKeyHex,
    target: PublicKeyHex,
    until: UnixTime,
    reason?: string
  ): Promise<void>;

  kick(
    groupId: string,
    actor: PublicKeyHex,
    target: PublicKeyHex,
    reason?: string
  ): Promise<void>;

  banReviewable(
    groupId: string,
    actor: PublicKeyHex,
    target: PublicKeyHex,
    caseId: string,
    reason?: string
  ): Promise<void>;

  banPermanent(
    groupId: string,
    actor: PublicKeyHex,
    target: PublicKeyHex,
    caseId: string,
    reason?: string
  ): Promise<void>;

  unban(
    groupId: string,
    actor: PublicKeyHex,
    target: PublicKeyHex,
    caseId?: string
  ): Promise<void>;

  appeal(
    groupId: string,
    actor: PublicKeyHex,
    caseId: string,
    message: string
  ): Promise<void>;

  resolve(
    groupId: string,
    actor: PublicKeyHex,
    caseId: string,
    decision: BanDecision,
    reason?: string
  ): Promise<void>;
}
