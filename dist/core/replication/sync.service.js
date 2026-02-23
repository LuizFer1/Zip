"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = void 0;
const heads_service_1 = require("./heads.service");
const DEFAULT_MAX_EVENTS_PER_BATCH = 250;
const DIRECT_CHANNEL_PREFIX = 'dm-';
class SyncService {
    constructor(eventService, headsService = new heads_service_1.HeadsService(eventService)) {
        this.eventService = eventService;
        this.headsService = headsService;
    }
    async buildCursor() {
        const heads = await this.headsService.listHeads();
        return heads
            .filter((head) => !head.channelId.startsWith(DIRECT_CHANNEL_PREFIX))
            .map((head) => ({
            channelId: head.channelId,
            lastEventId: head.eventId,
            lastTimestamp: head.timestamp,
        }));
    }
    async collectMissingEvents(remoteCursor, maxEvents = DEFAULT_MAX_EVENTS_PER_BATCH) {
        const limitedMax = Math.max(1, maxEvents);
        const cursorByChannel = new Map(remoteCursor.map((cursor) => [cursor.channelId, cursor]));
        const channelIds = await this.eventService.listChannelIds();
        const selected = [];
        for (const channelId of channelIds) {
            if (channelId.startsWith(DIRECT_CHANNEL_PREFIX)) {
                continue;
            }
            const events = await this.eventService.listByChannel(channelId);
            if (events.length === 0) {
                continue;
            }
            const startIndex = this.findStartIndex(events, cursorByChannel.get(channelId));
            for (let i = startIndex; i < events.length; i += 1) {
                selected.push(events[i]);
            }
        }
        selected.sort((a, b) => {
            if (a.timestamp !== b.timestamp) {
                return a.timestamp - b.timestamp;
            }
            if (a.channelId !== b.channelId) {
                return a.channelId.localeCompare(b.channelId);
            }
            return a.id.localeCompare(b.id);
        });
        return {
            events: selected.slice(0, limitedMax),
            more: selected.length > limitedMax,
        };
    }
    findStartIndex(events, cursor) {
        if (!cursor) {
            return 0;
        }
        if (cursor.lastEventId.trim().length > 0) {
            const exactMatch = events.findIndex((event) => event.id === cursor.lastEventId);
            if (exactMatch >= 0) {
                return exactMatch + 1;
            }
        }
        if (cursor.lastTimestamp <= 0) {
            return 0;
        }
        const byTimestamp = events.findIndex((event) => event.timestamp >= cursor.lastTimestamp);
        return byTimestamp >= 0 ? byTimestamp : events.length;
    }
}
exports.SyncService = SyncService;
