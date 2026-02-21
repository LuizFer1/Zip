"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityService = void 0;
const keypair_1 = require("./keypair");
class IdentityService {
    constructor(repository) {
        this.repository = repository;
    }
    async loadLocalIdentity() {
        const identity = this.repository.getLocalIdentity();
        if (identity === undefined) {
            return "No local identity found";
        }
        return identity;
    }
    async createLocalIdentity(username, avatar) {
        const { privateKey, publicKey } = (0, keypair_1.generateKeyPair)();
        const identity = {
            publicKey,
            privateKey,
            username,
            avatar,
            createdAt: Date.now(),
        };
        return await this.repository.createOrUpdateLocalIdentity(identity);
    }
    async UpdateLocalIdentity(username, avatar) {
        const existingIdentity = await this.repository.getLocalIdentity();
        if (!existingIdentity) {
            return "No local identity found";
        }
        const updatedIdentity = {
            ...existingIdentity,
            username,
            avatar,
        };
        await this.repository.createOrUpdateLocalIdentity(updatedIdentity);
        return updatedIdentity;
    }
    async getIdentity(publicKey) {
        return this.repository.getIdentity(publicKey);
    }
    async getAllIdentities() {
        return this.repository.getAllIdentities();
    }
}
exports.IdentityService = IdentityService;
