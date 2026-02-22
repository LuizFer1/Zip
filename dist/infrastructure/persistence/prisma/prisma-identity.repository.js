"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaIdentityRepository = void 0;
const prisma_client_1 = require("../../../core/storage/prisma.client");
const identity_mapper_1 = require("./identity.mapper");
class PrismaIdentityRepository {
    constructor(db = prisma_client_1.prisma) {
        this.db = db;
    }
    async getLocalIdentity() {
        const data = await this.db.localIdentity.findFirst();
        return data ? identity_mapper_1.IdentityMapper.localToDomain(data) : undefined;
    }
    async createOrUpdateLocalIdentity(identity) {
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
        return identity_mapper_1.IdentityMapper.localToDomain(data);
    }
    async getIdentity(publicKey) {
        const data = await this.db.identity.findUnique({
            where: { publicKey },
        });
        return data ? identity_mapper_1.IdentityMapper.identityToDomain(data) : null;
    }
    async getAllIdentities() {
        const data = await this.db.identity.findMany();
        return data.map((row) => identity_mapper_1.IdentityMapper.identityToDomain(row));
    }
}
exports.PrismaIdentityRepository = PrismaIdentityRepository;
