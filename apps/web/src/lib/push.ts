/**
 * Envoi de notifications push silencieuses via le service Expo Push (qui utilise FCM sur Android).
 * Le message réveille l'app pour qu'elle récupère ses commandes en attente.
 */
export async function sendWakeUpPush(pushToken: string | null, data: Record<string, string>): Promise<boolean> {
  if (!pushToken || process.env.PUSH_DISABLED === "1") return false;
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(pushToken)) return false;
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: pushToken,
        data,
        priority: "high",
        _contentAvailable: true,
        ttl: 3600,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch (err) {
    console.warn("Push non envoyé :", err);
    return false;
  }
}
