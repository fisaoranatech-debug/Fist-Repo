import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { EAS_PROJECT_ID } from "./config";

const LOST_ID = "retrouve-lost-mode";

/** Canaux Android : l'utilisateur peut les régler dans les paramètres du téléphone. */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("retrouve", {
    name: "Informations Retrouve",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync("lost", {
    name: "Mode perdu",
    description: "Message affiché quand l'appareil est déclaré perdu",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    vibrationPattern: [0, 400, 200, 400],
  });
  await Notifications.setNotificationChannelAsync("ring", {
    name: "Sonnerie à distance",
    importance: Notifications.AndroidImportance.MAX,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: "default",
    vibrationPattern: [0, 800, 300, 800, 300, 800],
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Notification permanente, visible sur l'écran verrouillé, en mode perdu. */
export async function showLostModeNotification(message: string, phone: string | null): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: LOST_ID,
    content: {
      title: "🚨 Téléphone perdu",
      body: phone ? `${message}\nAppelez le ${phone}` : message,
      sticky: true,
      autoDismiss: false,
      priority: Notifications.AndroidNotificationPriority.MAX,
      data: { kind: "lost" },
    },
    trigger: Platform.OS === "android" ? { channelId: "lost" } : null,
  });
}

export async function hideLostModeNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(LOST_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(LOST_ID).catch(() => {});
}

/** Repli quand le module natif n'est pas disponible : notification sonore. */
export async function ringWithNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔊 Retrouve vous cherche",
      body: "Votre propriétaire fait sonner ce téléphone.",
      sound: "default",
      priority: Notifications.AndroidNotificationPriority.MAX,
    },
    trigger: Platform.OS === "android" ? { channelId: "ring" } : null,
  });
}

/** Jeton Expo Push : permet au serveur de réveiller l'app pour une commande. */
export async function getPushToken(): Promise<{ token: string | null; error: string | null }> {
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return { token: null, error: "notifications non autorisées" };
    if (!EAS_PROJECT_ID) return { token: null, error: "projet Expo non configuré" };
    const token = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
    return { token: token.data, error: null };
  } catch (err) {
    return { token: null, error: (err as Error).message?.slice(0, 160) || "erreur inconnue" };
  }
}
