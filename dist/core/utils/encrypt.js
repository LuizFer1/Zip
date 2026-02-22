"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPrivateKey = encryptPrivateKey;
exports.decryptPrivateKey = decryptPrivateKey;
const crypto_1 = __importDefault(require("crypto"));
const ALGO = "aes-256-gcm";
function getEncryptionKey() {
    const secret = process.env.ENCRYPTION_KEY;
    if (!secret) {
        throw new Error("ENCRYPTION_KEY não definida");
    }
    return crypto_1.default.scryptSync(secret, "key-derivation-salt", 32);
}
function encryptPrivateKey(privateKey) {
    const salt = crypto_1.default.randomBytes(16);
    const iv = crypto_1.default.randomBytes(12);
    const key = getEncryptionKey();
    const cipher = crypto_1.default.createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
        encrypted: encrypted.toString("hex"),
        iv: iv.toString("hex"),
        salt: salt.toString("hex"),
        tag: tag.toString("hex"),
    };
}
function decryptPrivateKey(data) {
    const key = getEncryptionKey();
    const decipher = crypto_1.default.createDecipheriv(ALGO, key, Buffer.from(data.iv, "hex"));
    decipher.setAuthTag(Buffer.from(data.tag, "hex"));
    return Buffer.concat([
        decipher.update(Buffer.from(data.encrypted, "hex")),
        decipher.final(),
    ]);
}
