import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Configuration de l'application Retrouve (Android en priorité).
 * L'APK se construit avec EAS Build : `npm run build:apk` (voir README).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Retrouve",
  slug: "retrouve",
  owner: "joy04051131s-team",
  scheme: "retrouve",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  newArchEnabled: true,
  android: {
    package: "mg.retrouve.app",
    // Incrémenté à chaque construction GitHub Actions pour que les mises à jour s'installent.
    versionCode: Number(process.env.ANDROID_VERSION_CODE) || 1,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: "#2453e6" },
    permissions: [
      "ACCESS_COARSE_LOCATION",
      "ACCESS_FINE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "FOREGROUND_SERVICE",
      "FOREGROUND_SERVICE_LOCATION",
      "POST_NOTIFICATIONS",
      "RECEIVE_BOOT_COMPLETED",
      "WAKE_LOCK",
      "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
      "MODIFY_AUDIO_SETTINGS",
      // Commandes par SMS sans internet (usage privé : pas de publication Google Play).
      "RECEIVE_SMS",
      "SEND_SMS",
    ],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_CONTACTS",
      "android.permission.READ_PHONE_STATE",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  ios: {
    bundleIdentifier: "mg.retrouve.app",
    supportsTablet: true,
    infoPlist: {
      UIBackgroundModes: ["location", "fetch", "remote-notification"],
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Retrouve envoie la position de cet appareil à votre compte pour pouvoir le retrouver s'il est perdu.",
      NSLocationWhenInUseUsageDescription: "Retrouve utilise la position pour localiser cet appareil.",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-background-task",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Retrouve envoie la position de cet appareil à votre compte pour pouvoir le retrouver s'il est perdu.",
        isAndroidBackgroundLocationEnabled: true,
        isAndroidForegroundServiceEnabled: true,
      },
    ],
    ["expo-notifications", { color: "#2453e6", defaultChannel: "retrouve" }],
    [
      "expo-build-properties",
      {
        android: {
          // Permet d'envoyer les positions vers un serveur local (http://192.168.x.x) pendant les tests.
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  experiments: { typedRoutes: false },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "",
    // Projet Expo créé avec `eas init` (identifiant public, pas un secret).
    eas: { projectId: process.env.EAS_PROJECT_ID || "fbd0ecbc-8903-4265-991a-9da18575cb99" },
  },
});
