import { isInsideGeofence } from "@retrouve/shared";
import { createAlerts } from "./alerts";
import { prisma } from "./db";

/** Compare la dernière position aux zones de l'appareil et crée une alerte à la sortie. */
export async function evaluateGeofences(deviceId: string, point: { lat: number; lng: number }) {
  const fences = await prisma.geofence.findMany({ where: { deviceId, enabled: true } });
  for (const fence of fences) {
    const inside = isInsideGeofence(point, fence);
    if (fence.inside === inside) continue;
    await prisma.geofence.update({ where: { id: fence.id }, data: { inside } });
    if (fence.inside === true && !inside) {
      await createAlerts([
        {
          deviceId,
          type: "GEOFENCE_EXIT",
          data: { geofenceId: fence.id, zone: fence.name, lat: point.lat, lng: point.lng },
        },
      ]);
    }
  }
}
