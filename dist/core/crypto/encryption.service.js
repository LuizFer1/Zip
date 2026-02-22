"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class EncryptionService {
    generateKey() {
        return node_crypto_1.default.randomBytes(32).toString('hex');
    }
    encrypt(plaintext, hexKey) {
        const key = Buffer.from(hexKey, 'hex');
        if (key.length !== 32) {
            throw new Error('Invalid encryption key length: expected 32 bytes');
        }
        const iv = node_crypto_1.default.randomBytes(12);
        const cipher = node_crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
        const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : Buffer.from(plaintext);
        const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            ciphertext: ciphertext.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
        };
    }
    decrypt(payload, hexKey) {
        const key = Buffer.from(hexKey, 'hex');
        if (key.length !== 32) {
            throw new Error('Invalid encryption key length: expected 32 bytes');
        }
        const iv = Buffer.from(payload.iv, 'base64');
        const tag = Buffer.from(payload.tag, 'base64');
        const ciphertext = Buffer.from(payload.ciphertext, 'base64');
        const decipher = node_crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
        return Uint8Array.from(plaintext);
    }
}
exports.EncryptionService = EncryptionService;
