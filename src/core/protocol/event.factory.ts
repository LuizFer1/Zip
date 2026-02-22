import { randomUUID } from 'node:crypto';
import { Event, EventRef, EventType } from '../model';
import { EventSerializer } from './event.serializer';

export class EventFactory {
  static create<T>(
    channelId: string,
    author: string,
    type: EventType,
    payload: T,
    prev: EventRef,
    signature: string = '',
  ): Event {
    return {
      id: randomUUID(),
      channelId,
      author,
      timestamp: Date.now(),
      type,
      payload: EventSerializer.encodePayload(payload),
      prev,
      signature,
    };
  }
}
