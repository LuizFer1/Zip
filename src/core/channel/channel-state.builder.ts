import { Channel, DerivedChannelState, DerivedMessage, Event } from '../model';
import { EventSerializer } from '../protocol/event.serializer';

export class ChannelStateBuilder {
  build(channelId: string, events: Event[]): DerivedChannelState {
    const ordered = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const initial = this.resolveInitialChannel(channelId, ordered);
    const members = new Map<string, Set<string>>();
    const messages = new Map<string, DerivedMessage>();

    for (const event of ordered) {
      switch (event.type) {
        case 'channel.create': {
          this.ensureRole(members, event.author, 'owner');
          this.ensureRole(members, event.author, 'member');
          break;
        }
        case 'member.join': {
          const payload = this.readPayload<{ member: string }>(event);
          if (!payload || !payload.member) {
            break;
          }
          this.ensureRole(members, payload.member, 'member');
          break;
        }
        case 'member.leave': {
          const payload = this.readPayload<{ member: string }>(event);
          if (!payload || !payload.member) {
            break;
          }
          members.delete(payload.member);
          break;
        }
        case 'role.grant': {
          const payload = this.readPayload<{ member: string; role: string }>(event);
          if (!payload || !payload.member || !payload.role) {
            break;
          }
          this.ensureRole(members, payload.member, payload.role);
          break;
        }
        case 'role.revoke': {
          const payload = this.readPayload<{ member: string; role: string }>(event);
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
          const payload = this.readPayload<{ content: string }>(event);
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
          const payload = this.readPayload<{ targetEventId: string; newContent: string }>(event);
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
          const payload = this.readPayload<{ targetEventId: string }>(event);
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

    const roleMap = new Map<string, string[]>();
    for (const [member, roles] of members) {
      roleMap.set(member, [...roles].sort());
    }

    return {
      channel: initial,
      members: roleMap,
      messages: [...messages.values()].sort((a, b) => a.timestamp - b.timestamp),
    };
  }

  private resolveInitialChannel(channelId: string, events: Event[]): Channel {
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

  private ensureRole(container: Map<string, Set<string>>, member: string, role: string): void {
    const roles = container.get(member) ?? new Set<string>();
    roles.add(role);
    container.set(member, roles);
  }

  private readPayload<T>(event: Event): T | null {
    try {
      return EventSerializer.decodePayload<T>(event.payload);
    } catch {
      return null;
    }
  }
}
