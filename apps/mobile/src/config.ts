import Constants from "expo-constants";

export const DEFAULT_API_URL = String(
  process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || "",
).replace(/\/$/, "");

export const APP_VERSION = Constants.expoConfig?.version ?? "0.0.0";
export const EAS_PROJECT_ID: string | undefined =
  Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

export const TASKS = {
  location: "retrouve-location",
  background: "retrouve-background",
  notification: "retrouve-notification",
} as const;

/** Durée de la sonnerie à distance, en secondes. */
export const RING_SECONDS = 30;
/** En dessous de ce niveau, on envoie une position immédiatement (avant extinction). */
export const CRITICAL_BATTERY = 5;
