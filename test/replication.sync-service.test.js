const test = require('node:test');
const assert = require('node:assert/strict');
const { ed25519 } = require('@noble/curves/ed25519');
const { EventService } = require('../dist/core/protocol/event.service.js');
const { SyncService } = require('../dist/core/replication/sync.service.js');
const { MemoryEventStore } = require('./helpers/memory-event-store.js');

async function publishMessage(service, keypair, channelId, content) {
  return service.publish({
    channelId,
    author: Buffer.from(keypair.publicKey).toString('hex'),
    type: 'message.create',
    payload: { content },
    privateKey: keypair.privateKey,
  });
}

function createKeypair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

test('SyncService returns only events after remote cursor', async () => {
  const keypair = createKeypair();
  const service = new EventService(new MemoryEventStore());
  const syncService = new SyncService(service);

  const e1 = await publishMessage(service, keypair, 'canal-1', 'm1');
  const e2 = await publishMessage(service, keypair, 'canal-1', 'm2');
  await publishMessage(service, keypair, 'canal-2', 'x1');

  const cursor = [
    {
      channelId: 'canal-1',
      lastEventId: e1.id,
      lastTimestamp: e1.timestamp,
    },
  ];

  const batch = await syncService.collectMissingEvents(cursor, 50);
  const ids = batch.events.map((event) => event.id);

  assert.equal(ids.includes(e1.id), false);
  assert.equal(ids.includes(e2.id), true);
  assert.equal(batch.more, false);
});
