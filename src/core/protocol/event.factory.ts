import { Event, EventType, EventRef} from '../model';

export class EventFactory {
    static create<T>(channelId: string, author: string, type: EventType, payload: string, prev: EventRef, signature: string = ""): Event {
        const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
        const event: Event = {
            id: crypto.randomUUID(),
            channelId,
            author,
            timestamp: Date.now(),
            type,
            payload: payloadBytes,
            prev,
            signature,
        };
        return event;   
    }
}