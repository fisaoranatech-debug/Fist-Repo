import { prisma } from "./db";

/** Dernière position de chaque appareil (une seule requête). */
export async function lastLocations(deviceIds: string[]) {
  if (deviceIds.length === 0) return new Map();
  const rows = await prisma.location.findMany({
    where: { deviceId: { in: deviceIds } },
    orderBy: [{ deviceId: "asc" }, { recordedAt: "desc" }],
    distinct: ["deviceId"],
  });
  return new Map(rows.map((r) => [r.deviceId, r]));
}

/** Tous les appareils visibles par un utilisateur : les siens et ceux partagés avec lui. */
export async function accessibleDevices(userId: string) {
  const [owned, shared] = await Promise.all([
    prisma.device.findMany({
      where: { userId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.deviceShare.findMany({
      where: { userId },
      include: { device: { include: { user: { select: { name: true } } } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return [
    ...owned.map((device) => ({ device, access: "OWNER" as const })),
    ...shared.map((s) => ({ device: s.device, access: s.role })),
  ];
}

export async function accessibleDeviceIds(userId: string): Promise<string[]> {
  const list = await accessibleDevices(userId);
  return list.map((d) => d.device.id);
}
