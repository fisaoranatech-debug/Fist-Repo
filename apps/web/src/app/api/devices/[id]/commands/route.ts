import { commandCreateSchema } from "@retrouve/shared";
import { requireDevice, requireUser } from "@/lib/auth";
import { createCommand } from "@/lib/commands";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";
import { toCommandDTO } from "@/lib/serialize";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  await requireDevice(id, user.id, "view");
  const rows = await prisma.command.findMany({
    where: { deviceId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return json(rows.map(toCommandDTO));
});

export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { device } = await requireDevice(id, user.id, "control");
  const input = await readJson(req, commandCreateSchema);
  const { command, wakeUp, unlockCode } = await createCommand(device, user, input);
  return json({ ...toCommandDTO(command), wakeUp, unlockCode }, 201);
});
