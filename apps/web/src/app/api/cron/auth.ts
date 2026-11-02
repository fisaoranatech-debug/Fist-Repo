import { safeEqual } from "@/lib/crypto";
import { HttpError } from "@/lib/http";

/**
 * Protège les tâches planifiées.
 * - Avec CRON_SECRET : Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> » (recommandé).
 * - Sans CRON_SECRET : on accepte les appels du planificateur Vercel (en-tête user-agent
 *   « vercel-cron »). Ces tâches sont sans danger si elles sont déclenchées par quelqu'un
 *   d'autre : elles ne font que supprimer des données expirées et signaler les appareils muets.
 */
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") ?? "";
    if (!safeEqual(header, `Bearer ${secret}`)) throw new HttpError(401, "Non autorisé.");
    return;
  }
  const ua = req.headers.get("user-agent") ?? "";
  if (!process.env.VERCEL || !ua.startsWith("vercel-cron/")) throw new HttpError(401, "Non autorisé.");
}
