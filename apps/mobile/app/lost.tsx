import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, Linking, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AgentState } from "@retrouve/shared";
import { sync } from "../src/agent";
import { getState } from "../src/storage";

/** Écran plein « Téléphone perdu », affiché tant que le mode perdu est actif. */
export default function LostScreen() {
  const [state, setState] = useState<AgentState | null>(null);

  const load = useCallback(async () => {
    const s = await getState();
    if (!s?.lostMode) return router.replace("/home");
    setState(s);
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const back = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => back.remove();
  }, [load]));

  useEffect(() => {
    const timer = setInterval(async () => {
      await sync({ reason: "lost-screen" }).catch(() => {});
      await load();
    }, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const phone = state?.contactPhone;
  return (
    <View style={{ flex: 1, backgroundColor: "#b91c1c" }}>
      <SafeAreaView style={{ flex: 1, padding: 28, justifyContent: "center", gap: 24 }}>
        <Text style={{ fontSize: 64, textAlign: "center" }}>📱</Text>
        <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900", textAlign: "center" }}>Ce téléphone est perdu</Text>
        <Text style={{ color: "#fee2e2", fontSize: 20, textAlign: "center", lineHeight: 28 }}>
          {state?.lostMessage ?? "Merci de contacter son propriétaire."}
        </Text>
        {phone ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => Linking.openURL(`tel:${phone.replace(/[^\d+]/g, "")}`)}
            style={({ pressed }) => ({ backgroundColor: "#fff", borderRadius: 18, padding: 20, opacity: pressed ? 0.85 : 1 })}
          >
            <Text style={{ color: "#b91c1c", fontSize: 22, fontWeight: "800", textAlign: "center" }}>📞 Appeler le {phone}</Text>
          </Pressable>
        ) : null}
        <Text style={{ color: "#fecaca", fontSize: 14, textAlign: "center" }}>
          La position de cet appareil est transmise à son propriétaire.
        </Text>
      </SafeAreaView>
    </View>
  );
}
