"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GossipService = void 0;
const event_serializer_1 = require("../protocol/event.serializer");
class GossipService {
    constructor(transport, eventService, options = {}) {
        this.transport = transport;
        this.eventService = eventService;
        this.options = options;
        this.running = false;
        this.onMessage = (message) => {
            void this.handleMessage(message);
        };
        this.logger = options.logger ?? console;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.transport.on('message', this.onMessage);
    }
    stop() {
        if (!this.running) {
            return;
        }
        this.running = false;
        this.transport.off('message', this.onMessage);
    }
    broadcastEvent(event) {
        const payload = {
            event: event_serializer_1.EventSerializer.serialize(event),
        };
        this.transport.broadcast('event.publish', payload);
    }
    async handleMessage(message) {
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
        }
        catch (error) {
            if (this.isDuplicateEventError(error)) {
                return;
            }
            const details = error instanceof Error ? error.message : String(error);
            this.logger.warn(`[gossip] failed to ingest remote event: ${details}`);
        }
    }
    readSerializedEvent(payload) {
        if (!this.isRecord(payload)) {
            return null;
        }
        return typeof payload.event === 'string' ? payload.event : null;
    }
    isDuplicateEventError(error) {
        if (this.isRecord(error) && typeof error.code === 'string' && error.code === 'P2002') {
            return true;
        }
        const message = error instanceof Error ? error.message : String(error);
        return (message.includes('Unique constraint failed')
            || message.includes('UNIQUE constraint failed'));
    }
    isRecord(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }
}
exports.GossipService = GossipService;
