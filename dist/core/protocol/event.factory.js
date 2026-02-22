"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventFactory = void 0;
const node_crypto_1 = require("node:crypto");
const event_serializer_1 = require("./event.serializer");
class EventFactory {
    static create(channelId, author, type, payload, prev, signature = '') {
        return {
            id: (0, node_crypto_1.randomUUID)(),
            channelId,
            author,
            timestamp: Date.now(),
            type,
            payload: event_serializer_1.EventSerializer.encodePayload(payload),
            prev,
            signature,
        };
    }
}
exports.EventFactory = EventFactory;
