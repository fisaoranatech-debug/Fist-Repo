import { shareCreateSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, json, readJson, route } from "@/lib/http";
import { toShareDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "owner");
  const rows = await prisma.deviceShare.findMany({
    where: { deviceId: id },
    include: { user: { select: { email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return json(rows.map(toShareDTO));
});

/** Partage l'appareil avec un autre membre de la famille (qui doit avoir un compte). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "owner");
  const input = await readJson(req, shareCreateSchema);
  const target = await prisma.user.findUnique({ where: { email: input.email } });
  if (!target) throw new HttpError(404, "Aucun compte avec cet email. La personne doit d'abord s'inscrire.");
  if (target.id === user.id) throw new HttpError(400, "Vous êtes déjà propriétaire de cet appareil.");
  const share = await prisma.deviceShare.upsert({
    where: { deviceId_userId: { deviceId: id, userId: target.id } },
    create: { deviceId: id, userId: target.id, role: input.role },
    update: { role: input.role },
    include: { user: { select: { email: true, name: true } } },
  });
  return json(toShareDTO(share), 201);
});
