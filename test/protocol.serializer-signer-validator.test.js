const test = require('node:test');
const assert = require('node:assert/strict');
const { ed25519 } = require('@noble/curves/ed25519');
const { EventSerializer } = require('../dist/core/protocol/event.serializer.js');
const { EventSignerImpl } = require('../dist/core/protocol/event.sing.js');
const { SimpleEventValidator } = require('../dist/core/protocol/events.validator.js');

function buildEvent() {
  return {
    id: 'evt-1',
    channelId: 'geral',
    author: '',
    timestamp: Date.now(),
    type: 'message.create',
    payload: EventSerializer.encodePayload({ content: 'hello world' }),
    prev: { id: '', hash: '' },
    signature: '',
  };
}

test('EventSerializer roundtrip keeps canonical payload', () => {
  const event = buildEvent();
  const serialized = EventSerializer.serialize(event);
  const parsed = EventSerializer.deserialize(serialized);

  assert.deepEqual(parsed, event);
  assert.deepEqual(
    EventSerializer.canonicalBytes(parsed, false),
    EventSerializer.canonicalBytes(event, false),
  );
});

test('EventSigner + Validator validate signed events', async () => {
  const signer = new EventSignerImpl();
  const validator = new SimpleEventValidator(signer);
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);

  const event = buildEvent();
  event.author = Buffer.from(publicKey).toString('hex');
  event.signature = signer.sign(event, privateKey);

  assert.equal(signer.verify(event, publicKey), true);
  await assert.doesNotReject(() => validator.validate(event));
});
