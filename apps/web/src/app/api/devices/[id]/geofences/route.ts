import { geofenceSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, json, readJson, route } from "@/lib/http";
import { toGeofenceDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "view");
  const rows = await prisma.geofence.findMany({ where: { deviceId: id }, orderBy: { createdAt: "asc" } });
  return json(rows.map(toGeofenceDTO));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "control");
  const input = await readJson(req, geofenceSchema);
  if ((await prisma.geofence.count({ where: { deviceId: id } })) >= 20) {
    throw new HttpError(400, "20 zones maximum par appareil.");
  }
  const g = await prisma.geofence.create({ data: { ...input, deviceId: id } });
  return json(toGeofenceDTO(g), 201);
});
