import { PrismaClient } from '@prisma/client';
import { Channel } from '../../../core/model';
import { ChannelRepository } from '../../../core/storage/chanel.repository';
import { prisma } from '../../../core/storage/prisma.client';
import { ChannelMapper } from './channel.mapper';

export class PrismaChannelRepository implements ChannelRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async list(): Promise<Channel[]> {
    const rows = await this.db.channel.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ChannelMapper.toDomain(row));
  }

  async createIfMissing(channel: Channel): Promise<Channel> {
    const row = await this.db.channel.upsert({
      where: { id: channel.id },
      update: {},
      create: {
        id: channel.id,
        creator: channel.creator,
        createdAt: channel.createdAt,
      },
    });

    return ChannelMapper.toDomain(row);
  }
}
