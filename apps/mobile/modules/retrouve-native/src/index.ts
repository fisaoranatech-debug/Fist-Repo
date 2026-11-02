import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

export interface RetrouveNativeModule {
  setAgentConfig(apiUrl: string | null, token: string | null, smsSecret: string | null, contactPhone: string | null): void;
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

/** null sur iOS, dans Expo Go, ou si le module n'est pas compilé dans l'app. */
export const RetrouveNative: RetrouveNativeModule | null =
  Platform.OS === "android" ? requireOptionalNativeModule<RetrouveNativeModule>("RetrouveNative") : null;
