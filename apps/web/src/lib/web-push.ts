import webpush from "web-push";
import { prisma } from "./db";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

let ready = false;

export function webPushPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

function setup(): boolean {
  if (ready) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@retrouve.app", pub, priv);
  ready = true;
  return true;
}

/** Notification du navigateur sur tous les appareils abonnés de ces utilisateurs. */
export async function sendWebPush(userIds: string[], payload: PushPayload): Promise<number> {
  if (userIds.length === 0 || process.env.PUSH_DISABLED === "1" || !setup()) return 0;
  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
        TTL: 3600,
        urgency: "high",
        timeout: 10_000,
      }),
    ),
  );
  const expired: string[] = [];
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") sent++;
    else {
      const code = (r.reason as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) expired.push(subs[i]!.id); // abonnement révoqué par le navigateur
    }
  });
  if (expired.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
  return sent;
}
