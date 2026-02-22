import crypto from "crypto";
const ALGO = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;

  if (!secret) {
    throw new Error("ENCRYPTION_KEY não definida");
  }

  return crypto.scryptSync(secret, "key-derivation-salt", 32);
}

export function encryptPrivateKey(privateKey: Buffer) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);

  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    salt: salt.toString("hex"),
    tag: tag.toString("hex"),
  };
}

export function decryptPrivateKey(data: {
  encrypted: string;
  iv: string;
  tag: string;
}) {
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGO,
    key,
    Buffer.from(data.iv, "hex")
  );

  decipher.setAuthTag(Buffer.from(data.tag, "hex"));

  return Buffer.concat([
    decipher.update(Buffer.from(data.encrypted, "hex")),
    decipher.final(),
  ]);
}