"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsService = void 0;
class PermissionsService {
    rolesForMember(state, member) {
        return state.members.get(member) ?? [];
    }
    canSendMessage(state, member) {
        return this.hasAnyRole(state, member, ['member', 'moderator', 'admin', 'owner']);
    }
    canModerateMessages(state, member) {
        return this.hasAnyRole(state, member, ['moderator', 'admin', 'owner']);
    }
    canManageRoles(state, member) {
        return this.hasAnyRole(state, member, ['admin', 'owner']);
    }
    canDeleteChannel(state, member) {
        return this.hasAnyRole(state, member, ['owner']);
    }
    hasAnyRole(state, member, roles) {
        const set = new Set(this.rolesForMember(state, member));
        return roles.some((role) => set.has(role));
    }
}
exports.PermissionsService = PermissionsService;
