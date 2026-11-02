import { safeEqual } from "@/lib/crypto";
import { HttpError } from "@/lib/http";

/** Vercel Cron envoie « Authorization: Bearer <CRON_SECRET> ». */
export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(header, `Bearer ${secret}`)) throw new HttpError(401, "Non autorisé.");
}
