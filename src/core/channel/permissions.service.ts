import { DerivedChannelState } from '../model';

export class PermissionsService {
  rolesForMember(state: DerivedChannelState, member: string): string[] {
    return state.members.get(member) ?? [];
  }

  canSendMessage(state: DerivedChannelState, member: string): boolean {
    return this.hasAnyRole(state, member, ['member', 'moderator', 'admin', 'owner']);
  }

  canModerateMessages(state: DerivedChannelState, member: string): boolean {
    return this.hasAnyRole(state, member, ['moderator', 'admin', 'owner']);
  }

  canManageRoles(state: DerivedChannelState, member: string): boolean {
    return this.hasAnyRole(state, member, ['admin', 'owner']);
  }

  canDeleteChannel(state: DerivedChannelState, member: string): boolean {
    return this.hasAnyRole(state, member, ['owner']);
  }

  private hasAnyRole(state: DerivedChannelState, member: string, roles: string[]): boolean {
    const set = new Set(this.rolesForMember(state, member));
    return roles.some((role) => set.has(role));
  }
}
