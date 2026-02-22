import { Prisma } from '@prisma/client';
import { Event, EventRef, EventType } from '../../../core/model';

type EventRow = {
  id: string;
  channelId: string;
  author: string;
  timestamp: number;
  type: string;
  payload: Uint8Array;
  prev: Prisma.JsonValue;
  signature: string;
};

export class EventMapper {
  static toPersistence(event: Event): Prisma.EventCreateInput {
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

  static toDomain(row: EventRow): Event {
    return {
      id: row.id,
      channelId: row.channelId,
      author: row.author,
      timestamp: row.timestamp,
      type: row.type as EventType,
      payload: Uint8Array.from(row.payload),
      prev: this.parsePrev(row.prev),
      signature: row.signature,
    };
  }

  private static parsePrev(value: Prisma.JsonValue): EventRef {
    if (typeof value === 'string') {
      try {
        return this.parsePrev(JSON.parse(value) as Prisma.JsonValue);
      } catch {
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

  private static isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
