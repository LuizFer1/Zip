// Scaffold only: structure placeholder (no business logic).
// File: sync.interfaces.ts

export type HashHex = string;
export type PublicKeyHex = string;
export type UnixTime = number;

/* ==========================================================
   SYNC (EVENTS + BLOBS)
========================================================== */

export interface PeerConnection {
  peerPublicKey: PublicKeyHex;
  send<T>(msg: T): Promise<void>;
  onMessage(cb: (msg: any) => void): void;
  close(): Promise<void>;
}

export interface SyncService {
  syncEvents(peerPublicKey: PublicKeyHex): Promise<void>;
  ingestEvents(peerPublicKey: PublicKeyHex, events: Event[]): Promise<void>;

  requestBlob(hash: HashHex, peerPublicKey: PublicKeyHex): Promise<void>;
  sendBlob(hash: HashHex, peerPublicKey: PublicKeyHex): Promise<void>;
}

