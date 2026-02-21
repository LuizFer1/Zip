import { Identity } from "../model";
import { prisma } from "../storage/prisma.client";

export class IdentityRepository {
  async getLocalIdentity(): Promise<Identity | undefined> {
    const data = await prisma.localIdentity.findFirst();
    if (data) {
      const identity: Identity = {
        publicKey: data.publicKey,
        privateKey: data.privateKey,
        username: data.username,
        avatar: data.avatar ?? null,
        createdAt: data.createdAt,
      };
      return identity;
    }
    return undefined;
  }

  private toDomain(data: any): Identity {
    return {
      publicKey: data.publicKey,
      username: data.username ?? '',
      avatar: data.avatar ?? null,
      createdAt: data.updatedAt,
    };
  }

  async createOrUpdateLocalIdentity(identity: Identity): Promise<Identity> {
    const data = await prisma.localIdentity.upsert({
      where: { id: 1 },
      update: {
        privateKey: identity.privateKey,
        username: identity.username,
        avatar: identity.avatar ?? null,
        createdAt: identity.createdAt,
        publicKey: identity.publicKey,
      },
      create: {
        id: 1,
        publicKey: identity.publicKey,
        privateKey: identity.privateKey,
        username: identity.username,
        avatar: identity.avatar ?? null,
        createdAt: identity.createdAt,
      },
    });
    return {
      publicKey: data.publicKey,
      privateKey: data.privateKey,
      username: data.username,
      avatar: data.avatar ?? null,
      createdAt: data.createdAt,
    };
  }

  async getIdentity(publicKey: string): Promise<Identity | null> {
    const data = await prisma.identity.findUnique({
      where: { publicKey },
    });

    if (!data) return null;

    return {
      publicKey: data.publicKey,
      username: data.username ?? '',
      avatar: data.avatar ?? null,
      createdAt: data.updatedAt,
    };
  }

  async getAllIdentities(): Promise<Identity[]> {
    const data = await prisma.identity.findMany();
    return data.map((d) => this.toDomain(d));
  }
}
