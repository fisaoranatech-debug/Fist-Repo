import { prisma } from "./db";
import { HttpError } from "./http";

/**
 * Limite le nombre de tentatives par clé sur une fenêtre de temps.
 * Stocké en base pour fonctionner aussi en serverless (plusieurs instances).
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (row && row.count > limit) {
    const minutes = Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 60000));
    throw new HttpError(429, `Trop de tentatives. Réessayez dans ${minutes} min.`);
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
