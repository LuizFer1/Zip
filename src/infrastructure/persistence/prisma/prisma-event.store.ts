import { Prisma, PrismaClient } from '@prisma/client';
import { Event, EventValidator } from '../../../core/model';
import { EventSignerImpl } from '../../../core/protocol/event.sing';
import { EventListOptions, EventStore } from '../../../core/protocol/event.store';
import { SimpleEventValidator } from '../../../core/protocol/events.validator';
import { prisma } from '../../../core/storage/prisma.client';
import { EventMapper } from './event.mapper';

export class PrismaEventStore implements EventStore {
  constructor(
    private readonly validator: EventValidator = new SimpleEventValidator(new EventSignerImpl()),
    private readonly db: PrismaClient = prisma,
  ) {}

  async append(event: Event): Promise<void> {
    await this.validator.validate(event);
    await this.db.event.create({
      data: EventMapper.toPersistence(event),
    });
  }

  async getById(id: string): Promise<Event | null> {
    const data = await this.db.event.findUnique({
      where: { id },
    });
    return data ? EventMapper.toDomain(data) : null;
  }

  async getChannelEvents(
    channelId: string,
    options: EventListOptions = {},
  ): Promise<Event[]> {
    const where: Prisma.EventWhereInput = { channelId };

    if (options.types && options.types.length > 0) {
      where.type = { in: options.types };
    }

    if (options.fromTimestamp !== undefined || options.toTimestamp !== undefined) {
      where.timestamp = {};
      if (options.fromTimestamp !== undefined) {
        where.timestamp.gte = options.fromTimestamp;
      }
      if (options.toTimestamp !== undefined) {
        where.timestamp.lte = options.toTimestamp;
      }
    }

    const rows = await this.db.event.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      ...(options.limit !== undefined ? { take: options.limit } : {}),
    });

    return rows.map((row) => EventMapper.toDomain(row));
  }

  async getLast(channelId: string): Promise<Event | null> {
    const row = await this.db.event.findFirst({
      where: { channelId },
      orderBy: { timestamp: 'desc' },
    });
    return row ? EventMapper.toDomain(row) : null;
  }

  async exists(id: string): Promise<boolean> {
    const row = await this.db.event.findUnique({
      where: { id },
      select: { id: true },
    });
    return row !== null;
  }
}
