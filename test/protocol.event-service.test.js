const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { EventService, DuplicateEventError, EventChainValidationError } = require('../dist/core/protocol/event.service.js');
const { EventSerializer } = require('../dist/core/protocol/event.serializer.js');
const { MemoryEventStore } = require('./helpers/memory-event-store.js');

function hashEvent(event) {
  return createHash('sha256')
    .update(EventSerializer.canonicalBytes(event, false))
    .digest('hex');
}

function makeEvent(id, channelId, prev, timestamp) {
  return {
    id,
    channelId,
    author: 'a'.repeat(64),
    timestamp,
    type: 'message.create',
    payload: EventSerializer.encodePayload({ content: id }),
    prev,
    signature: '',
  };
}

test('EventService rejects invalid prev references', async () => {
  const service = new EventService(new MemoryEventStore());
  const first = makeEvent('e1', 'c1', { id: '', hash: '' }, 1);
  await service.ingest(first);

  await assert.rejects(
    () => service.ingest(makeEvent('e2', 'c1', { id: '', hash: '' }, 2)),
    EventChainValidationError,
  );
});

test('EventService accepts valid chain and rejects duplicates', async () => {
  const service = new EventService(new MemoryEventStore());
  const first = makeEvent('e1', 'c1', { id: '', hash: '' }, 1);
  await service.ingest(first);

  const second = makeEvent('e2', 'c1', { id: first.id, hash: hashEvent(first) }, 2);
  await service.ingest(second);

  await assert.rejects(() => service.ingest(second), DuplicateEventError);

  const tampered = {
    ...second,
    payload: EventSerializer.encodePayload({ content: 'tampered' }),
  };
  await assert.rejects(() => service.ingest(tampered), EventChainValidationError);
});
