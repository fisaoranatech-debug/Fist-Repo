"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { InstallButton } from "@/components/InstallButton";
import { Modal } from "@/components/Modal";
import { PushToggle } from "@/components/PushToggle";
import { Alert, Button, Card, Field, Input, PageTitle } from "@/components/ui";
import { api, ApiError, fetcher } from "@/lib/api-client";

interface Me { id: string; name: string; email: string; contactPhone: string | null; emailAlerts: boolean }
type Msg = { tone: "green" | "red"; text: string } | null;

export default function SettingsPage() {
  const router = useRouter();
  const { data: me, mutate } = useSWR<Me>("/api/auth/me", fetcher);
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [pwdMsg, setPwdMsg] = useState<Msg>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("profile");
    setProfileMsg(null);
    try {
      await mutate(await api<Me>("/api/auth/me", { method: "PATCH", body: Object.fromEntries(new FormData(e.currentTarget)) }), false);
      setProfileMsg({ tone: "green", text: "Profil enregistré." });
    } catch (err) {
      setProfileMsg({ tone: "red", text: (err as Error).message });
    } finally {
      setLoading(null);
    }
  }

  async function toggleEmailAlerts(value: boolean) {
    if (!me) return;
    // Mise à jour immédiate de l'interface, annulée si le serveur refuse.
    await mutate({ ...me, emailAlerts: value }, false);
    try {
      await mutate(await api<Me>("/api/auth/me", { method: "PATCH", body: { emailAlerts: value } }), false);
    } catch (err) {
      await mutate({ ...me, emailAlerts: !value }, false);
      setProfileMsg({ tone: "red", text: (err as Error).message });
    }
  }

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setPwdMsg(null);
    if (f.newPassword !== f.confirm) return setPwdMsg({ tone: "red", text: "Les deux nouveaux mots de passe ne sont pas identiques." });
    setLoading("password");
    try {
      await api("/api/auth/password", { method: "PATCH", body: { currentPassword: f.currentPassword, newPassword: f.newPassword } });
      form.reset();
      setPwdMsg({ tone: "green", text: "Mot de passe modifié. Vos autres sessions ont été déconnectées." });
    } catch (err) {
      const detail = err instanceof ApiError ? err.details?.newPassword?.[0] : undefined;
      setPwdMsg({ tone: "red", text: detail ?? (err as Error).message });
    } finally {
      setLoading(null);
    }
  }

  async function deleteAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading("delete");
    setDeleteError(null);
    try {
      await api("/api/auth/me", { method: "DELETE", body: Object.fromEntries(new FormData(e.currentTarget)) });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setDeleteError((err as Error).message);
      setLoading(null);
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
          <form onSubmit={saveProfile} className="space-y-4">
            {profileMsg && <Alert tone={profileMsg.tone}>{profileMsg.text}</Alert>}
            <Field label="Email"><Input value={me.email} disabled /></Field>
            <Field label="Nom"><Input name="name" defaultValue={me.name} required /></Field>
            <Field label="Téléphone de contact" hint="Affiché sur l'écran de vos appareils en mode perdu. Choisissez un numéro joignable depuis un autre téléphone.">
              <Input name="contactPhone" type="tel" defaultValue={me.contactPhone ?? ""} placeholder="+261 34 …" />
            </Field>
            <Button type="submit" loading={loading === "profile"}>Enregistrer</Button>
          </form>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Alertes</h2>
        <div className="space-y-5">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Recevoir les alertes par email</span>
              <span className="block text-xs text-muted">Carte SIM changée, sortie de zone, mauvais codes, batterie faible, appareil hors ligne.</span>
            </span>
            <input
              type="checkbox"
              aria-label="Recevoir les alertes par email"
              className="mt-1 size-5 accent-[var(--color-brand-600)]"
              checked={me?.emailAlerts ?? true}
              disabled={!me}
              onChange={(e) => void toggleEmailAlerts(e.target.checked)}
            />
          </label>
          <hr className="border-app" />
          <PushToggle />
          <hr className="border-app" />
          <InstallButton />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 font-semibold">Changer mon mot de passe</h2>
        <form onSubmit={changePassword} className="space-y-4">
          {pwdMsg && <Alert tone={pwdMsg.tone}>{pwdMsg.text}</Alert>}
          <Field label="Mot de passe actuel"><Input name="currentPassword" type="password" autoComplete="current-password" required /></Field>
          <Field label="Nouveau mot de passe" hint="8 caractères minimum"><Input name="newPassword" type="password" autoComplete="new-password" required /></Field>
          <Field label="Confirmez le nouveau mot de passe"><Input name="confirm" type="password" autoComplete="new-password" required /></Field>
          <Button type="submit" loading={loading === "password"}>Changer le mot de passe</Button>
        </form>
      </Card>

      <Card>
        <h2 className="font-semibold">Application mobile</h2>
        <p className="mt-2 text-sm text-muted">
          L&apos;application Android s&apos;installe avec un fichier APK (voir le guide du projet). Après l&apos;installation, autorisez
          la localisation « Toujours », les notifications, et désactivez l&apos;optimisation de la batterie pour Retrouve.
        </p>
      </Card>

      <Card>
        <h2 className="font-semibold">Vie privée</h2>
        <p className="mt-2 text-sm text-muted">
          Les positions sont conservées 30 jours puis supprimées automatiquement. Détails dans la{" "}
          <a href="/confidentialite" className="font-medium text-brand-600 underline">politique de confidentialité</a>.
        </p>
      </Card>

      <Card className="border-red-500/40">
        <h2 className="font-semibold text-red-600">Supprimer mon compte</h2>
        <p className="mt-2 text-sm text-muted">
          Supprime définitivement votre compte, vos appareils, leurs positions, alertes et partages. Cette action est irréversible.
        </p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>Supprimer mon compte…</Button>
      </Card>

      <Button variant="secondary" onClick={logout}>Se déconnecter</Button>

      <Modal title="Supprimer mon compte" open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <form onSubmit={deleteAccount} className="space-y-4">
          <Alert>⚠️ Tous vos appareils deviendront introuvables et toutes les données seront effacées. Impossible de revenir en arrière.</Alert>
          {deleteError && <Alert>{deleteError}</Alert>}
          <Field label="Votre mot de passe pour confirmer">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" variant="danger" className="w-full" loading={loading === "delete"}>Supprimer définitivement</Button>
        </form>
      </Modal>
    </div>
  );
}
