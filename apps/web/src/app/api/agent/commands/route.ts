import type { AgentCommand } from "@retrouve/shared";
import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, route } from "@/lib/http";

/** L'appareil récupère ses commandes en attente (elles passent alors à l'état « envoyée »). */
export const GET = route(async (req) => {
  const device = await requireAgent(req);
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await prisma.command.findMany({
    where: { deviceId: device.id, status: { in: ["PENDING", "SENT"] }, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  const pendingIds = rows.filter((r) => r.status === "PENDING").map((r) => r.id);
  await Promise.all([
    pendingIds.length
      ? prisma.command.updateMany({ where: { id: { in: pendingIds } }, data: { status: "SENT" } })
      : null,
    prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
  ]);
  const body: AgentCommand[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: (r.payload ?? null) as AgentCommand["payload"],
    createdAt: r.createdAt.toISOString(),
  }));
  return json(body);
});
