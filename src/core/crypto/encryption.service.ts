import crypto from 'node:crypto';

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  tag: string;
}

export class EncryptionService {
  generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  encrypt(plaintext: Uint8Array | Buffer | string, hexKey: string): EncryptedPayload {
    const key = Buffer.from(hexKey, 'hex');
    if (key.length !== 32) {
      throw new Error('Invalid encryption key length: expected 32 bytes');
    }

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const input = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : Buffer.from(plaintext);
    const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(payload: EncryptedPayload, hexKey: string): Uint8Array {
    const key = Buffer.from(hexKey, 'hex');
    if (key.length !== 32) {
      throw new Error('Invalid encryption key length: expected 32 bytes');
    }

    const iv = Buffer.from(payload.iv, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');
    const ciphertext = Buffer.from(payload.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return Uint8Array.from(plaintext);
  }
}
