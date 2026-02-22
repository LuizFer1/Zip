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
  privateKey?: Uint8Array;
  prev?: EventRef;
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

    if (input.privateKey) {
      event.signature = this.signer.sign(event, input.privateKey);
    }

    await this.store.append(event);
    return event;
  }

  async ingest(event: Event): Promise<void> {
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
}
