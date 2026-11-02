import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, json, notFound, route } from "@/lib/http";
import { toCommandDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string; cid: string }> };

/** Annule une commande qui n'a pas encore été exécutée par l'appareil. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id, cid } = await params;
  const { device } = await requireDevice(id, user.id, "control");
  const cmd = await prisma.command.findFirst({ where: { id: cid, deviceId: id } });
  if (!cmd) throw notFound("Commande");
  if (cmd.status !== "PENDING" && cmd.status !== "SENT") {
    throw new HttpError(409, "Cette commande a déjà été traitée par l'appareil.");
  }
  const updated = await prisma.$transaction(async (tx) => {
    // Annuler l'activation du mode perdu : l'état voulu redevient « pas perdu ».
    if (cmd.type === "LOST_MODE_ON" && device.lostMode) {
      await tx.device.update({ where: { id }, data: { lostMode: false } });
    }
    return tx.command.update({
      where: { id: cid },
      data: { status: "FAILED", result: "Annulée par l'utilisateur" },
    });
  });
  return json(toCommandDTO(updated));
});
