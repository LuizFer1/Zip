import crypto from 'node:crypto';
import { Event } from '../model';
import { P2PTransport, TransportEnvelope } from '../network/transport';
import { EventSerializer } from '../protocol/event.serializer';
import { DuplicateEventError, EventService } from '../protocol/event.service';
import type { SyncBatchResult, SyncCursor } from './sync.service';

const DEFAULT_MAX_EVENTS_PER_SYNC_RESPONSE = 250;

interface GossipPublishPayload {
  event: string;
}

interface IncomingMessage {
  envelope: TransportEnvelope;
  nodeId?: string;
}

interface SyncRequestPayload {
  requestId: string;
  cursors: SyncCursor[];
  maxEvents?: number;
}

interface SyncResponsePayload {
  requestId: string;
  events: string[];
  more: boolean;
}

interface GossipSyncProvider {
  buildCursor(): Promise<SyncCursor[]>;
  collectMissingEvents(cursors: SyncCursor[], maxEvents: number): Promise<SyncBatchResult>;
}

export interface GossipMetrics {
  eventsBroadcast: number;
  eventsIngested: number;
  duplicateEventsIgnored: number;
  ingestFailures: number;
  syncRequestsSent: number;
  syncRequestsReceived: number;
  syncResponsesSent: number;
  syncResponsesReceived: number;
  syncEventsSent: number;
  syncEventsIngested: number;
  syncFailures: number;
}

export interface GossipServiceOptions {
  onEventIngested?: (event: Event) => Promise<void> | void;
  logger?: Pick<Console, 'warn' | 'info'>;
  sync?: GossipSyncProvider;
  maxEventsPerSyncResponse?: number;
}

export class GossipService {
  private running = false;
  private readonly logger: Pick<Console, 'warn' | 'info'>;
  private readonly maxEventsPerSyncResponse: number;
  private readonly metrics: GossipMetrics = {
    eventsBroadcast: 0,
    eventsIngested: 0,
    duplicateEventsIgnored: 0,
    ingestFailures: 0,
    syncRequestsSent: 0,
    syncRequestsReceived: 0,
    syncResponsesSent: 0,
    syncResponsesReceived: 0,
    syncEventsSent: 0,
    syncEventsIngested: 0,
    syncFailures: 0,
  };

  constructor(
    private readonly transport: P2PTransport,
    private readonly eventService: EventService,
    private readonly options: GossipServiceOptions = {},
  ) {
    this.logger = options.logger ?? console;
    this.maxEventsPerSyncResponse = Math.max(
      1,
      options.maxEventsPerSyncResponse ?? DEFAULT_MAX_EVENTS_PER_SYNC_RESPONSE,
    );
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
    this.metrics.eventsBroadcast += 1;
    this.transport.broadcast('event.publish', payload);
  }

  sendEventToNode(nodeId: string, event: Event): boolean {
    const payload: GossipPublishPayload = {
      event: EventSerializer.serialize(event),
    };
    return this.transport.sendToNode(nodeId, 'event.publish', payload);
  }

  syncEventsToNode(nodeId: string, events: Event[]): number {
    let sent = 0;
    for (const event of events) {
      if (this.sendEventToNode(nodeId, event)) {
        sent += 1;
      }
    }
    return sent;
  }

  async requestSyncFromPeer(nodeId: string, maxEvents?: number): Promise<void> {
    if (!this.options.sync) {
      return;
    }

    const cappedMaxEvents = Math.max(1, maxEvents ?? this.maxEventsPerSyncResponse);
    try {
      const requestId = crypto.randomUUID();
      const cursors = await this.options.sync.buildCursor();
      const payload: SyncRequestPayload = {
        requestId,
        cursors,
        maxEvents: cappedMaxEvents,
      };

      const sent = this.transport.sendToNode(nodeId, 'sync.request', payload);
      if (!sent) {
        return;
      }

      this.metrics.syncRequestsSent += 1;
      this.logger.info(`[gossip] sync request sent to ${nodeId} (${cursors.length} cursor(s))`);
    } catch (error) {
      this.metrics.syncFailures += 1;
      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[gossip] failed to request sync from ${nodeId}: ${details}`);
    }
  }

  snapshotMetrics(): GossipMetrics {
    return { ...this.metrics };
  }

  private readonly onMessage = (message: IncomingMessage): void => {
    void this.handleMessage(message);
  };

  private async handleMessage(message: IncomingMessage): Promise<void> {
    const envelope = message.envelope;
    switch (envelope.type) {
      case 'event.publish':
        await this.handlePublishedEvent(envelope);
        return;
      case 'sync.request':
        await this.handleSyncRequest(message);
        return;
      case 'sync.response':
        await this.handleSyncResponse(message);
        return;
      default:
        return;
    }
  }

  private async handlePublishedEvent(envelope: TransportEnvelope): Promise<void> {
    const serialized = this.readSerializedEvent(envelope.payload);
    if (!serialized) {
      return;
    }

    try {
      const event = await this.eventService.deserializeAndIngest(serialized);
      this.metrics.eventsIngested += 1;
      if (this.options.onEventIngested) {
        await this.options.onEventIngested(event);
      }
    } catch (error) {
      if (this.isDuplicateEventError(error)) {
        this.metrics.duplicateEventsIgnored += 1;
        return;
      }

      this.metrics.ingestFailures += 1;
      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[gossip] failed to ingest remote event: ${details}`);
    }
  }

  private async handleSyncRequest(message: IncomingMessage): Promise<void> {
    if (!this.options.sync || !message.nodeId) {
      return;
    }

    const payload = this.readSyncRequestPayload(message.envelope.payload);
    if (!payload) {
      return;
    }

    this.metrics.syncRequestsReceived += 1;
    const requestedMax = Math.max(1, payload.maxEvents ?? this.maxEventsPerSyncResponse);
    const responseMax = Math.min(requestedMax, this.maxEventsPerSyncResponse);

    try {
      const batch = await this.options.sync.collectMissingEvents(payload.cursors, responseMax);
      const serialized = batch.events.map((event) => EventSerializer.serialize(event));
      const response: SyncResponsePayload = {
        requestId: payload.requestId,
        events: serialized,
        more: batch.more,
      };

      const sent = this.transport.sendToNode(message.nodeId, 'sync.response', response);
      if (!sent) {
        return;
      }

      this.metrics.syncResponsesSent += 1;
      this.metrics.syncEventsSent += serialized.length;
      this.logger.info(
        `[gossip] sync response sent to ${message.nodeId} (${serialized.length} event(s), more=${batch.more})`,
      );
    } catch (error) {
      this.metrics.syncFailures += 1;
      const details = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[gossip] failed to prepare sync response: ${details}`);
    }
  }

  private async handleSyncResponse(message: IncomingMessage): Promise<void> {
    const payload = this.readSyncResponsePayload(message.envelope.payload);
    if (!payload) {
      return;
    }

    this.metrics.syncResponsesReceived += 1;

    for (const serialized of payload.events) {
      try {
        const event = await this.eventService.deserializeAndIngest(serialized);
        this.metrics.syncEventsIngested += 1;
        if (this.options.onEventIngested) {
          await this.options.onEventIngested(event);
        }
      } catch (error) {
        if (this.isDuplicateEventError(error)) {
          this.metrics.duplicateEventsIgnored += 1;
          continue;
        }

        this.metrics.syncFailures += 1;
        const details = error instanceof Error ? error.message : String(error);
        this.logger.warn(`[gossip] failed to ingest sync event: ${details}`);
      }
    }

    if (payload.more && message.nodeId) {
      await this.requestSyncFromPeer(message.nodeId, this.maxEventsPerSyncResponse);
    }
  }

  private readSerializedEvent(payload: unknown): string | null {
    if (!this.isRecord(payload)) {
      return null;
    }
    return typeof payload.event === 'string' ? payload.event : null;
  }

  private readSyncRequestPayload(payload: unknown): SyncRequestPayload | null {
    if (!this.isRecord(payload)) {
      return null;
    }

    if (typeof payload.requestId !== 'string' || !Array.isArray(payload.cursors)) {
      return null;
    }

    const cursors: SyncCursor[] = [];
    for (const entry of payload.cursors) {
      if (!this.isRecord(entry)) {
        return null;
      }
      if (
        typeof entry.channelId !== 'string'
        || typeof entry.lastEventId !== 'string'
        || typeof entry.lastTimestamp !== 'number'
      ) {
        return null;
      }
      cursors.push({
        channelId: entry.channelId,
        lastEventId: entry.lastEventId,
        lastTimestamp: entry.lastTimestamp,
      });
    }

    const maxEvents = typeof payload.maxEvents === 'number'
      ? Math.max(1, Math.trunc(payload.maxEvents))
      : undefined;

    return {
      requestId: payload.requestId,
      cursors,
      maxEvents,
    };
  }

  private readSyncResponsePayload(payload: unknown): SyncResponsePayload | null {
    if (!this.isRecord(payload)) {
      return null;
    }

    if (
      typeof payload.requestId !== 'string'
      || !Array.isArray(payload.events)
      || typeof payload.more !== 'boolean'
    ) {
      return null;
    }

    const events: string[] = [];
    for (const value of payload.events) {
      if (typeof value !== 'string') {
        return null;
      }
      events.push(value);
    }

    return {
      requestId: payload.requestId,
      events,
      more: payload.more,
    };
  }

  private isDuplicateEventError(error: unknown): boolean {
    if (error instanceof DuplicateEventError) {
      return true;
    }

    if (this.isRecord(error) && typeof error.code === 'string' && error.code === 'P2002') {
      return true;
    }

    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('Duplicate event id')
      || message.includes('DuplicateEventError')
      || message.includes('Unique constraint failed')
      || message.includes('UNIQUE constraint failed')
    );
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
