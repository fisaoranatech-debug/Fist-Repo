import { pairSchema, type PairResponse } from "@retrouve/shared";
import { generateDeviceToken, hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { clientIp, HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** L'app mobile échange le code à 6 chiffres contre un jeton secret d'appareil. */
export const POST = route(async (req) => {
  await rateLimit(`pair:${clientIp(req)}`, 10, 15 * 60_000);
  const input = await readJson(req, pairSchema);
  const pc = await prisma.pairingCode.findUnique({ where: { code: input.code } });
  if (!pc || pc.usedAt || pc.expiresAt < new Date() || !pc.deviceId) {
    throw new HttpError(400, "Code invalide ou expiré. Générez un nouveau code sur le site.");
  }
  const token = generateDeviceToken();
  const device = await prisma.$transaction(async (tx) => {
    const used = await tx.pairingCode.updateMany({
      where: { id: pc.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw new HttpError(400, "Ce code vient déjà d'être utilisé.");
    const current = await tx.device.findUniqueOrThrow({ where: { id: pc.deviceId! } });
    return tx.device.update({
      where: { id: current.id },
      data: {
        tokenHash: hashToken(token),
        pushToken: null,
        platform: input.platform ?? current.platform,
        osVersion: input.osVersion ?? current.osVersion,
        model: current.model || input.model || null,
        lastSeenAt: new Date(),
      },
    });
  });
  const body: PairResponse = { deviceId: device.id, token, name: device.name };
  return json(body, 201);
});
