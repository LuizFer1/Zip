import { DerivedChannelState, Event } from '../model';
import { ChannelStateBuilder } from './channel-state.builder';
import { PermissionsService } from './permissions.service';

export class ChannelService {
  constructor(
    private readonly stateBuilder: ChannelStateBuilder = new ChannelStateBuilder(),
    private readonly permissions: PermissionsService = new PermissionsService(),
  ) {}

  buildState(channelId: string, events: Event[]): DerivedChannelState {
    return this.stateBuilder.build(channelId, events);
  }

  canSendMessage(channelId: string, events: Event[], member: string): boolean {
    const state = this.buildState(channelId, events);
    return this.permissions.canSendMessage(state, member);
  }

  canManageRoles(channelId: string, events: Event[], member: string): boolean {
    const state = this.buildState(channelId, events);
    return this.permissions.canManageRoles(state, member);
  }

  canModerateMessages(channelId: string, events: Event[], member: string): boolean {
    const state = this.buildState(channelId, events);
    return this.permissions.canModerateMessages(state, member);
  }
}
