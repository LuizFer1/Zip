import { EventHasherImpl } from '../protocol/event.hash';
import { EventSerializer } from '../protocol/event.serializer';
import { EventService } from '../protocol/event.service';

export interface ChannelHead {
  channelId: string;
  eventId: string;
  timestamp: number;
  hash: string;
}

export class HeadsService {
  constructor(
    private readonly eventService: EventService,
    private readonly hasher: EventHasherImpl = new EventHasherImpl(),
  ) {}

  async listHeads(): Promise<ChannelHead[]> {
    const channelIds = await this.eventService.listChannelIds();
    const heads: ChannelHead[] = [];

    for (const channelId of channelIds) {
      const events = await this.eventService.listByChannel(channelId);
      if (events.length === 0) {
        continue;
      }

      const head = events[events.length - 1];
      heads.push({
        channelId,
        eventId: head.id,
        timestamp: head.timestamp,
        hash: this.hasher.hash(EventSerializer.canonicalBytes(head, false)),
      });
    }

    return heads.sort((a, b) => {
      if (a.channelId === b.channelId) {
        return a.timestamp - b.timestamp;
      }
      return a.channelId.localeCompare(b.channelId);
    });
  }
}
