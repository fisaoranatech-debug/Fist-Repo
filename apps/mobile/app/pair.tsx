import * as Device from "expo-device";
import { router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pairSchema } from "@retrouve/shared";
import { pairDevice } from "../src/api";
import { DEFAULT_API_URL } from "../src/config";
import { clearQueue } from "../src/db";
import { resetLocalData, saveCredentials } from "../src/storage";
import { Body, Button, Card, Input, Screen, Title, useTheme } from "../src/ui";

export default function PairScreen() {
  const t = useTheme();
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    const url = apiUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\/.+/.test(url)) return setError("Adresse du serveur invalide (ex. : https://mon-site.vercel.app).");
    const parsed = pairSchema.safeParse({
      code,
      platform: Platform.OS,
      model: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || undefined,
      osVersion: Device.osVersion ? `${Platform.OS === "android" ? "Android" : "iOS"} ${Device.osVersion}` : undefined,
    });
    if (!parsed.success) return setError("Le code doit contenir 6 chiffres.");
    setLoading(true);
    try {
      const res = await pairDevice(url, parsed.data);
      await resetLocalData();
      await clearQueue();
      await saveCredentials({ apiUrl: url, token: res.token, deviceId: res.deviceId, name: res.name });
      router.replace("/permissions");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, flexGrow: 1, justifyContent: "center" }} keyboardShouldPersistTaps="handled">
            <View style={{ alignItems: "center", gap: 8, marginBottom: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: t.brand, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 32 }}>◎</Text>
              </View>
              <Title>Retrouve</Title>
              <Body muted style={{ textAlign: "center" }}>
                Associez ce téléphone à votre compte pour pouvoir le retrouver s&apos;il est perdu ou volé.
              </Body>
            </View>
            <Card>
              <Body style={{ fontWeight: "700" }}>1. Sur le site, ouvrez « Ajouter un appareil »</Body>
              <Body muted>Un code à 6 chiffres s&apos;affiche (valable 10 minutes).</Body>
              <Body style={{ fontWeight: "700", marginTop: 6 }}>2. Saisissez-le ici</Body>
              <Input
                value={code}
                onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                keyboardType="number-pad"
                maxLength={6}
                style={{ fontSize: 28, letterSpacing: 8, textAlign: "center", fontWeight: "700" }}
                accessibilityLabel="Code d'association"
              />
              <Body muted style={{ marginTop: 6 }}>Adresse du serveur</Body>
              <Input
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://mon-site.vercel.app"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                accessibilityLabel="Adresse du serveur"
              />
              {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
              <Button label="Associer ce téléphone" onPress={submit} loading={loading} disabled={code.length !== 6} />
            </Card>
            <Body muted style={{ textAlign: "center", fontSize: 13 }}>
              Retrouve reste visible sur ce téléphone (icône et notification). N&apos;installez l&apos;application que sur vos
              appareils ou avec l&apos;accord de la personne qui l&apos;utilise.
            </Body>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Screen>
  );
}
