import { Channel } from "../model";

export interface ChannelRepository {
  list(): Promise<Channel[]>;
  createIfMissing(channel: Channel): Promise<Channel>;
}
