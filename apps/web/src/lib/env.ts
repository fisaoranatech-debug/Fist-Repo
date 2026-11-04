/** Lecture centralisée de la configuration (compatible Node et Edge). */

let cachedSecret: { source: string; key: Uint8Array } | null = null;

/**
 * Clé de signature des sessions.
 * - AUTH_SECRET si elle est définie (recommandé) ;
 * - sinon, clé dérivée (SHA-256) de l'adresse secrète de la base de données, déjà présente
 *   sur Vercel avec Neon : le site démarre sans configuration supplémentaire, et la clé
 *   reste stable tant que le mot de passe de la base ne change pas.
 */
export async function authSecret(): Promise<Uint8Array> {
  const explicit = process.env.AUTH_SECRET;
  if (explicit && explicit.length >= 32) return new TextEncoder().encode(explicit);
  if (explicit) throw new Error("AUTH_SECRET trop court (32 caractères minimum).");

  const dbUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("AUTH_SECRET manquant (et aucune base de données pour en dériver une).");
  if (cachedSecret?.source === dbUrl) return cachedSecret.key;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`retrouve-session-v1:${dbUrl}`));
  const key = new Uint8Array(digest);
  cachedSecret = { source: dbUrl, key };
  return key;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export const isProduction = process.env.NODE_ENV === "production";
