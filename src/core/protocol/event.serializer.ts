import { Event, EventRef, EventType, SerializedEvent } from '../model';

const EVENT_TYPES: Set<EventType> = new Set<EventType>([
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

type UnknownRecord = Record<string, unknown>;

export class EventSerializer {
  static encodePayload<T>(payload: T): Uint8Array {
    return textEncoder.encode(JSON.stringify(payload));
  }

  static decodePayload<T>(payload: Uint8Array): T {
    const json = textDecoder.decode(payload);
    return JSON.parse(json) as T;
  }

  static toSerializable(event: Event): SerializedEvent {
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

  static fromSerializable(event: SerializedEvent): Event {
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

  static serialize(event: Event): string {
    return JSON.stringify(this.toSerializable(event));
  }

  static deserialize(serialized: string): Event {
    const parsed = JSON.parse(serialized) as unknown;
    return this.fromUnknown(parsed);
  }

  static canonicalBytes(event: Event, includeSignature: boolean = false): Uint8Array {
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

  private static fromUnknown(value: unknown): Event {
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

  private static readEventRef(value: unknown): EventRef {
    if (!this.isRecord(value)) {
      throw new TypeError('Invalid serialized event: "prev" must be an object');
    }

    return {
      id: this.readString(value.id, 'prev.id'),
      hash: this.readString(value.hash, 'prev.hash'),
    };
  }

  private static readEventType(value: unknown, field: string): EventType {
    const type = this.readString(value, field) as EventType;
    if (!EVENT_TYPES.has(type)) {
      throw new TypeError(`Invalid serialized event: "${field}" has unsupported value "${type}"`);
    }
    return type;
  }

  private static readTimestamp(value: unknown, field: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new TypeError(`Invalid serialized event: "${field}" must be a non-negative number`);
    }
    return Math.trunc(value);
  }

  private static readString(value: unknown, field: string): string {
    if (typeof value !== 'string') {
      throw new TypeError(`Invalid serialized event: "${field}" must be a string`);
    }
    return value;
  }

  private static isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null;
  }

  private static bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private static base64ToBytes(base64: string): Uint8Array {
    return Uint8Array.from(Buffer.from(base64, 'base64'));
  }
}
