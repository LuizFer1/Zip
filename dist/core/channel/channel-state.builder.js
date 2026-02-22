"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChannelStateBuilder = void 0;
const event_serializer_1 = require("../protocol/event.serializer");
class ChannelStateBuilder {
    build(channelId, events) {
        const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
        const initial = this.resolveInitialChannel(channelId, ordered);
        const members = new Map();
        const messages = new Map();
        for (const event of ordered) {
            switch (event.type) {
                case 'channel.create': {
                    this.ensureRole(members, event.author, 'owner');
                    this.ensureRole(members, event.author, 'member');
                    break;
                }
                case 'member.join': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.member) {
                        break;
                    }
                    this.ensureRole(members, payload.member, 'member');
                    break;
                }
                case 'member.leave': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.member) {
                        break;
                    }
                    members.delete(payload.member);
                    break;
                }
                case 'role.grant': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.member || !payload.role) {
                        break;
                    }
                    this.ensureRole(members, payload.member, payload.role);
                    break;
                }
                case 'role.revoke': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.member || !payload.role) {
                        break;
                    }
                    const existing = members.get(payload.member);
                    if (existing) {
                        existing.delete(payload.role);
                        if (existing.size === 0) {
                            members.delete(payload.member);
                        }
                    }
                    break;
                }
                case 'message.create': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.content) {
                        break;
                    }
                    messages.set(event.id, {
                        id: event.id,
                        author: event.author,
                        content: payload.content,
                        timestamp: event.timestamp,
                        edited: false,
                        deleted: false,
                    });
                    break;
                }
                case 'message.edit': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.targetEventId || !payload.newContent) {
                        break;
                    }
                    const target = messages.get(payload.targetEventId);
                    if (target) {
                        messages.set(payload.targetEventId, {
                            ...target,
                            content: payload.newContent,
                            edited: true,
                        });
                    }
                    break;
                }
                case 'message.delete': {
                    const payload = this.readPayload(event);
                    if (!payload || !payload.targetEventId) {
                        break;
                    }
                    const target = messages.get(payload.targetEventId);
                    if (target) {
                        messages.set(payload.targetEventId, {
                            ...target,
                            deleted: true,
                        });
                    }
                    break;
                }
                default:
                    break;
            }
        }
        const roleMap = new Map();
        for (const [member, roles] of members) {
            roleMap.set(member, [...roles].sort());
        }
        return {
            channel: initial,
            members: roleMap,
            messages: [...messages.values()].sort((a, b) => a.timestamp - b.timestamp),
        };
    }
    resolveInitialChannel(channelId, events) {
        const created = events.find((event) => event.type === 'channel.create');
        if (!created) {
            return {
                id: channelId,
                creator: '',
                createdAt: 0,
            };
        }
        return {
            id: channelId,
            creator: created.author,
            createdAt: created.timestamp,
        };
    }
    ensureRole(container, member, role) {
        const roles = container.get(member) ?? new Set();
        roles.add(role);
        container.set(member, roles);
    }
    readPayload(event) {
        try {
            return event_serializer_1.EventSerializer.decodePayload(event.payload);
        }
        catch {
            return null;
        }
    }
}
exports.ChannelStateBuilder = ChannelStateBuilder;
