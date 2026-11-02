import type { Alert, Command, Device, DeviceShare, Geofence, Location, User } from "@prisma/client";
import type {
  AlertDTO,
  CommandDTO,
  DeviceDTO,
  GeofenceDTO,
  LocationDTO,
  ShareDTO,
} from "@retrouve/shared";
import type { Access } from "./auth";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toLocationDTO(l: Location): LocationDTO {
  return {
    id: l.id,
    lat: l.lat,
    lng: l.lng,
    accuracy: l.accuracy,
    speed: l.speed,
    battery: l.battery,
    source: l.source,
    recordedAt: l.recordedAt.toISOString(),
  };
}

export function toDeviceDTO(
  d: Device & { user?: Pick<User, "name"> },
  access: Access,
  lastLocation: Location | null,
): DeviceDTO {
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    model: d.model,
    imei: d.imei,
    simNumber: d.simNumber,
    platform: d.platform,
    battery: d.battery,
    charging: d.charging,
    carrierName: d.carrierName,
    lastSeenAt: iso(d.lastSeenAt),
    paired: d.tokenHash !== null,
    lostMode: d.lostMode,
    lostMessage: d.lostMessage,
    capabilities: d.capabilities,
    hasSmsSecret: !!d.smsSecret,
    access,
    ownerName: d.user?.name ?? "",
    lastLocation: lastLocation ? toLocationDTO(lastLocation) : null,
  };
}

export function toCommandDTO(c: Command): CommandDTO {
  const payload = (c.payload ?? null) as Record<string, unknown> | null;
  // Le PIN de verrouillage n'est jamais renvoyé au site.
  const safe = payload && "pin" in payload ? { ...payload, pin: "••••" } : payload;
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    payload: safe,
    result: c.result,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toAlertDTO(a: Omit<Alert, "photo"> & { hasPhoto: boolean; device: Pick<Device, "name"> }): AlertDTO {
  return {
    id: a.id,
    deviceId: a.deviceId,
    deviceName: a.device.name,
    type: a.type,
    data: (a.data ?? null) as Record<string, unknown> | null,
    hasPhoto: a.hasPhoto,
    readAt: iso(a.readAt),
    createdAt: a.createdAt.toISOString(),
  };
}

export function toGeofenceDTO(g: Geofence): GeofenceDTO {
  return { id: g.id, name: g.name, lat: g.lat, lng: g.lng, radiusM: g.radiusM, enabled: g.enabled };
}

export function toShareDTO(s: DeviceShare & { user: Pick<User, "email" | "name"> }): ShareDTO {
  return { id: s.id, email: s.user.email, name: s.user.name, role: s.role };
}
