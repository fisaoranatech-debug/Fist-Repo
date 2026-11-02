import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Text, View } from "react-native";
import { RetrouveNative } from "./native";
import { checkForUpdate, currentVersionCode, type UpdateManifest } from "./updates";
import { Body, Button, Card, useTheme } from "./ui";

/** Bandeau « Mise à jour disponible » avec téléchargement et installation depuis l'application. */
export function UpdateBanner({ manual = false }: { manual?: boolean }) {
  const t = useTheme();
  const [update, setUpdate] = useState<UpdateManifest | null>(null);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [progress, setProgress] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    const u = await checkForUpdate();
    setUpdate(u);
    setUpToDate(!u);
    setChecking(false);
  }, []);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => s === "active" && void check());
    return () => sub.remove();
  }, [check]);

  async function install() {
    if (!update || !RetrouveNative) return;
    setError(null);
    if (!RetrouveNative.canInstallPackages()) {
      Alert.alert(
        "Autorisation nécessaire",
        "Android doit autoriser Retrouve à installer ses propres mises à jour. Activez « Autoriser cette source », puis revenez et touchez à nouveau « Mettre à jour ».",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir les réglages", onPress: () => RetrouveNative?.openInstallPermissionSettings() },
        ],
      );
      return;
    }
    setProgress(0);
    const timer = setInterval(() => setProgress(RetrouveNative?.getUpdateProgress() ?? -1), 400);
    const result = await RetrouveNative.downloadAndInstall(update.apkUrl, update.sha256 ?? "");
    clearInterval(timer);
    setProgress(-1);
    if (result === "checksum") setError("Le fichier téléchargé est abîmé. Réessayez.");
    else if (result.startsWith("error:")) setError(`Téléchargement impossible : ${result.slice(6)}`);
  }

  if (!update) {
    if (!manual) return null;
    return (
      <Card>
        <Body muted style={{ fontSize: 13 }}>
          Version installée : n°{currentVersionCode()} {upToDate ? "· à jour ✓" : ""}
        </Body>
        <Button label={checking ? "Recherche…" : "Rechercher une mise à jour"} variant="secondary" onPress={check} loading={checking} />
      </Card>
    );
  }

  const mb = update.size ? ` (${Math.round(update.size / 1_000_000)} Mo)` : "";
  return (
    <Card style={{ borderColor: t.brand, borderWidth: 2 }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: "800" }}>⬆️ Mise à jour disponible</Text>
      <Body muted>
        Version n°{update.versionCode} (installée : n°{currentVersionCode()}){mb}
        {update.notes ? `\n${update.notes}` : ""}
      </Body>
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
      {progress >= 0 ? (
        <View style={{ gap: 6 }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, overflow: "hidden" }}>
            <View style={{ height: 8, width: `${Math.min(progress, 100)}%`, backgroundColor: t.brand }} />
          </View>
          <Body muted style={{ fontSize: 13 }}>
            {progress >= 100 ? "Ouverture de l'installation… touchez « Installer »." : `Téléchargement… ${progress} %`}
          </Body>
        </View>
      ) : (
        <Button label="Mettre à jour" onPress={install} />
      )}
      <Body muted style={{ fontSize: 12 }}>Vos réglages et l'association avec le site sont conservés.</Body>
    </Card>
  );
}
