"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityRepository = void 0;
const prisma_client_1 = require("../storage/prisma.client");
class IdentityRepository {
    async getLocalIdentity() {
        let data = await prisma_client_1.prisma.localIdentity.findFirst();
        if (data) {
            let identity = {
                publicKey: data.publicKey,
                privateKey: data.privateKey,
                username: data.username,
                avatar: data.avatar,
                createdAt: data.createdAt,
            };
            return identity;
        }
        return undefined;
    }
    toDomain(data) {
        return {
            publicKey: data.publicKey,
            username: data.username ?? undefined,
            avatar: data.avatar ?? undefined,
            createdAt: data.updatedAt,
        };
    }
    async createOrUpdateLocalIdentity(identity) {
        const data = await prisma_client_1.prisma.localIdentity.upsert({
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
        // 🔥 converte NULL → UNDEFINED AQUI (infra resolve isso)
        return {
            publicKey: data.publicKey,
            privateKey: data.privateKey,
            username: data.username,
            avatar: data.avatar ?? undefined,
            createdAt: data.createdAt,
        };
    }
    async getIdentity(publicKey) {
        const data = await prisma_client_1.prisma.identity.findUnique({
            where: { publicKey },
        });
        if (!data)
            return null;
        return {
            publicKey: data.publicKey,
            username: data.username ?? undefined,
            avatar: data.avatar ?? undefined,
            createdAt: data.updatedAt,
        };
    }
    async getAllIdentities() {
        const data = await prisma_client_1.prisma.identity.findMany();
        return data.map(this.toDomain);
    }
}
exports.IdentityRepository = IdentityRepository;
