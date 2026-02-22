import { ed25519 } from "@noble/curves/ed25519.js";
import {randomBytes} from "crypto";
import { encryptPrivateKey, decryptPrivateKey } from "../utils/encrypt";
export function generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = ed25519.getPublicKey(privateKey);

    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    return { encryptedPrivateKey, publicKey };
}
