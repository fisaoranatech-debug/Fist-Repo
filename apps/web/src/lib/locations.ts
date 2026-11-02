import type { Device } from "@prisma/client";
import type { LocationPoint } from "@retrouve/shared";
import { prisma } from "./db";
import { evaluateGeofences } from "./geofence";

/** Enregistre un lot de positions envoyé par un appareil. */
export async function ingestLocations(device: Device, points: LocationPoint[]) {
  const now = Date.now();
  // On ignore les dates absurdes (plus de 10 min dans le futur, ou plus de 30 jours dans le passé).
  const valid = points.filter((p) => {
    const t = p.recordedAt.getTime();
    return !Number.isNaN(t) && t <= now + 10 * 60_000 && t >= now - 30 * 86_400_000;
  });
  if (valid.length === 0) return { accepted: 0 };

  await prisma.location.createMany({
    data: valid.map((p) => ({
      deviceId: device.id,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy,
      altitude: p.altitude,
      speed: p.speed,
      heading: p.heading,
      battery: p.battery,
      source: p.source,
      recordedAt: p.recordedAt,
    })),
  });

  const latest = valid.reduce((a, b) => (a.recordedAt > b.recordedAt ? a : b));
  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      offlineAlertedAt: null,
      ...(latest.battery !== undefined ? { battery: latest.battery } : {}),
    },
  });
  await evaluateGeofences(device.id, latest);
  return { accepted: valid.length };
}
