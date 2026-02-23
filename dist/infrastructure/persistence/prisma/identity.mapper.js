"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityMapper = void 0;
class IdentityMapper {
    static localToDomain(row) {
        return {
            publicKey: row.publicKey,
            privateKey: row.privateKey,
            username: row.username,
            avatar: row.avatar ?? null,
            createdAt: row.createdAt,
        };
    }
    static identityToDomain(row) {
        return {
            publicKey: row.publicKey,
            username: row.username ?? '',
            avatar: row.avatar ?? null,
            nodeId: row.nodeId ?? undefined,
            createdAt: row.updatedAt,
        };
    }
}
exports.IdentityMapper = IdentityMapper;
