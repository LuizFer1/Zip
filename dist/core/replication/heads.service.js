"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeadsService = void 0;
const event_hash_1 = require("../protocol/event.hash");
const event_serializer_1 = require("../protocol/event.serializer");
class HeadsService {
    constructor(eventService, hasher = new event_hash_1.EventHasherImpl()) {
        this.eventService = eventService;
        this.hasher = hasher;
    }
    async listHeads() {
        const channelIds = await this.eventService.listChannelIds();
        const heads = [];
        for (const channelId of channelIds) {
            const events = await this.eventService.listByChannel(channelId);
            if (events.length === 0) {
                continue;
            }
            const head = events[events.length - 1];
            heads.push({
                channelId,
                eventId: head.id,
                timestamp: head.timestamp,
                hash: this.hasher.hash(event_serializer_1.EventSerializer.canonicalBytes(head, false)),
            });
        }
        return heads.sort((a, b) => {
            if (a.channelId === b.channelId) {
                return a.timestamp - b.timestamp;
            }
            return a.channelId.localeCompare(b.channelId);
        });
    }
}
exports.HeadsService = HeadsService;
