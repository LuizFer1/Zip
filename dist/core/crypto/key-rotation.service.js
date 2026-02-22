"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeyRotationService = void 0;
const encryption_service_1 = require("./encryption.service");
class KeyRotationService {
    constructor(encryption = new encryption_service_1.EncryptionService()) {
        this.encryption = encryption;
    }
    createInitialKey() {
        return {
            keyId: this.newKeyId(),
            key: this.encryption.generateKey(),
            rotatedAt: Date.now(),
        };
    }
    rotateKey(_current) {
        return {
            keyId: this.newKeyId(),
            key: this.encryption.generateKey(),
            rotatedAt: Date.now(),
        };
    }
    newKeyId() {
        return `key_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }
}
exports.KeyRotationService = KeyRotationService;
