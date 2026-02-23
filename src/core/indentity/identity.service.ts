import { Identity } from "../model";
import { IdentityRepository } from "./identity.repository";
import { generateKeyPair } from "./keypair";
import { decryptPrivateKey } from "../utils/encrypt";

interface EncryptedPrivateKey {
  encrypted: string;
  iv: string;
  tag: string;
  salt?: string;
}

export class IdentityService {
  private repository: IdentityRepository;

  constructor(repository: IdentityRepository) {
    this.repository = repository;
  }

  async loadLocalIdentity(): Promise<Identity | undefined> {
    return this.repository.getLocalIdentity();
  }

  async createLocalIdentity(
    username: string,
    avatar: string | null,
  ): Promise<Identity> {
    const { encryptedPrivateKey, publicKey } = generateKeyPair();

    const identity: Identity = {
      publicKey,
      privateKey: JSON.stringify(encryptedPrivateKey),
      username,
      avatar,
      createdAt: Date.now(),
    };

    return await this.repository.createOrUpdateLocalIdentity(identity);
  }

  async UpdateLocalIdentity(
    username: string,
    avatar: string | null,
  ): Promise<Identity | string> {
    const existingIdentity = await this.repository.getLocalIdentity();
    if (!existingIdentity) {
      return "No local identity found";
    }
    const updatedIdentity: Identity = {
      ...existingIdentity,
      username,
      avatar,
    };
    await this.repository.createOrUpdateLocalIdentity(updatedIdentity);
    return updatedIdentity;
  }

  async getIdentity(publicKey: string): Promise<Identity | null> {
    return this.repository.getIdentity(publicKey);
  }

  async createOrUpdateIdentity(identity: Identity): Promise<Identity> {
    return this.repository.createOrUpdateIdentity(identity);
  }

  async getAllIdentities(): Promise<Identity[]> {
    return this.repository.getAllIdentities();
  }

  async getLocalPrivateKey(): Promise<Uint8Array> {
    const identity = await this.repository.getLocalIdentity();
    if (!identity?.privateKey || typeof identity.privateKey !== 'string') {
      throw new Error('No local private key found');
    }

    const encrypted = this.parseEncryptedPrivateKey(identity.privateKey);
    const privateKey = decryptPrivateKey(encrypted);
    return Uint8Array.from(privateKey);
  }

  private parseEncryptedPrivateKey(serialized: string): EncryptedPrivateKey {
    const parsed = JSON.parse(serialized) as Partial<EncryptedPrivateKey>;

    if (
      typeof parsed.encrypted !== 'string'
      || typeof parsed.iv !== 'string'
      || typeof parsed.tag !== 'string'
    ) {
      throw new Error('Invalid encrypted private key format');
    }

    return {
      encrypted: parsed.encrypted,
      iv: parsed.iv,
      tag: parsed.tag,
      salt: parsed.salt,
    };
  }
}
