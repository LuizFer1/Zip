"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMapper = void 0;
class EventMapper {
    static toPersistence(event) {
        return {
            id: event.id,
            channelId: event.channelId,
            author: event.author,
            timestamp: event.timestamp,
            type: event.type,
            payload: Buffer.from(event.payload),
            prev: {
                id: event.prev.id,
                hash: event.prev.hash,
            },
            signature: event.signature,
        };
    }
    static toDomain(row) {
        return {
            id: row.id,
            channelId: row.channelId,
            author: row.author,
            timestamp: row.timestamp,
            type: row.type,
            payload: Uint8Array.from(row.payload),
            prev: this.parsePrev(row.prev),
            signature: row.signature,
        };
    }
    static parsePrev(value) {
        if (typeof value === 'string') {
            try {
                return this.parsePrev(JSON.parse(value));
            }
            catch {
                return { id: '', hash: '' };
            }
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return { id: '', hash: '' };
            }
            const first = value[0];
            if (typeof first === 'string') {
                return { id: first, hash: '' };
            }
            return { id: '', hash: '' };
        }
        if (this.isObject(value)) {
            const id = typeof value.id === 'string' ? value.id : '';
            const hash = typeof value.hash === 'string' ? value.hash : '';
            return { id, hash };
        }
        return { id: '', hash: '' };
    }
    static isObject(value) {
        return typeof value === 'object' && value !== null;
    }
}
exports.EventMapper = EventMapper;
