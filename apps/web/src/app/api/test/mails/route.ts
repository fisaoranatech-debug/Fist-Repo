import { json } from "@/lib/http";
import { sentMails } from "@/lib/mail";

/**
 * Réservé aux tests de bout en bout : emails « envoyés » sans SMTP.
 * Désactivé sans la variable E2E_TEST_ROUTES=1, et toujours désactivé sur Vercel.
 */
export async function GET() {
  if (process.env.E2E_TEST_ROUTES !== "1" || process.env.VERCEL) {
    return json({ error: "Introuvable." }, 404);
  }
  return json(sentMails().map((m) => ({ to: m.to, subject: m.subject, text: m.text })));
}
