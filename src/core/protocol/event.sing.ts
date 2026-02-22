import { Event, EventSigner } from '../model';
import { EventSerializer } from './event.serializer';
import { ed25519 } from '@noble/curves/ed25519';

export class EventSignerImpl implements EventSigner {
  sign(event: Event, privateKey: Uint8Array): string {
    if (privateKey.length !== 32) {
      throw new TypeError('Invalid private key: expected 32 bytes for Ed25519');
    }

    // A assinatura precisa ser calculada sobre uma representação determinística.
    // Excluímos `signature` de propósito para evitar assinatura circular.
    const message = EventSerializer.canonicalBytes(event, false);
    const signatureBytes = ed25519.sign(message, privateKey);

    return Buffer.from(signatureBytes).toString('hex');
  }

  verify(event: Event, publicKey: Uint8Array): boolean {
    if (publicKey.length !== 32 || !event.signature) {
      return false;
    }

    const signatureBytes = this.hexToBytes(event.signature);
    if (signatureBytes === null) {
      return false;
    }

    // A verificação deve usar os mesmos bytes canônicos usados em `sign`.
    const message = EventSerializer.canonicalBytes(event, false);
    return ed25519.verify(signatureBytes, message, publicKey);
  }

  private hexToBytes(value: string): Uint8Array | null {
    const normalized = value.trim();
    if (!/^[0-9a-fA-F]{128}$/.test(normalized)) {
      return null;
    }
    return Uint8Array.from(Buffer.from(normalized, 'hex'));
  }
}
