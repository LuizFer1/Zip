import { PrismaClient } from '@prisma/client';
import { Identity } from '../../../core/model';
import { IdentityRepository } from '../../../core/indentity/identity.repository';
import { prisma } from '../../../core/storage/prisma.client';
import { IdentityMapper } from './identity.mapper';

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async getLocalIdentity(): Promise<Identity | undefined> {
    const data = await this.db.localIdentity.findFirst();
    return data ? IdentityMapper.localToDomain(data) : undefined;
  }

  async createOrUpdateLocalIdentity(identity: Identity): Promise<Identity> {
    if (!identity.privateKey) {
      throw new Error('Local identity private key is required');
    }

    const data = await this.db.localIdentity.upsert({
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

    return IdentityMapper.localToDomain(data);
  }

  async getIdentity(publicKey: string): Promise<Identity | null> {
    const data = await this.db.identity.findUnique({
      where: { publicKey },
    });
    return data ? IdentityMapper.identityToDomain(data) : null;
  }

  async getAllIdentities(): Promise<Identity[]> {
    const data = await this.db.identity.findMany();
    return data.map((row) => IdentityMapper.identityToDomain(row));
  }
}
