import * as Notifications from "expo-notifications";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { sync } from "../src/agent";
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
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </SafeAreaProvider>
  );
}
