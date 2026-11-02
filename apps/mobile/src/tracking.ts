import * as BackgroundTask from "expo-background-task";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { TRACKING_INTERVAL_SEC } from "@retrouve/shared";
import { TASKS } from "./config";
import { RetrouveNative } from "./native";

export interface PermissionReport {
  foreground: boolean;
  background: boolean;
  notifications: boolean;
  batteryUnrestricted: boolean | null;
  deviceAdmin: boolean | null;
}

export async function permissionReport(): Promise<PermissionReport> {
  const [fg, bg, notif] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
    Notifications.getPermissionsAsync(),
  ]);
  return {
    foreground: fg.granted,
    background: bg.granted,
    notifications: notif.granted,
    batteryUnrestricted: RetrouveNative ? RetrouveNative.isIgnoringBatteryOptimizations() : null,
    deviceAdmin: RetrouveNative ? RetrouveNative.isAdminActive() : null,
  };
}

/** Démarre (ou redémarre avec un nouvel intervalle) l'envoi des positions en arrière-plan. */
export async function startTracking(intervalSec: number = TRACKING_INTERVAL_SEC.normal): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(TASKS.location).catch(() => false);
  if (started) await Location.stopLocationUpdatesAsync(TASKS.location);
  await Location.startLocationUpdatesAsync(TASKS.location, {
    accuracy: intervalSec <= TRACKING_INTERVAL_SEC.lost ? Location.Accuracy.High : Location.Accuracy.Balanced,
    timeInterval: intervalSec * 1000,
    distanceInterval: 0,
    deferredUpdatesInterval: intervalSec * 1000,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.Other,
    foregroundService: {
      // Notification obligatoire et visible : l'utilisateur sait que l'appareil est localisé.
      notificationTitle: "Retrouve protège cet appareil",
      notificationBody: "La position est envoyée régulièrement au compte du propriétaire.",
      notificationColor: "#2453e6",
      killServiceOnDestroy: false,
    },
  });
  // Filet de sécurité : réveil périodique (minimum 15 min imposé par Android).
  await BackgroundTask.registerTaskAsync(TASKS.background, { minimumInterval: 15 }).catch(() => {});
}

export async function stopTracking(): Promise<void> {
  if (await Location.hasStartedLocationUpdatesAsync(TASKS.location).catch(() => false)) {
    await Location.stopLocationUpdatesAsync(TASKS.location);
  }
  await BackgroundTask.unregisterTaskAsync(TASKS.background).catch(() => {});
}

export const isTracking = () => Location.hasStartedLocationUpdatesAsync(TASKS.location).catch(() => false);

export function toPoint(loc: Location.LocationObject, battery?: number) {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? undefined,
    altitude: loc.coords.altitude ?? undefined,
    speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : undefined,
    heading: loc.coords.heading != null && loc.coords.heading >= 0 ? loc.coords.heading : undefined,
    battery,
    source: "GPS" as const,
    recordedAt: loc.timestamp,
  };
}
