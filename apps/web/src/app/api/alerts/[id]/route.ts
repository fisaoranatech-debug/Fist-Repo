import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, notFound, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const alert = await prisma.alert.findUnique({ where: { id }, select: { deviceId: true } });
  if (!alert) throw notFound("Alerte");
  await requireDevice(alert.deviceId, user.id, "view");
  await prisma.alert.update({ where: { id }, data: { readAt: new Date() } });
  return json({ ok: true });
});
