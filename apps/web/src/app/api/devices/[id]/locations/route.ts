import { locationQuerySchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";
import { toLocationDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "view");
  const url = new URL(req.url);
  const q = locationQuerySchema.parse(Object.fromEntries(url.searchParams));
  const from = q.from ?? new Date(Date.now() - 24 * 3600_000);
  const rows = await prisma.location.findMany({
    where: { deviceId: id, recordedAt: { gte: from, ...(q.to ? { lte: q.to } : {}) } },
    orderBy: { recordedAt: "desc" },
    take: q.limit,
  });
  return json(rows.reverse().map(toLocationDTO));
});
