
export type HashHex = string;

/* ==========================================================
   BLOB STORAGE (ALTERADO / NOVO)
========================================================== */

export interface BlobStorage {
  save(
    buffer: Buffer,
    meta: {
      mime: string;
      filename?: string;
      hashAlg?: string;
    }
  ): Promise<BlobMeta>;

  get(hash: HashHex): Promise<Buffer | null>;

  exists(hash: HashHex): Promise<boolean>;

  delete(hash: HashHex): Promise<void>;
}

export interface BlobPieceService {
  initPieces(hash: HashHex, size: number, chunkSize: number): Promise<void>;

  markPieceComplete(
    hash: HashHex,
    index: number,
    pieceHash?: string
  ): Promise<void>;

  getMissingPieces(hash: HashHex): Promise<BlobPieceMeta[]>;

  finalize(hash: HashHex): Promise<void>;
}

/* ==========================================================
   ATTACHMENTS / BLOBS
========================================================== */

export interface AttachmentRef {
  hash: HashHex;
  mime: string;
  size: number;
  name?: string;
}

export interface BlobMeta {
  hash: HashHex;
  size: number;
  mime: string;
  filename?: string;
  status: "missing" | "partial" | "complete";
  localPath?: string;
  hashAlg: string;
}

export interface BlobPieceMeta {
  blobHash: HashHex;
  index: number;
  offset: number;
  length: number;
  pieceHash?: string;
  status: "missing" | "have";
}

