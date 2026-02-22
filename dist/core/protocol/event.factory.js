"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventFactory = void 0;
class EventFactory {
    static create(channelId, author, type, payload, prev, signature = "") {
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
        const event = {
            id: crypto.randomUUID(),
            channelId,
            author,
            timestamp: Date.now(),
            type,
            payload: payloadBytes,
            prev,
            signature,
        };
        return event;
    }
}
exports.EventFactory = EventFactory;
