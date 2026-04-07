import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): { ciphertext: string; iv: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decrypt(ciphertext: string, iv: string): string {
  const data = Buffer.from(ciphertext, "base64");
  const enc = data.subarray(0, data.length - 16);
  const tag = data.subarray(data.length - 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
