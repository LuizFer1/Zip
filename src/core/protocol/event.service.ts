import { EventFactory } from './event.factory';
import { EventHasherImpl } from './event.hash';
import { EventSerializer } from './event.serializer';
import { EventSignerImpl } from './event.sing';
import {
  EventListOptions,
  EventStore,
} from './event.store';
import {
  Event,
  EventHasher,
  EventRef,
  EventSigner,
  EventType,
} from '../model';

export interface PublishEventInput<T = unknown> {
  channelId: string;
  author: string;
  type: EventType;
  payload: T;
  privateKey: Uint8Array;
  prev?: EventRef;
}

export class DuplicateEventError extends Error {
  constructor(eventId: string) {
    super(`Duplicate event id: ${eventId}`);
    this.name = 'DuplicateEventError';
  }
}

export class EventChainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventChainValidationError';
  }
}

export class EventService {
  constructor(
    private readonly store: EventStore,
    private readonly signer: EventSigner = new EventSignerImpl(),
    private readonly hasher: EventHasher = new EventHasherImpl(),
  ) {}

  async publish<T>(input: PublishEventInput<T>): Promise<Event> {
    const prev = input.prev ?? await this.resolvePrevRef(input.channelId);
    const event = EventFactory.create(
      input.channelId,
      input.author,
      input.type,
      input.payload,
      prev,
      '',
    );
    event.signature = this.signer.sign(event, input.privateKey);

    await this.assertCanAppend(event);
    await this.store.append(event);
    return event;
  }

  async ingest(event: Event): Promise<void> {
    await this.assertCanAppend(event);
    await this.store.append(event);
  }

  async getById(id: string): Promise<Event | null> {
    return this.store.getById(id);
  }

  async listByChannel(
    channelId: string,
    options: EventListOptions = {},
  ): Promise<Event[]> {
    return this.store.getChannelEvents(channelId, options);
  }

  async listChannelIds(): Promise<string[]> {
    return this.store.listChannelIds();
  }

  async exists(id: string): Promise<boolean> {
    return this.store.exists(id);
  }

  async serializeById(id: string): Promise<string | null> {
    const event = await this.store.getById(id);
    if (!event) {
      return null;
    }
    return EventSerializer.serialize(event);
  }

  async deserializeAndIngest(serializedEvent: string): Promise<Event> {
    const event = EventSerializer.deserialize(serializedEvent);
    await this.assertCanAppend(event);
    await this.store.append(event);
    return event;
  }

  private async resolvePrevRef(channelId: string): Promise<EventRef> {
    const previous = await this.store.getLast(channelId);

    if (!previous) {
      return { id: '', hash: '' };
    }

    const hash = this.hasher.hash(EventSerializer.canonicalBytes(previous, false));
    return {
      id: previous.id,
      hash,
    };
  }

  private async assertCanAppend(event: Event): Promise<void> {
    await this.assertNotDuplicate(event);
    await this.assertPrevMatchesChannelHead(event);
  }

  private async assertNotDuplicate(event: Event): Promise<void> {
    const existing = await this.store.getById(event.id);
    if (!existing) {
      return;
    }

    if (this.eventsEqual(existing, event)) {
      throw new DuplicateEventError(event.id);
    }

    throw new EventChainValidationError(`Event id conflict detected: ${event.id}`);
  }

  private async assertPrevMatchesChannelHead(event: Event): Promise<void> {
    const head = await this.store.getLast(event.channelId);
    const hasPrev = event.prev.id.trim().length > 0 || event.prev.hash.trim().length > 0;

    if (!head) {
      if (!hasPrev) {
        return;
      }
      throw new EventChainValidationError(
        `Invalid prev for first event in channel "${event.channelId}": expected empty prev`,
      );
    }

    if (!hasPrev) {
      throw new EventChainValidationError(
        `Invalid prev for channel "${event.channelId}": missing prev reference`,
      );
    }

    const expectedHash = this.hasher.hash(EventSerializer.canonicalBytes(head, false));
    if (event.prev.id !== head.id || event.prev.hash !== expectedHash) {
      throw new EventChainValidationError(
        `Invalid prev for channel "${event.channelId}": expected (${head.id}, ${expectedHash})`,
      );
    }
  }

  private eventsEqual(a: Event, b: Event): boolean {
    const left = EventSerializer.canonicalBytes(a, true);
    const right = EventSerializer.canonicalBytes(b, true);
    if (left.length !== right.length) {
      return false;
    }

    for (let i = 0; i < left.length; i += 1) {
      if (left[i] !== right[i]) {
        return false;
      }
    }

    return true;
  }
}
