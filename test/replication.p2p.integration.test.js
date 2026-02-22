const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { setTimeout: sleep } = require('node:timers/promises');
const { ed25519 } = require('@noble/curves/ed25519');
const { EventService } = require('../dist/core/protocol/event.service.js');
const { P2PTransport } = require('../dist/core/network/transport.js');
const { GossipService } = require('../dist/core/replication/gossip.service.js');
const { SyncService } = require('../dist/core/replication/sync.service.js');
const { MemoryEventStore } = require('./helpers/memory-event-store.js');

async function getFreePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve) => server.close(resolve));
  if (!port) {
    throw new Error('Unable to allocate free port');
  }
  return port;
}

async function waitFor(check, timeoutMs = 8_000, stepMs = 100) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) {
      return;
    }
    await sleep(stepMs);
  }
  throw new Error('Timeout waiting for condition');
}

function createKeypair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

async function publishMessage(eventService, gossipService, keypair, content) {
  const event = await eventService.publish({
    channelId: 'geral',
    author: Buffer.from(keypair.publicKey).toString('hex'),
    type: 'message.create',
    payload: { content },
    privateKey: keypair.privateKey,
  });
  gossipService.broadcastEvent(event);
  return event;
}

function createGossip(transport, eventService) {
  const syncService = new SyncService(eventService);
  return new GossipService(transport, eventService, {
    sync: {
      buildCursor: () => syncService.buildCursor(),
      collectMissingEvents: (cursor, maxEvents) => syncService.collectMissingEvents(cursor, maxEvents),
    },
  });
}

test('P2P syncs events created offline after reconnect', async () => {
  const keypair = createKeypair();
  const portA = await getFreePort();
  const portB = await getFreePort();

  const serviceA = new EventService(new MemoryEventStore());
  const serviceB = new EventService(new MemoryEventStore());

  const transportA = new P2PTransport({ nodeId: 'node-a', host: '127.0.0.1', port: portA });
  let transportB = new P2PTransport({ nodeId: 'node-b', host: '127.0.0.1', port: portB });
  const gossipA = createGossip(transportA, serviceA);
  let gossipB = createGossip(transportB, serviceB);

  const wireSyncRequester = (transport, gossip) => {
    transport.on('peer:connected', ({ nodeId }) => {
      if (nodeId) {
        void gossip.requestSyncFromPeer(nodeId);
      }
    });
  };

  wireSyncRequester(transportA, gossipA);
  wireSyncRequester(transportB, gossipB);

  try {
    await transportA.start();
    gossipA.start();
    await transportB.start();
    gossipB.start();
    await transportB.connect({ host: '127.0.0.1', port: portA });

    const onlineEvent = await publishMessage(serviceA, gossipA, keypair, 'online');
    await waitFor(() => serviceB.exists(onlineEvent.id));

    await transportB.stop();
    gossipB.stop();

    const offline1 = await publishMessage(serviceA, gossipA, keypair, 'offline-1');
    const offline2 = await publishMessage(serviceA, gossipA, keypair, 'offline-2');

    transportB = new P2PTransport({ nodeId: 'node-b', host: '127.0.0.1', port: portB });
    gossipB = createGossip(transportB, serviceB);
    wireSyncRequester(transportB, gossipB);

    await transportB.start();
    gossipB.start();
    await transportB.connect({ host: '127.0.0.1', port: portA });

    await waitFor(() => serviceB.exists(offline1.id));
    await waitFor(() => serviceB.exists(offline2.id));

    assert.equal(await serviceB.exists(offline1.id), true);
    assert.equal(await serviceB.exists(offline2.id), true);
  } finally {
    gossipA.stop();
    gossipB.stop();
    await transportA.stop();
    await transportB.stop();
  }
});
