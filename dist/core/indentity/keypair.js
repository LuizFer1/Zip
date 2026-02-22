"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyPair = generateKeyPair;
const ed25519_1 = require("@noble/curves/ed25519");
const crypto_1 = require("crypto");
const encrypt_1 = require("../utils/encrypt");
function generateKeyPair() {
    const privateKey = (0, crypto_1.randomBytes)(32);
    const publicKey = Buffer.from(ed25519_1.ed25519.getPublicKey(privateKey)).toString('hex');
    const encryptedPrivateKey = (0, encrypt_1.encryptPrivateKey)(privateKey);
    return { encryptedPrivateKey, publicKey };
}
