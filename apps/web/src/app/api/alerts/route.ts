import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessibleDeviceIds } from "@/lib/devices";
import { json, route } from "@/lib/http";
import { toAlertDTO } from "@/lib/serialize";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const url = new URL(req.url);
  const unreadOnly = url.searchParams.get("unread") === "1";
  const deviceId = url.searchParams.get("deviceId");
  let ids = await accessibleDeviceIds(user.id);
  if (deviceId) ids = ids.filter((id) => id === deviceId);
  const rows = await prisma.alert.findMany({
    where: { deviceId: { in: ids }, ...(unreadOnly ? { readAt: null } : {}) },
    omit: { photo: true },
    include: { device: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const withPhoto = new Set(
    (
      await prisma.alert.findMany({
        where: { id: { in: rows.map((r) => r.id) }, photo: { not: null } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );
  return json(rows.map((r) => toAlertDTO({ ...r, hasPhoto: withPhoto.has(r.id) })));
});

/** Marque toutes les alertes comme lues. */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const ids = await accessibleDeviceIds(user.id);
  const r = await prisma.alert.updateMany({
    where: { deviceId: { in: ids }, readAt: null },
    data: { readAt: new Date() },
  });
  return json({ updated: r.count });
});
