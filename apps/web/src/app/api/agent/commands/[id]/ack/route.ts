import { commandAckSchema } from "@retrouve/shared";
import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, notFound, readJson, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route<Ctx>(async (req, { params }) => {
  const device = await requireAgent(req);
  const { id } = await params;
  const input = await readJson(req, commandAckSchema);
  const cmd = await prisma.command.findFirst({ where: { id, deviceId: device.id } });
  if (!cmd) throw notFound("Commande");
  // Une commande terminée ne revient pas en arrière.
  if (cmd.status === "DONE" || cmd.status === "FAILED") return json({ ok: true, status: cmd.status });
  const updated = await prisma.command.update({
    where: { id },
    data: { status: input.status, result: input.result ?? null },
  });
  return json({ ok: true, status: updated.status });
});
