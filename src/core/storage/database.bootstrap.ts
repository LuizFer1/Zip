import Database from 'better-sqlite3';
import { resolveDatabasePath } from './database.path';

const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "channelId" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "payload" BLOB NOT NULL,
  "prev" TEXT NOT NULL,
  "signature" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Event_channelId_idx" ON "Event"("channelId");
CREATE INDEX IF NOT EXISTS "Event_timestamp_idx" ON "Event"("timestamp");
CREATE INDEX IF NOT EXISTS "Event_author_idx" ON "Event"("author");
CREATE INDEX IF NOT EXISTS "Event_channelId_timestamp_idx" ON "Event"("channelId", "timestamp");

CREATE TABLE IF NOT EXISTS "Channel" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creator" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "Identity" (
  "publicKey" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT,
  "avatar" TEXT,
  "updatedAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "LocalIdentity" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "privateKey" TEXT NOT NULL,
  "avatar" TEXT,
  "username" TEXT NOT NULL,
  "createdAt" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "ChannelKey" (
  "channelId" TEXT NOT NULL PRIMARY KEY,
  "publicKey" TEXT NOT NULL,
  "privateKey" TEXT,
  "encryptionKey" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "ChannelKey_publicKey_idx" ON "ChannelKey"("publicKey");

CREATE TABLE IF NOT EXISTS "ChannelHead" (
  "channelId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  PRIMARY KEY ("channelId", "eventId")
);

CREATE TABLE IF NOT EXISTS "Peer" (
  "publicKey" TEXT NOT NULL PRIMARY KEY,
  "lastSeen" INTEGER NOT NULL,
  "addresses" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS "Peer_lastSeen_idx" ON "Peer"("lastSeen");
`;

let bootstrapped = false;

export function bootstrapDatabase(): void {
  if (bootstrapped) {
    return;
  }

  const dbPath = resolveDatabasePath();
  const db = new Database(dbPath);
  try {
    db.pragma('journal_mode = WAL');
    db.exec(BOOTSTRAP_SQL);
    bootstrapped = true;
  } finally {
    db.close();
  }
}
