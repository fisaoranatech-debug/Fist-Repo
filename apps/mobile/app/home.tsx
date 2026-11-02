import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AgentState } from "@retrouve/shared";
import { sync } from "../src/agent";
import { clearQueue, sqliteQueue } from "../src/db";
import { RetrouveNative } from "../src/native";
import { hideLostModeNotification } from "../src/notifications";
import {
  clearCredentials,
  getState,
  getStatus,
  loadCredentials,
  resetLocalData,
  type Credentials,
  type LocalStatus,
} from "../src/storage";
import { isTracking, permissionReport, stopTracking, type PermissionReport } from "../src/tracking";
import { Body, Button, Card, Screen, StatusRow, Title, useTheme } from "../src/ui";

function ago(iso: string | null): string {
  if (!iso) return "jamais";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

export default function HomeScreen() {
  const t = useTheme();
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [state, setState] = useState<AgentState | null>(null);
  const [status, setStatus] = useState<LocalStatus | null>(null);
  const [tracking, setTracking] = useState<boolean | null>(null);
  const [perms, setPerms] = useState<PermissionReport | null>(null);
  const [queued, setQueued] = useState(0);
  const [alarm, setAlarm] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const c = await loadCredentials();
    if (!c) return router.replace("/pair");
    const s = await getState();
    if (s?.lostMode) return router.replace("/lost");
    setCreds(c);
    setState(s);
    setStatus(await getStatus());
    setTracking(await isTracking());
    setPerms(await permissionReport());
    setQueued(await sqliteQueue.count());
    setAlarm(RetrouveNative?.isAlarmPlaying() ?? false);
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => {
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function syncNow() {
    setBusy(true);
    await sync({ reason: "manual", forceLocate: true });
    await load();
    setBusy(false);
  }

  function unpair() {
    Alert.alert(
      "Dissocier ce téléphone ?",
      "Il ne sera plus localisable depuis votre compte. Vous pourrez l'associer à nouveau avec un nouveau code.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Dissocier",
          style: "destructive",
          onPress: async () => {
            await stopTracking();
            await hideLostModeNotification();
            RetrouveNative?.setAgentConfig(null, null, null, null);
            await clearCredentials();
            await resetLocalData();
            await clearQueue();
            router.replace("/pair");
          },
        },
      ],
    );
  }

  const permsOk = !!perms?.foreground && !!perms.background && perms.notifications;
  const protectedOk = !!tracking && permsOk && !status?.revoked;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} refreshControl={<RefreshControl refreshing={busy} onRefresh={syncNow} />}>
          <Title>{creds?.name ?? "Retrouve"}</Title>

          <View style={{ borderRadius: 20, padding: 20, backgroundColor: protectedOk ? t.success : t.warning, gap: 6 }}>
            <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>
              {status?.revoked ? "Appareil dissocié" : protectedOk ? "✓ Protection active" : "⚠ Protection incomplète"}
            </Text>
            <Text style={{ color: "#fff", fontSize: 15 }}>
              {status?.revoked
                ? "Ce téléphone a été supprimé du compte ou associé ailleurs. Associez-le à nouveau."
                : protectedOk
                  ? `Position envoyée toutes les ${Math.round((state?.intervalSec ?? 300) / 60)} min.`
                  : "Vérifiez les autorisations pour que le téléphone reste localisable."}
            </Text>
          </View>

          {alarm && <Button label="🔇 Arrêter la sonnerie" variant="danger" onPress={() => { RetrouveNative?.stopAlarm(); setAlarm(false); }} />}

          <Card>
            <StatusRow ok={status?.lastSyncOk ?? null} label="Dernière synchronisation" detail={`${ago(status?.lastSyncAt ?? null)}${status?.lastError ? ` · ${status.lastError}` : ""}`} />
            <StatusRow ok={status?.lastLocationAt ? true : null} label="Dernière position" detail={ago(status?.lastLocationAt ?? null)} />
            <StatusRow ok={queued === 0} label="Positions en attente d'envoi" detail={queued === 0 ? "Aucune" : `${queued} (envoyées dès que le réseau revient)`} />
            <StatusRow ok={permsOk} label="Autorisations" detail={permsOk ? "Tout est en ordre" : "Une autorisation manque"}
              action={<Button label="Vérifier" variant="secondary" onPress={() => router.push("/permissions")} />} />
            {perms?.deviceAdmin !== null && (
              <StatusRow ok={perms?.deviceAdmin ?? null} label="Anti-vol (verrouillage / effacement)" detail={perms?.deviceAdmin ? "Activé" : "Non activé (facultatif)"} />
            )}
          </Card>

          {status?.revoked ? (
            <Button label="Associer à nouveau" onPress={unpair} />
          ) : (
            <Button label="Envoyer ma position maintenant" onPress={syncNow} loading={busy} />
          )}

          <Card>
            <Body muted style={{ fontSize: 13 }}>
              Serveur : {creds?.apiUrl}{"\n"}
              Cet appareil est visible par son propriétaire{state?.contactPhone ? ` (${state.contactPhone})` : ""} et les membres de la
              famille avec qui il est partagé. La notification « Retrouve protège cet appareil » reste affichée tant que la protection est active.
            </Body>
          </Card>

          <Button label="Dissocier ce téléphone" variant="secondary" onPress={unpair} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
