import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string; sid: string }> };

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id, sid } = await params;
  const share = await prisma.deviceShare.findFirst({ where: { id: sid, deviceId: id } });
  if (!share) throw notFound("Partage");
  // Le propriétaire peut retirer un partage ; la personne invitée peut se retirer elle-même.
  if (share.userId !== user.id) await requireDevice(id, user.id, "owner");
  await prisma.deviceShare.delete({ where: { id: sid } });
  return json({ ok: true });
});
