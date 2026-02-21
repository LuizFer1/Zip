"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateKeyPair = generateKeyPair;
const ed25519_1 = require("@noble/curves/ed25519");
const crypto_1 = require("crypto");
function generateKeyPair() {
    const privateKey = (0, crypto_1.randomBytes)(32);
    const publicKey = ed25519_1.ed25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
}
