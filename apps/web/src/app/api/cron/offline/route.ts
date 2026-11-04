import { createAlerts } from "@/lib/alerts";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { requireCron } from "../auth";

/** Crée une alerte pour chaque appareil associé muet depuis plus de 24 h. */
export const GET = route(async (req) => {
  requireCron(req);
  const limit = new Date(Date.now() - 24 * 3600_000);
  const silent = await prisma.device.findMany({
    where: { tokenHash: { not: null }, lastSeenAt: { lt: limit }, offlineAlertedAt: null },
    select: { id: true, lastSeenAt: true },
  });
  for (const d of silent) {
    await prisma.device.update({ where: { id: d.id }, data: { offlineAlertedAt: new Date() } });
    await createAlerts([{ deviceId: d.id, type: "OFFLINE", data: { lastSeenAt: d.lastSeenAt?.toISOString() ?? null } }]);
  }
  return json({ alerted: silent.length });
});
