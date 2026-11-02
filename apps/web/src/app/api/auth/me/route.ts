import { profileUpdateSchema } from "@retrouve/shared";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json({ id: user.id, name: user.name, email: user.email, contactPhone: user.contactPhone });
});

export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const input = await readJson(req, profileUpdateSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
    },
  });
  return json({ id: updated.id, name: updated.name, email: updated.email, contactPhone: updated.contactPhone });
});
