import { ed25519 } from "@noble/curves/ed25519";
import {randomBytes} from "crypto";

export function generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = ed25519.getPublicKey(privateKey);
    return { privateKey, publicKey };
}
