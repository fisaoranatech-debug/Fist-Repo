import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** Jeton secret remis à l'appareil lors de l'association. */
export function generateDeviceToken(): string {
  return "dev_" + randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generatePairingCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
