/** Lecture centralisée de la configuration. */
export function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET manquant ou trop court (32 caractères minimum).");
  }
  return new TextEncoder().encode(secret);
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const isProduction = process.env.NODE_ENV === "production";
