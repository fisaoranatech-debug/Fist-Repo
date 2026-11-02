"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { Alert, Button, Card, Field, Input, PageTitle } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";

interface Me { id: string; name: string; email: string; contactPhone: string | null }

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, mutate } = useSWR<Me>("/api/auth/me", fetcher);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      await mutate(await api<Me>("/api/auth/me", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) }), false);
      setMsg({ tone: "green", text: "Profil enregistré." });
    } catch (err) {
      setMsg({ tone: "red", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageTitle title="Paramètres" />
      <Card>
        <h2 className="mb-4 font-semibold">Mon profil</h2>
        {me && (
          <form onSubmit={save} className="space-y-4">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <Field label="Email"><Input value={me.email} disabled /></Field>
            <Field label="Nom"><Input name="name" defaultValue={me.name} required /></Field>
            <Field label="Téléphone de contact" hint="Affiché sur l'écran de vos appareils en mode perdu. Choisissez un numéro joignable depuis un autre téléphone.">
              <Input name="contactPhone" type="tel" defaultValue={me.contactPhone ?? ""} placeholder="+261 34 …" />
            </Field>
            <Button type="submit" loading={loading}>Enregistrer</Button>
          </form>
        )}
      </Card>
      <Card>
        <h2 className="font-semibold">Installer l&apos;application</h2>
        <p className="mt-2 text-sm text-muted">
          L&apos;application Android est distribuée sous forme de fichier APK (voir le guide dans le README du projet). Après
          l&apos;installation, autorisez la localisation « Toujours », les notifications, et désactivez l&apos;optimisation de la
          batterie pour Retrouve, sinon Android risque d&apos;arrêter l&apos;envoi des positions.
        </p>
      </Card>
      <Card>
        <h2 className="font-semibold">Vie privée</h2>
        <p className="mt-2 text-sm text-muted">
          Les positions sont conservées 30 jours puis supprimées automatiquement. Supprimer un appareil efface tout son historique.
          N&apos;installez l&apos;application que sur vos appareils ou ceux de proches qui sont d&apos;accord : suivre quelqu&apos;un
          à son insu est illégal.
        </p>
      </Card>
      <Button variant="secondary" onClick={logout}>Se déconnecter</Button>
    </div>
  );
}
