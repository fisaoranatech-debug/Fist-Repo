import { prisma } from "./db";

/** Résultat du réveil d'un appareil par notification push. */
export type WakeUp = "sent" | "no-token" | "failed";

interface ExpoTicket {
  status?: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Envoi d'une notification push silencieuse via le service Expo Push (FCM sur Android).
 * Le message réveille l'app pour qu'elle récupère ses commandes en attente.
 * Expo répond 200 même en cas d'erreur : on lit donc le « ticket » renvoyé.
 */
export async function sendWakeUpPush(
  device: { id: string; pushToken: string | null },
  data: Record<string, string>,
): Promise<WakeUp> {
  const token = device.pushToken;
  if (!token || !/^Expo(nent)?PushToken\[.+\]$/.test(token)) return "no-token";
  if (process.env.PUSH_DISABLED === "1") return "failed";
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify({ to: token, data, priority: "high", _contentAvailable: true, ttl: 3600 }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => null)) as { data?: ExpoTicket | ExpoTicket[]; errors?: { code?: string; message?: string }[] } | null;
    if (!res.ok || body?.errors?.length) {
      console.warn(`Push Expo refusé (HTTP ${res.status}) :`, body?.errors?.map((e) => e.code ?? e.message).join(", ") ?? "réponse illisible");
      return "failed";
    }
    const ticket = Array.isArray(body?.data) ? body?.data[0] : body?.data;
    if (ticket?.status === "error") {
      const code = ticket.details?.error ?? "erreur inconnue";
      console.warn(`Push Expo en erreur pour l'appareil ${device.id} : ${code} (${ticket.message ?? ""})`);
      if (code === "DeviceNotRegistered") {
        // Application désinstallée ou jeton périmé : on l'oublie, l'appareil en renverra un nouveau.
        await prisma.device.update({ where: { id: device.id }, data: { pushToken: null } }).catch(() => {});
      }
      return "failed";
    }
    return "sent";
  } catch (err) {
    console.warn("Push non envoyé :", (err as Error).message);
    return "failed";
  }
}
