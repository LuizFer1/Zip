"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
const event_factory_1 = require("./event.factory");
const event_hash_1 = require("./event.hash");
const event_serializer_1 = require("./event.serializer");
const event_sing_1 = require("./event.sing");
class EventService {
    constructor(store, signer = new event_sing_1.EventSignerImpl(), hasher = new event_hash_1.EventHasherImpl()) {
        this.store = store;
        this.signer = signer;
        this.hasher = hasher;
    }
    async publish(input) {
        const prev = input.prev ?? await this.resolvePrevRef(input.channelId);
        const event = event_factory_1.EventFactory.create(input.channelId, input.author, input.type, input.payload, prev, '');
        if (input.privateKey) {
            event.signature = this.signer.sign(event, input.privateKey);
        }
        await this.store.append(event);
        return event;
    }
    async ingest(event) {
        await this.store.append(event);
    }
    async getById(id) {
        return this.store.getById(id);
    }
    async listByChannel(channelId, options = {}) {
        return this.store.getChannelEvents(channelId, options);
    }
    async exists(id) {
        return this.store.exists(id);
    }
    async serializeById(id) {
        const event = await this.store.getById(id);
        if (!event) {
            return null;
        }
        return event_serializer_1.EventSerializer.serialize(event);
    }
    async deserializeAndIngest(serializedEvent) {
        const event = event_serializer_1.EventSerializer.deserialize(serializedEvent);
        await this.store.append(event);
        return event;
    }
    async resolvePrevRef(channelId) {
        const previous = await this.store.getLast(channelId);
        if (!previous) {
            return { id: '', hash: '' };
        }
        const hash = this.hasher.hash(event_serializer_1.EventSerializer.canonicalBytes(previous, false));
        return {
            id: previous.id,
            hash,
        };
    }
}
exports.EventService = EventService;
