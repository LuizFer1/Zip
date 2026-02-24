// Scaffold only: structure placeholder (no business logic).
// File: permissions.ts

export type HashHex = string;
export type PublicKeyHex = string;
export type UnixTime = number;


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
   PERMISSION SYSTEM
========================================================== */

export interface PermissionContext {
  groupId: string;
  actor: PublicKeyHex;
  target?: PublicKeyHex;
}

export interface PermissionService {
  has(ctx: PermissionContext, perm: Permission): Promise<boolean>;
  getEffectivePermissions(ctx: PermissionContext): Promise<Permission[]>;
}