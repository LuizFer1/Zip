import { ed25519 } from '@noble/curves/ed25519';
import { randomBytes } from 'crypto';
import { encryptPrivateKey } from '../utils/encrypt';
export function generateKeyPair() {
    const privateKey = randomBytes(32);
    const publicKey = Buffer.from(ed25519.getPublicKey(privateKey)).toString('hex');

    const encryptedPrivateKey = encryptPrivateKey(privateKey);
    return { encryptedPrivateKey, publicKey };
}
