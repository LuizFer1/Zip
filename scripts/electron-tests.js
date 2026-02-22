const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ed25519 } = require('@noble/curves/ed25519');

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-electron-test-'));
  const dbPath = path.join(tempDir, 'integration.db');

  process.env.ZIP_DB_PATH = dbPath;
  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'zip-test-encryption-key';

  const { EventService } = require('../dist/core/protocol/event.service.js');
  const { PrismaEventStore } = require('../dist/infrastructure/persistence/prisma/prisma-event.store.js');
  const { prisma } = require('../dist/core/storage/prisma.client.js');

  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  const author = Buffer.from(publicKey).toString('hex');

  const service = new EventService(new PrismaEventStore());
  await service.publish({
    channelId: 'ci-channel',
    author,
    type: 'channel.create',
    payload: { name: 'ci-channel', description: 'integration-test' },
    privateKey,
  });
  await service.publish({
    channelId: 'ci-channel',
    author,
    type: 'message.create',
    payload: { content: 'hello from electron integration test' },
    privateKey,
  });

  const events = await service.listByChannel('ci-channel');
  assert.equal(events.length, 2);
  assert.equal(events[0].type, 'channel.create');
  assert.equal(events[1].type, 'message.create');

  await prisma.$disconnect();
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('ELECTRON_TESTS_OK');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
