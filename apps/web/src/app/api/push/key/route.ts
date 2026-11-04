import { json } from "@/lib/http";
import { webPushPublicKey } from "@/lib/web-push";

/** Clé publique VAPID nécessaire au navigateur pour s'abonner (null si non configurée). */
export async function GET() {
  return json({ publicKey: webPushPublicKey() });
}
