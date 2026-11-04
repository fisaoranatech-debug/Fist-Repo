import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireCron } from "../auth";

/** Nettoyage quotidien : vie privée (positions anciennes) et données périmées. */
export const GET = route(async (req) => {
  requireCron(req);
  const days = (n: number) => new Date(Date.now() - n * 86_400_000);
  const retention = Number(process.env.LOCATION_RETENTION_DAYS) || 30;
  const [locations, alerts, expired, commands, codes, limits] = await prisma.$transaction([
    prisma.location.deleteMany({ where: { recordedAt: { lt: days(retention) } } }),
    prisma.alert.deleteMany({ where: { createdAt: { lt: days(90) } } }),
    prisma.command.updateMany({
      where: { status: { in: ["PENDING", "SENT"] }, createdAt: { lt: days(7) } },
      data: { status: "FAILED", result: "Expirée : l'appareil ne s'est pas connecté" },
    }),
    prisma.command.deleteMany({ where: { createdAt: { lt: days(60) } } }),
    prisma.pairingCode.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }),
  ]);
  return json({
    locations: locations.count,
    alerts: alerts.count,
    expiredCommands: expired.count,
    commands: commands.count,
    pairingCodes: codes.count,
    rateLimits: limits.count,
  });
});
