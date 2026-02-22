"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelService = void 0;
const channel_state_builder_1 = require("./channel-state.builder");
const permissions_service_1 = require("./permissions.service");
class ChannelService {
    constructor(stateBuilder = new channel_state_builder_1.ChannelStateBuilder(), permissions = new permissions_service_1.PermissionsService()) {
        this.stateBuilder = stateBuilder;
        this.permissions = permissions;
    }
    buildState(channelId, events) {
        return this.stateBuilder.build(channelId, events);
    }
    canSendMessage(channelId, events, member) {
        const state = this.buildState(channelId, events);
        return this.permissions.canSendMessage(state, member);
    }
    canManageRoles(channelId, events, member) {
        const state = this.buildState(channelId, events);
        return this.permissions.canManageRoles(state, member);
    }
    canModerateMessages(channelId, events, member) {
        const state = this.buildState(channelId, events);
        return this.permissions.canModerateMessages(state, member);
    }
}
exports.ChannelService = ChannelService;
