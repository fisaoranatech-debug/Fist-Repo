import { pairingCodeRequestSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { generatePairingCode } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";

const VALIDITY_MS = 10 * 60_000;

/** Crée un code à 6 chiffres que l'on saisit dans l'app mobile pour associer l'appareil. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { deviceId } = await readJson(req, pairingCodeRequestSchema);
  await requireDevice(deviceId, user.id, "owner");

  // Nettoyage : anciens codes expirés et codes non utilisés pour cet appareil.
  await prisma.pairingCode.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { deviceId, usedAt: null }] },
  });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const pc = await prisma.pairingCode.create({
        data: {
          code: generatePairingCode(),
          userId: user.id,
          deviceId,
          expiresAt: new Date(Date.now() + VALIDITY_MS),
        },
      });
      return json({ code: pc.code, expiresAt: pc.expiresAt.toISOString() }, 201);
    } catch (e) {
      // Code déjà utilisé par quelqu'un d'autre : on en tire un nouveau.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  throw new Error("Impossible de générer un code unique.");
});
