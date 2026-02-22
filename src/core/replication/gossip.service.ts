import { Event } from '../model';
import { P2PTransport, TransportEnvelope } from '../network/transport';
import { EventSerializer } from '../protocol/event.serializer';
import { EventService } from '../protocol/event.service';

interface GossipPublishPayload {
  event: string;
}

interface IncomingMessage {
  envelope: TransportEnvelope;
}

export interface GossipServiceOptions {
  onEventIngested?: (event: Event) => Promise<void> | void;
  logger?: Pick<Console, 'warn'>;
}

export class GossipService {
  private running = false;
  private readonly logger: Pick<Console, 'warn'>;

  constructor(
    private readonly transport: P2PTransport,
    private readonly eventService: EventService,
    private readonly options: GossipServiceOptions = {},
  ) {
    this.logger = options.logger ?? console;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.transport.on('message', this.onMessage);
  }

  stop(): void {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.transport.off('message', this.onMessage);
  }

  broadcastEvent(event: Event): void {
    const payload: GossipPublishPayload = {
      event: EventSerializer.serialize(event),
    };
    this.transport.broadcast('event.publish', payload);
  }

  private readonly onMessage = (message: IncomingMessage): void => {
    void this.handleMessage(message);
  };

  private async handleMessage(message: IncomingMessage): Promise<void> {
    const envelope = message.envelope;
    if (envelope.type !== 'event.publish') {
      return;
    }

    const serialized = this.readSerializedEvent(envelope.payload);
    if (!serialized) {
      return;
    }

    try {
      const event = await this.eventService.deserializeAndIngest(serialized);
      if (this.options.onEventIngested) {
        await this.options.onEventIngested(event);
      }
    } catch (error) {
      if (this.isDuplicateEventError(error)) {
        return;
      }

      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[gossip] failed to ingest remote event: ${details}`);
    }
  }

  private readSerializedEvent(payload: unknown): string | null {
    if (!this.isRecord(payload)) {
      return null;
    }
    return typeof payload.event === 'string' ? payload.event : null;
  }

  private isDuplicateEventError(error: unknown): boolean {
    if (this.isRecord(error) && typeof error.code === 'string' && error.code === 'P2002') {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Unique constraint failed')
      || message.includes('UNIQUE constraint failed')
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
