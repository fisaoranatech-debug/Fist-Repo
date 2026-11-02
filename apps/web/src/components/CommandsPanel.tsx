"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { LABELS, type CommandDTO, type CommandType, type DeviceDTO } from "@retrouve/shared";
import { api, fetcher } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { Modal } from "./Modal";
import { Alert, Badge, Button, Card, Field, Input } from "./ui";

const STATUS_TONE = { PENDING: "gray", SENT: "blue", ACKED: "blue", DONE: "green", FAILED: "red" } as const;

export function CommandsPanel({ device, onChange }: { device: DeviceDTO; onChange: () => void }) {
  const { data: history, mutate } = useSWR<CommandDTO[]>(`/api/devices/${device.id}/commands`, fetcher, { refreshInterval: 5000 });
  const [dialog, setDialog] = useState<CommandType | null>(null);
  const [busy, setBusy] = useState<CommandType | null>(null);
  const [message, setMessage] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const canControl = device.access !== "VIEWER";
  const hasAdmin = device.capabilities.includes("deviceAdmin");

  async function send(type: CommandType, extra: Record<string, unknown> = {}) {
    setBusy(type);
    setMessage(null);
    try {
      await api(`/api/devices/${device.id}/commands`, { body: { type, ...extra } });
      setMessage({ tone: "green", text: `Commande « ${LABELS.command[type]} » envoyée. L'appareil l'exécutera dès qu'il sera connecté.` });
      setDialog(null);
      await mutate();
      onChange();
    } catch (e) {
      setMessage({ tone: "red", text: (e as Error).message });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  if (!device.paired) {
    return (
      <Card>
        <h2 className="font-semibold">Actions à distance</h2>
        <p className="mt-2 text-sm text-muted">Associez d&apos;abord l&apos;appareil avec l&apos;application pour pouvoir lui envoyer des commandes.</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-semibold">Actions à distance</h2>
      {!canControl && <p className="mt-2 text-sm text-muted">Vous pouvez seulement voir la position de cet appareil.</p>}
      {message && <div className="mt-3"><Alert tone={message.tone}>{message.text}</Alert></div>}
      {canControl && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button onClick={() => send("RING")} loading={busy === "RING"}>🔊 Faire sonner</Button>
          <Button variant="secondary" onClick={() => send("LOCATE_NOW")} loading={busy === "LOCATE_NOW"}>📍 Localiser</Button>
          {device.lostMode ? (
            <Button variant="secondary" onClick={() => send("LOST_MODE_OFF")} loading={busy === "LOST_MODE_OFF"}>✅ Retrouvé</Button>
          ) : (
            <Button variant="danger" onClick={() => setDialog("LOST_MODE_ON")}>🚨 Mode perdu</Button>
          )}
          <Button variant="secondary" onClick={() => setDialog("LOCK")}>🔒 Verrouiller</Button>
          {device.access === "OWNER" && (
            <Button variant="ghost" className="col-span-2 text-red-600" onClick={() => setDialog("WIPE")}>🗑️ Effacer l&apos;appareil…</Button>
          )}
        </div>
      )}

      {history && history.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-muted">Dernières commandes</h3>
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {history.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate">{LABELS.command[c.type]}</p>
                  <p className="truncate text-xs text-muted">{formatDateTime(c.createdAt)}{c.result ? ` · ${c.result}` : ""}</p>
                </div>
                <Badge tone={STATUS_TONE[c.status]}>{LABELS.commandStatus[c.status]}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <LostModeDialog open={dialog === "LOST_MODE_ON"} device={device} onClose={() => setDialog(null)} onSend={(x) => send("LOST_MODE_ON", x)} />
      <SensitiveDialog open={dialog === "LOCK"} type="LOCK" device={device} hasAdmin={hasAdmin} onClose={() => setDialog(null)} onSend={(x) => send("LOCK", x)} />
      <SensitiveDialog open={dialog === "WIPE"} type="WIPE" device={device} hasAdmin={hasAdmin} onClose={() => setDialog(null)} onSend={(x) => send("WIPE", x)} />
    </Card>
  );
}

function LostModeDialog({ open, device, onClose, onSend }: { open: boolean; device: DeviceDTO; onClose: () => void; onSend: (x: Record<string, unknown>) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await onSend({ message: f.message || undefined, contactPhone: f.contactPhone || undefined }).catch(() => {});
    setLoading(false);
  }
  return (
    <Modal title="Activer le mode perdu" open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">
          L&apos;appareil affichera ce message en plein écran et enverra sa position chaque minute.
        </p>
        <Field label="Message affiché">
          <Input name="message" defaultValue={device.lostMessage ?? "Ce téléphone a été perdu. Merci d'appeler son propriétaire."} maxLength={300} />
        </Field>
        <Field label="Numéro à appeler" hint="Laissez vide pour utiliser le numéro de contact de votre compte.">
          <Input name="contactPhone" type="tel" placeholder="+261 34 …" />
        </Field>
        <Button type="submit" variant="danger" className="w-full" loading={loading}>Activer le mode perdu</Button>
      </form>
    </Modal>
  );
}

function SensitiveDialog({
  open, type, device, hasAdmin, onClose, onSend,
}: { open: boolean; type: "LOCK" | "WIPE"; device: DeviceDTO; hasAdmin: boolean; onClose: () => void; onSend: (x: Record<string, unknown>) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await onSend({ password: f.password, pin: f.pin || undefined, message: f.message || undefined }).catch(() => {});
    setLoading(false);
  }
  const wipe = type === "WIPE";
  return (
    <Modal title={wipe ? "Effacer toutes les données" : "Verrouiller l'appareil"} open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {!hasAdmin && (
          <Alert tone="amber">
            L&apos;option « administrateur de l&apos;appareil » n&apos;est pas activée dans l&apos;application sur ce téléphone :
            la commande risque d&apos;échouer.
          </Alert>
        )}
        {wipe ? (
          <Alert>
            ⚠️ Action <b>irréversible</b> : le téléphone revient aux réglages d&apos;usine. Vous ne pourrez <b>plus le localiser</b> ensuite.
            À n&apos;utiliser qu&apos;en dernier recours, si l&apos;appareil contient des données sensibles.
          </Alert>
        ) : (
          <>
            <p className="text-sm text-muted">L&apos;écran se verrouille immédiatement. Vous pouvez définir un nouveau code PIN (Android).</p>
            <Field label="Nouveau code PIN (optionnel)" hint="4 à 12 chiffres. Retenez-le bien !">
              <Input name="pin" inputMode="numeric" pattern="\d{4,12}" autoComplete="off" />
            </Field>
          </>
        )}
        {wipe && (
          <Field label={`Tapez « ${device.name} » pour confirmer`}>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </Field>
        )}
        <Field label="Votre mot de passe Retrouve">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" variant="danger" className="w-full" loading={loading} disabled={wipe && confirm !== device.name}>
          {wipe ? "Effacer définitivement" : "Verrouiller"}
        </Button>
      </form>
    </Modal>
  );
}
