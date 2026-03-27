import type {
  Event,
  EventSigned,
  HashHex,
  EventStore,
  HeadStore,
} from "../../core/events/event.interfaces";

import type { EventSerializer } from "../../core/events/event.interfaces";
import type { EventValidator } from "../../core/events/event.interfaces";

import { createNode } from "../p2p/transport";

interface EventProtocolOptions {
    syncPeers: () => Promise<string>; //sincroniza os dados com os peers (ex: eventos recentes, heads atuais, etc)
    getHeads: () => string; //obtém os heads atuais do DAG
    broadcastEvent: (event: EventSigned) => Promise<void>; //envia o evento para os peers conectados
    receiveEvent: (event: EventSigned) => Promise<void>;// recebe e processa um evento vindo de um peer
}

// syncPeers() Acontece qunado a aplicação se conecta com sucesso a rede p2p sincorniza os dados com os peers (ex: eventos recentes, heads atuais, etc) recebe um array de eventos e os processa (valida, armazena, atualiza heads, repropaga para os peers, etc)

export class EventProtocol implements EventProtocolOptions {

    private Event: Event;
    private EventSigned: EventSigned;
    private eventHash: HashHex;

    public async syncPeers(): Promise<string[]> {
        // lógica para sincronizar com os peers (ex: buscar eventos recentes, heads atuais, etc)
        return [];
    }

    public async createEvent(chanelId:string, author: string, timestamp: number, type: string, payload: unknown, prev: string[]): Promise<void> {
        // lógica para criar um evento (sem id/assinatura)
        this.Event = {}
    }

    public async hashEvent(event: Event): Promise<void> {

    }

    public signEvent(event: Event): Promise<void> {

    }

    public validateEvent(event: EventSigned): boolean {
    
    }

    public async storeEvent(event: EventSigned): Promise<void> {

    }
    
    public async receiveEvent(event: EventSigned): Promise<void> {
        // validate (verifica estrutura, assinatura, etc)
        // store (guarda no EventStore)
        // update heads (atualiza o DAG)
        // broadcast (repropaga para os peers, exceto quem enviou)
    }
}