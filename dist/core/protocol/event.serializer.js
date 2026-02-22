"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSerializer = void 0;
const EVENT_TYPES = new Set([
    'channel.create',
    'channel.update',
    'channel.delete',
    'member.join',
    'member.leave',
    'role.grant',
    'role.revoke',
    'message.create',
    'message.edit',
    'message.delete',
    'profile.update',
]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
class EventSerializer {
    static encodePayload(payload) {
        return textEncoder.encode(JSON.stringify(payload));
    }
    static decodePayload(payload) {
        const json = textDecoder.decode(payload);
        return JSON.parse(json);
    }
    static toSerializable(event) {
        return {
            id: event.id,
            channelId: event.channelId,
            author: event.author,
            timestamp: event.timestamp,
            type: event.type,
            payload: this.bytesToBase64(event.payload),
            prev: {
                id: event.prev.id,
                hash: event.prev.hash,
            },
            signature: event.signature,
        };
    }
    static fromSerializable(event) {
        return {
            id: event.id,
            channelId: event.channelId,
            author: event.author,
            timestamp: event.timestamp,
            type: event.type,
            payload: this.base64ToBytes(event.payload),
            prev: {
                id: event.prev.id,
                hash: event.prev.hash,
            },
            signature: event.signature,
        };
    }
    static serialize(event) {
        return JSON.stringify(this.toSerializable(event));
    }
    static deserialize(serialized) {
        const parsed = JSON.parse(serialized);
        return this.fromUnknown(parsed);
    }
    static canonicalBytes(event, includeSignature = false) {
        const canonical = includeSignature
            ? {
                id: event.id,
                channelId: event.channelId,
                author: event.author,
                timestamp: event.timestamp,
                type: event.type,
                payload: this.bytesToBase64(event.payload),
                prev: {
                    id: event.prev.id,
                    hash: event.prev.hash,
                },
                signature: event.signature,
            }
            : {
                id: event.id,
                channelId: event.channelId,
                author: event.author,
                timestamp: event.timestamp,
                type: event.type,
                payload: this.bytesToBase64(event.payload),
                prev: {
                    id: event.prev.id,
                    hash: event.prev.hash,
                },
            };
        return textEncoder.encode(JSON.stringify(canonical));
    }
    static fromUnknown(value) {
        if (!this.isRecord(value)) {
            throw new TypeError('Invalid serialized event: root must be an object');
        }
        const prev = this.readEventRef(value.prev);
        return {
            id: this.readString(value.id, 'id'),
            channelId: this.readString(value.channelId, 'channelId'),
            author: this.readString(value.author, 'author'),
            timestamp: this.readTimestamp(value.timestamp, 'timestamp'),
            type: this.readEventType(value.type, 'type'),
            payload: this.base64ToBytes(this.readString(value.payload, 'payload')),
            prev,
            signature: this.readString(value.signature, 'signature'),
        };
    }
    static readEventRef(value) {
        if (!this.isRecord(value)) {
            throw new TypeError('Invalid serialized event: "prev" must be an object');
        }
        return {
            id: this.readString(value.id, 'prev.id'),
            hash: this.readString(value.hash, 'prev.hash'),
        };
    }
    static readEventType(value, field) {
        const type = this.readString(value, field);
        if (!EVENT_TYPES.has(type)) {
            throw new TypeError(`Invalid serialized event: "${field}" has unsupported value "${type}"`);
        }
        return type;
    }
    static readTimestamp(value, field) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
            throw new TypeError(`Invalid serialized event: "${field}" must be a non-negative number`);
        }
        return Math.trunc(value);
    }
    static readString(value, field) {
        if (typeof value !== 'string') {
            throw new TypeError(`Invalid serialized event: "${field}" must be a string`);
        }
        return value;
    }
    static isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    static bytesToBase64(bytes) {
        return Buffer.from(bytes).toString('base64');
    }
    static base64ToBytes(base64) {
        return Uint8Array.from(Buffer.from(base64, 'base64'));
    }
}
exports.EventSerializer = EventSerializer;
