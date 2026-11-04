import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { AppState, Linking, PermissionsAndroid, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { sync } from "../src/agent";
import { RetrouveNative } from "../src/native";
import { autostartHelp } from "../src/autostart";
import { getState } from "../src/storage";
import { permissionReport, startTracking, type PermissionReport } from "../src/tracking";
import { Body, Button, Card, Screen, StatusRow, Title } from "../src/ui";

async function smsGranted(): Promise<boolean | null> {
  if (Platform.OS !== "android" || !RetrouveNative) return null;
  const [r, s] = await Promise.all([
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS),
    PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS),
  ]);
  return r && s;
}

/** Guide des autorisations : sans elles, Android finit par couper l'envoi des positions. */
export default function PermissionsScreen() {
  const [report, setReport] = useState<PermissionReport | null>(null);
  const [sms, setSms] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setReport(await permissionReport());
    setSms(await smsGranted());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      // Au retour depuis les réglages du téléphone, on met à jour l'affichage.
      const sub = AppState.addEventListener("change", (s) => s === "active" && void refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  async function askForeground() {
    const r = await Location.requestForegroundPermissionsAsync();
    if (!r.granted && !r.canAskAgain) await Linking.openSettings();
    await refresh();
  }
  async function askBackground() {
    if (!report?.foreground) await askForeground();
    const r = await Location.requestBackgroundPermissionsAsync();
    if (!r.granted) await Linking.openSettings();
    await refresh();
  }
  async function askNotifications() {
    const r = await Notifications.requestPermissionsAsync();
    if (!r.granted && !r.canAskAgain) await Linking.openSettings();
    await refresh();
  }
  async function askSms() {
    await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      PermissionsAndroid.PERMISSIONS.SEND_SMS,
      // Reconnaître une autre carte SIM même chez le même opérateur (SMS d'urgence).
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
    ]);
    await refresh();
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const state = await getState();
      await startTracking(state?.intervalSec);
      await sync({ reason: "start", forceLocate: true });
      router.replace("/home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  const ready = !!report?.foreground && !!report.background;

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
          <Title>Autorisations</Title>
          <Body muted>Accordez ces autorisations pour que le téléphone puisse être retrouvé même quand l&apos;application est fermée.</Body>

          <Card>
            <StatusRow ok={report?.foreground ?? null} label="Localisation" detail="Indispensable."
              action={!report?.foreground ? <Button label="Autoriser" variant="secondary" onPress={askForeground} /> : undefined} />
            <StatusRow ok={report?.background ?? null} label="Localisation « Toujours autoriser »"
              detail="Indispensable. Dans les réglages, choisissez « Toujours autoriser »."
              action={!report?.background ? <Button label="Régler" variant="secondary" onPress={askBackground} /> : undefined} />
            <StatusRow ok={report?.notifications ?? null} label="Notifications"
              detail="Pour le mode perdu et les commandes à distance."
              action={!report?.notifications ? <Button label="Autoriser" variant="secondary" onPress={askNotifications} /> : undefined} />
            {report?.batteryUnrestricted !== null && (
              <StatusRow ok={report?.batteryUnrestricted ?? null} label="Batterie sans restriction"
                detail="Sinon Android peut arrêter Retrouve pour économiser la batterie (surtout Tecno, Infinix, Xiaomi, Samsung)."
                action={!report?.batteryUnrestricted ? <Button label="Régler" variant="secondary" onPress={() => { RetrouveNative?.requestIgnoreBatteryOptimizations(); }} /> : undefined} />
            )}
            {RetrouveNative && (
              <StatusRow ok={report?.backgroundRestricted === true ? false : null} label="Démarrage automatique"
                detail={report?.backgroundRestricted
                  ? "Android a RESTREINT Retrouve : ouvrez les réglages et choisissez « Sans restriction » pour la batterie."
                  : autostartHelp()}
                action={<Button label="Ouvrir" variant="secondary" onPress={() => { RetrouveNative?.openAutostartSettings(); }} />} />
            )}
          </Card>

          {RetrouveNative && (
            <Card>
              <Body style={{ fontWeight: "700" }}>Options anti-vol (recommandées)</Body>
              <StatusRow ok={report?.deviceAdmin ?? null} label="Administrateur de l'appareil"
                detail="Verrouiller ou effacer à distance, alerte après 2 mauvais codes."
                action={!report?.deviceAdmin ? <Button label="Activer" variant="secondary" onPress={() => RetrouveNative?.requestAdmin()} /> : undefined} />
              <StatusRow ok={report?.lockScreen ?? null} label="Écran de blocage (mode perdu)"
                detail="Bloque le téléphone par-dessus toutes les applications ; seul le code affiché sur le site le débloque. Activez « Afficher par-dessus d'autres applications »."
                action={!report?.lockScreen ? <Button label="Activer" variant="secondary" onPress={() => RetrouveNative?.requestOverlayPermission()} /> : undefined} />
              <StatusRow ok={sms} label="SMS (sans internet)"
                detail="Commandes LOCATE / RING par SMS, et SMS d'urgence automatique (changement de carte SIM, mode perdu sans internet) à activer sur le site."
                action={!sms ? <Button label="Autoriser" variant="secondary" onPress={askSms} /> : undefined} />
            </Card>
          )}

          {error ? <Body style={{ color: "#dc2626" }}>{error}</Body> : null}
          <Button label={ready ? "Démarrer la protection" : "Accordez la localisation « Toujours »"} onPress={start} loading={starting} disabled={!ready} />
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}
