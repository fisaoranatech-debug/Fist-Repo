import { deviceUpdateSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lastLocations } from "@/lib/devices";
import { json, readJson, route } from "@/lib/http";
import { toDeviceDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { access } = await requireDevice(id, user.id, "view");
  const device = await prisma.device.findUniqueOrThrow({
    where: { id },
    include: { user: { select: { name: true } } },
  });
  const last = await lastLocations([id]);
  return json(toDeviceDTO(device, access, last.get(id) ?? null));
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "owner");
  const input = await readJson(req, deviceUpdateSchema);
  const device = await prisma.device.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.model !== undefined ? { model: input.model || null } : {}),
      ...(input.imei !== undefined ? { imei: input.imei || null } : {}),
      ...(input.simNumber !== undefined ? { simNumber: input.simNumber || null } : {}),
      ...(input.lostMessage !== undefined ? { lostMessage: input.lostMessage || null } : {}),
      ...(input.smsSecret !== undefined ? { smsSecret: input.smsSecret || null } : {}),
      ...(input.trackingIntervalSec !== undefined ? { trackingIntervalSec: input.trackingIntervalSec } : {}),
    },
    include: { user: { select: { name: true } } },
  });
  const last = await lastLocations([id]);
  return json(toDeviceDTO(device, "OWNER", last.get(id) ?? null));
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "owner");
  await prisma.device.delete({ where: { id } });
  return json({ ok: true });
});
