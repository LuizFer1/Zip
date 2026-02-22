import { EncryptionService } from './encryption.service';

export interface ChannelKeyVersion {
  keyId: string;
  key: string;
  rotatedAt: number;
}

export class KeyRotationService {
  constructor(private readonly encryption: EncryptionService = new EncryptionService()) {}

  createInitialKey(): ChannelKeyVersion {
    return {
      keyId: this.newKeyId(),
      key: this.encryption.generateKey(),
      rotatedAt: Date.now(),
    };
  }

  rotateKey(_current: ChannelKeyVersion): ChannelKeyVersion {
    return {
      keyId: this.newKeyId(),
      key: this.encryption.generateKey(),
      rotatedAt: Date.now(),
    };
  }

  private newKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
