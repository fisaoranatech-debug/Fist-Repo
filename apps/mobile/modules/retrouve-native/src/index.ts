import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export interface RetrouveNativeModule {
  setAgentConfig(apiUrl: string | null, token: string | null, smsSecret: string | null, contactPhone: string | null): void;
  /** Identifiants de l'appareil (sans toucher au reste). */
  setCredentials(apiUrl: string | null, token: string | null): void;
  setPushToken(token: string | null): void;
  /** Démarre l'agent natif (service de premier plan). false si Android l'interdit. */
  startAgent(): boolean;
  stopAgent(): void;
  isAgentRunning(): boolean;
  /** État JSON de l'agent natif (voir NativeAgentStatus). */
  getAgentStatus(): string;
  syncNow(forceLocate: boolean): Promise<string>;
  isBackgroundRestricted(): boolean;
  /** Autorisation « Afficher par-dessus d'autres applications » (écran de blocage du mode perdu). */
  canDrawOverlays(): boolean;
  requestOverlayPermission(): void;
  /** Ouvre l'écran « démarrage automatique » du fabricant (sinon les réglages de l'app). */
  openAutostartSettings(): boolean;
  isAdminActive(): boolean;
  requestAdmin(): void;
  /** Verrouille l'écran. Renvoie true si le PIN a été changé (Android 6 et plus ancien seulement). */
  lockNow(pin: string | null): boolean;
  wipe(): void;
  startAlarm(seconds: number): void;
  stopAlarm(): void;
  isAlarmPlaying(): boolean;
  isIgnoringBatteryOptimizations(): boolean;
  requestIgnoreBatteryOptimizations(): void;
}

export interface NativeAgentStatus {
  state: {
    deviceId: string;
    name: string;
    lostMode: boolean;
    lostMessage: string | null;
    contactPhone: string | null;
    smsSecret: string | null;
    pendingCommands: number;
    intervalSec: number;
  } | null;
  lastSyncAt: string | null;
  lastSyncOk: boolean;
  lastError: string | null;
  lastLocationAt: string | null;
  revoked: boolean;
  queued: number;
  running: boolean;
  enabled: boolean;
  bgRestricted: boolean;
}

/** null sur iOS, dans Expo Go, ou si le module n'est pas compilé dans l'app. */
export const RetrouveNative: RetrouveNativeModule | null =
  Platform.OS === "android" ? requireOptionalNativeModule<RetrouveNativeModule>("RetrouveNative") : null;

export function parseNativeStatus(json: string): NativeAgentStatus | null {
  try {
    return JSON.parse(json) as NativeAgentStatus;
  } catch {
    return null;
  }
}
