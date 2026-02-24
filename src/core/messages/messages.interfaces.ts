// Scaffold only: structure placeholder (no business logic).
// File: messages.interfaces.ts

import { AttachmentRef } from "../media/media.interfaces";

export type HashHex = string;
export type PublicKeyHex = string;
export type UnixTime = number;

/* ==========================================================
   MESSAGE SERVICE
========================================================== */

export interface MessageService {
  sendText(
    channelId: string,
    actor: PublicKeyHex,
    content: string,
    attachments?: AttachmentRef[]
  ): Promise<void>;

  edit(
    channelId: string,
    actor: PublicKeyHex,
    targetEventId: HashHex,
    newContent: string
  ): Promise<void>;

  delete(
    channelId: string,
    actor: PublicKeyHex,
    targetEventId: HashHex
  ): Promise<void>;
}

