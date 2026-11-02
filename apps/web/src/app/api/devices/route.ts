import { deviceCreateSchema } from "@retrouve/shared";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accessibleDevices, lastLocations } from "@/lib/devices";
import { HttpError, json, readJson, route } from "@/lib/http";
import { toDeviceDTO } from "@/lib/serialize";

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const list = await accessibleDevices(user.id);
  const last = await lastLocations(list.map((d) => d.device.id));
  return json(list.map(({ device, access }) => toDeviceDTO(device, access, last.get(device.id) ?? null)));
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const input = await readJson(req, deviceCreateSchema);
  const count = await prisma.device.count({ where: { userId: user.id } });
  if (count >= 50) throw new HttpError(400, "Limite de 50 appareils atteinte.");
  const device = await prisma.device.create({
    data: {
      userId: user.id,
      name: input.name,
      type: input.type,
      model: input.model || null,
      imei: input.imei || null,
      simNumber: input.simNumber || null,
    },
    include: { user: { select: { name: true } } },
  });
  return json(toDeviceDTO(device, "OWNER", null), 201);
});
