import { Channel } from '../../../core/model';

type ChannelRow = {
  id: string;
  creator: string;
  createdAt: number;
};

export class ChannelMapper {
  static toDomain(row: ChannelRow): Channel {
    return {
      id: row.id,
      creator: row.creator,
      createdAt: row.createdAt,
    };
  }
}
