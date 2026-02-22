import {
  Event,
  EventSigner,
  EventType,
  EventValidator,
} from '../model';
import { EventSerializer } from './event.serializer';

const EVENT_TYPES: Set<EventType> = new Set<EventType>([
  'channel.create',
  'channel.update',
  'channel.delete',
  'member.join',
  'member.leave',
  'role.grant',
  'role.revoke',
  'message.create',
  'message.edit',
  'message.delete',
  'profile.update',
]);

const HEX_64 = /^[0-9a-fA-F]{64}$/;
const HEX_128 = /^[0-9a-fA-F]{128}$/;

type UnknownRecord = Record<string, unknown>;

export class EventValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventValidationError';
  }
}

export class SimpleEventValidator implements EventValidator {
  constructor(private readonly signer?: EventSigner) {}

  async validate(event: Event): Promise<void> {
    this.validateStructure(event);

    const payload = this.decodePayload(event.payload);
    this.validatePayloadByType(event.type, payload);

    if (this.signer) {
      const publicKey = this.hexToBytes(event.author);
      const isValidSignature = this.signer.verify(event, publicKey);
      if (!isValidSignature) {
        throw new EventValidationError('Invalid event signature');
      }
    }
  }

  private validateStructure(event: Event): void {
    if (!event || typeof event !== 'object') {
      throw new EventValidationError('Event must be an object');
    }

    this.assertNonEmptyString(event.id, 'id');
    this.assertNonEmptyString(event.channelId, 'channelId');
    this.assertHex(event.author, 'author', HEX_64);

    if (!Number.isInteger(event.timestamp) || event.timestamp <= 0) {
      throw new EventValidationError('Invalid "timestamp": expected a positive integer');
    }

    if (!EVENT_TYPES.has(event.type)) {
      throw new EventValidationError(`Unsupported event type: "${String(event.type)}"`);
    }

    if (!(event.payload instanceof Uint8Array) || event.payload.length === 0) {
      throw new EventValidationError('Invalid "payload": expected non-empty Uint8Array');
    }

    if (!this.isRecord(event.prev)) {
      throw new EventValidationError('Invalid "prev": expected object');
    }

    this.assertString(event.prev.id, 'prev.id');
    this.assertString(event.prev.hash, 'prev.hash');

    const hasPrevId = event.prev.id.trim().length > 0;
    const hasPrevHash = event.prev.hash.trim().length > 0;
    if (hasPrevId !== hasPrevHash) {
      throw new EventValidationError(
        'Invalid "prev": id and hash must both be present or both empty',
      );
    }

    this.assertString(event.signature, 'signature');
    if (event.signature.length > 0) {
      this.assertHex(event.signature, 'signature', HEX_128);
    }
  }

  private decodePayload(payload: Uint8Array): unknown {
    try {
      return EventSerializer.decodePayload<unknown>(payload);
    } catch {
      throw new EventValidationError('Invalid "payload": expected valid JSON');
    }
  }

  private validatePayloadByType(type: EventType, payload: unknown): void {
    const data = this.asRecord(payload, `payload for type "${type}"`);

    switch (type) {
      case 'channel.create':
        this.assertNonEmptyString(data.name, 'payload.name');
        if ('description' in data) {
          this.assertString(data.description, 'payload.description');
        }
        return;

      case 'channel.update': {
        const hasName = 'name' in data;
        const hasDescription = 'description' in data;
        if (!hasName && !hasDescription) {
          throw new EventValidationError(
            'Invalid payload for "channel.update": expected "name" or "description"',
          );
        }
        if (hasName) this.assertNonEmptyString(data.name, 'payload.name');
        if (hasDescription) this.assertString(data.description, 'payload.description');
        return;
      }

      case 'channel.delete':
        return;

      case 'member.join':
      case 'member.leave':
        this.assertNonEmptyString(data.member, 'payload.member');
        return;

      case 'role.grant':
      case 'role.revoke':
        this.assertNonEmptyString(data.member, 'payload.member');
        this.assertNonEmptyString(data.role, 'payload.role');
        return;

      case 'message.create':
        this.assertNonEmptyString(data.content, 'payload.content');
        return;

      case 'message.edit':
        this.assertNonEmptyString(data.targetEventId, 'payload.targetEventId');
        this.assertNonEmptyString(data.newContent, 'payload.newContent');
        return;

      case 'message.delete':
        this.assertNonEmptyString(data.targetEventId, 'payload.targetEventId');
        return;

      case 'profile.update': {
        const hasUsername = 'username' in data;
        const hasAvatar = 'avatar' in data;
        if (!hasUsername && !hasAvatar) {
          throw new EventValidationError(
            'Invalid payload for "profile.update": expected "username" or "avatar"',
          );
        }
        if (hasUsername) this.assertNonEmptyString(data.username, 'payload.username');
        if (hasAvatar) this.assertString(data.avatar, 'payload.avatar');
        return;
      }

      default:
        throw new EventValidationError(`Unsupported event type: "${String(type)}"`);
    }
  }

  private assertString(value: unknown, field: string): asserts value is string {
    if (typeof value !== 'string') {
      throw new EventValidationError(`Invalid "${field}": expected string`);
    }
  }

  private assertNonEmptyString(value: unknown, field: string): asserts value is string {
    this.assertString(value, field);
    if (value.trim().length === 0) {
      throw new EventValidationError(`Invalid "${field}": expected non-empty string`);
    }
  }

  private assertHex(value: unknown, field: string, pattern: RegExp): asserts value is string {
    this.assertString(value, field);
    if (!pattern.test(value)) {
      throw new EventValidationError(`Invalid "${field}": invalid hex format`);
    }
  }

  private asRecord(value: unknown, field: string): UnknownRecord {
    if (!this.isRecord(value)) {
      throw new EventValidationError(`Invalid "${field}": expected object`);
    }
    return value;
  }

  private isRecord(value: unknown): value is UnknownRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private hexToBytes(value: string): Uint8Array {
    return Uint8Array.from(Buffer.from(value, 'hex'));
  }
}
