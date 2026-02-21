import { Identity } from "../model";
import { IdentityRepository } from "./identity.repository";
import { generateKeyPair } from "./keypair";

export class IdentityService {
  private repository: IdentityRepository;

  constructor(repository: IdentityRepository) {
    this.repository = repository;
  }

  async loadLocalIdentity(): Promise<Identity | string | undefined> {
    const identity = this.repository.getLocalIdentity();

    if (identity === undefined) {
      return undefined; 
    }
    return identity;
  }

  async createLocalIdentity(
    username: string,
    avatar: string | null,
  ): Promise<Identity> {
    const { privateKey, publicKey } = generateKeyPair();

    const identity: Identity = {
      publicKey,
      privateKey,
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

  async getAllIdentities(): Promise<Identity[]> {
    return this.repository.getAllIdentities();
  }
}
