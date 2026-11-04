import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { getState, loadCredentials } from "../src/storage";
import { Screen } from "../src/ui";

/** Aiguillage : association, mode perdu ou écran d'accueil. */
export default function Index() {
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const creds = await loadCredentials();
      if (!creds) return setTarget("/pair");
      const state = await getState();
      setTarget(state?.lostMode ? "/lost" : "/home");
    })();
  }, []);
  if (!target) {
    return (
      <Screen style={{ alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </Screen>
    );
  }
  return <Redirect href={target as "/pair"} />;
}
