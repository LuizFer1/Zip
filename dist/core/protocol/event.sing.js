"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSignerImpl = void 0;
const event_serializer_1 = require("./event.serializer");
const ed25519_1 = require("@noble/curves/ed25519");
class EventSignerImpl {
    sign(event, privateKey) {
        if (privateKey.length !== 32) {
            throw new TypeError('Invalid private key: expected 32 bytes for Ed25519');
        }
        // A assinatura precisa ser calculada sobre uma representação determinística.
        // Excluímos `signature` de propósito para evitar assinatura circular.
        const message = event_serializer_1.EventSerializer.canonicalBytes(event, false);
        const signatureBytes = ed25519_1.ed25519.sign(message, privateKey);
        return Buffer.from(signatureBytes).toString('hex');
    }
    verify(event, publicKey) {
        if (publicKey.length !== 32 || !event.signature) {
            return false;
        }
        const signatureBytes = this.hexToBytes(event.signature);
        if (signatureBytes === null) {
            return false;
        }
        // A verificação deve usar os mesmos bytes canônicos usados em `sign`.
        const message = event_serializer_1.EventSerializer.canonicalBytes(event, false);
        return ed25519_1.ed25519.verify(signatureBytes, message, publicKey);
    }
    hexToBytes(value) {
        const normalized = value.trim();
        if (!/^[0-9a-fA-F]{128}$/.test(normalized)) {
            return null;
        }
        return Uint8Array.from(Buffer.from(normalized, 'hex'));
    }
}
exports.EventSignerImpl = EventSignerImpl;
