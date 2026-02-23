"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentityService = void 0;
const keypair_1 = require("./keypair");
const encrypt_1 = require("../utils/encrypt");
class IdentityService {
    constructor(repository) {
        this.repository = repository;
    }
    async loadLocalIdentity() {
        return this.repository.getLocalIdentity();
    }
    async createLocalIdentity(username, avatar) {
        const { encryptedPrivateKey, publicKey } = (0, keypair_1.generateKeyPair)();
        const identity = {
            publicKey,
            privateKey: JSON.stringify(encryptedPrivateKey),
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
    async createOrUpdateIdentity(identity) {
        return this.repository.createOrUpdateIdentity(identity);
    }
    async getAllIdentities() {
        return this.repository.getAllIdentities();
    }
    async getLocalPrivateKey() {
        const identity = await this.repository.getLocalIdentity();
        if (!identity?.privateKey || typeof identity.privateKey !== 'string') {
            throw new Error('No local private key found');
        }
        const encrypted = this.parseEncryptedPrivateKey(identity.privateKey);
        const privateKey = (0, encrypt_1.decryptPrivateKey)(encrypted);
        return Uint8Array.from(privateKey);
    }
    parseEncryptedPrivateKey(serialized) {
        const parsed = JSON.parse(serialized);
        if (typeof parsed.encrypted !== 'string'
            || typeof parsed.iv !== 'string'
            || typeof parsed.tag !== 'string') {
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
exports.IdentityService = IdentityService;
