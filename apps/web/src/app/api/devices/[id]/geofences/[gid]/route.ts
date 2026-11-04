import { geofenceSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, notFound, readJson, route } from "@/lib/http";
import { toGeofenceDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string; gid: string }> };

async function load(req: Request, params: Ctx["params"]) {
  const user = await requireUser(req);
  const { id, gid } = await params;
  await requireDevice(id, user.id, "control");
  const g = await prisma.geofence.findFirst({ where: { id: gid, deviceId: id } });
  if (!g) throw notFound("Zone");
  return g;
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const g = await load(req, params);
  const input = await readJson(req, geofenceSchema.partial());
  const moved = input.lat !== undefined || input.lng !== undefined || input.radiusM !== undefined;
  const updated = await prisma.geofence.update({
    where: { id: g.id },
    data: { ...input, ...(moved ? { inside: null } : {}) },
  });
  return json(toGeofenceDTO(updated));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const g = await load(req, params);
  await prisma.geofence.delete({ where: { id: g.id } });
  return json({ ok: true });
});
