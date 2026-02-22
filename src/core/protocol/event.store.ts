import { Event, EventType } from '../model';

export interface EventListOptions {
  limit?: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  types?: EventType[];
}

export interface EventStore {
  append(event: Event): Promise<void>;
  getById(id: string): Promise<Event | null>;
  getChannelEvents(channelId: string, options?: EventListOptions): Promise<Event[]>;
  listChannelIds(): Promise<string[]>;
  getLast(channelId: string): Promise<Event | null>;
  exists(id: string): Promise<boolean>;
}
