import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { AppState } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ensureTracking, sync } from "../src/agent";
import { setupNotificationChannels } from "../src/notifications";
import { registerPushTask } from "../src/tasks";

export default function RootLayout() {
  useEffect(() => {
    void setupNotificationChannels();
    void registerPushTask();
    // Notification reçue pendant que l'app est ouverte : on synchronise tout de suite.
    const sub = Notifications.addNotificationReceivedListener((n) => {
      if ((n.request.content.data as { kind?: string } | undefined)?.kind === "command") void sync({ reason: "push" });
    });

    // Au démarrage : relancer le suivi (arrêté par Android après une mise à jour) et synchroniser.
    void ensureTracking(true).then(() => sync({ reason: "start" })).catch(() => {});

    // Application à l'écran : vérifier les commandes toutes les 20 secondes.
    let timer: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (timer) return;
      timer = setInterval(() => void sync({ reason: "foreground" }).catch(() => {}), 20_000);
    };
    const stopPolling = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    startPolling();
    const appState = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        void ensureTracking().then(() => sync({ reason: "resume" })).catch(() => {});
        startPolling();
      } else {
        stopPolling();
      }
    });
    return () => {
      sub.remove();
      appState.remove();
      stopPolling();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </SafeAreaProvider>
  );
}
