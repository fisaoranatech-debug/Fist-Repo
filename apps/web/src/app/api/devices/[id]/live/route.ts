import { LIVE_WINDOW_MS } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { sendWakeUpPush } from "@/lib/push";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Suivi en direct : appelé régulièrement par la fiche de l'appareil tant qu'elle est ouverte.
 * L'appareil envoie alors sa position toutes les 15 s, puis revient à son rythme normal
 * 2 minutes après la fermeture de la page (économie de batterie).
 */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { device } = await requireDevice(id, user.id, "view");
  if (!device.tokenHash) return json({ live: false });
  const now = new Date();
  const wasLive = !!device.liveUntil && device.liveUntil > now;
  await prisma.device.update({ where: { id }, data: { liveUntil: new Date(now.getTime() + LIVE_WINDOW_MS) } });
  // Début du suivi : on réveille le téléphone pour qu'il accélère tout de suite.
  const wakeUp = wasLive ? "already" : await sendWakeUpPush(device, { kind: "live" });
  return json({ live: true, wakeUp });
});
