import { z } from "zod";
import { requireAgent } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { forbidden, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Le téléphone signale qu'il a été débloqué avec le bon code : fin du mode perdu. */
export const POST = route(async (req) => {
  const device = await requireAgent(req);
  await rateLimit(`unlock:${device.id}`, 10, 60 * 60_000);
  const { code } = await readJson(req, z.object({ code: z.string().regex(/^\d{6}$/) }));
  if (!device.lostMode || !device.unlockCode) return json({ ok: true, lostMode: false });
  if (!safeEqual(code, device.unlockCode)) throw forbidden("Code de déblocage incorrect.");
  await prisma.$transaction([
    prisma.device.update({ where: { id: device.id }, data: { lostMode: false, unlockCode: null } }),
    prisma.command.create({
      data: {
        deviceId: device.id,
        type: "LOST_MODE_OFF",
        status: "DONE",
        result: "Débloqué sur le téléphone avec le code",
      },
    }),
  ]);
  return json({ ok: true, lostMode: false });
});
