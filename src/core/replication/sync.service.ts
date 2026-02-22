import { Event } from '../model';
import { EventService } from '../protocol/event.service';
import { HeadsService } from './heads.service';

const DEFAULT_MAX_EVENTS_PER_BATCH = 250;

export interface SyncCursor {
  channelId: string;
  lastEventId: string;
  lastTimestamp: number;
}

export interface SyncBatchResult {
  events: Event[];
  more: boolean;
}

export class SyncService {
  constructor(
    private readonly eventService: EventService,
    private readonly headsService: HeadsService = new HeadsService(eventService),
  ) {}

  async buildCursor(): Promise<SyncCursor[]> {
    const heads = await this.headsService.listHeads();
    return heads.map((head) => ({
      channelId: head.channelId,
      lastEventId: head.eventId,
      lastTimestamp: head.timestamp,
    }));
  }

  async collectMissingEvents(
    remoteCursor: SyncCursor[],
    maxEvents: number = DEFAULT_MAX_EVENTS_PER_BATCH,
  ): Promise<SyncBatchResult> {
    const limitedMax = Math.max(1, maxEvents);
    const cursorByChannel = new Map(remoteCursor.map((cursor) => [cursor.channelId, cursor]));
    const channelIds = await this.eventService.listChannelIds();
    const selected: Event[] = [];

    for (const channelId of channelIds) {
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

  private findStartIndex(events: Event[], cursor: SyncCursor | undefined): number {
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
