"use client";

import { useState, type FormEvent } from "react";
import { DEVICE_TYPES, LABELS, TRACKING_INTERVAL_CHOICES, type DeviceDTO } from "@retrouve/shared";
import { api, ApiError } from "@/lib/api-client";
import { Alert, Button, Field, Input, Select } from "./ui";

/** Formulaire de création ou de modification des informations d'un appareil. */
export function DeviceForm({ device, onSaved, submitLabel }: { device?: DeviceDTO; onSaved: (d: DeviceDTO) => void; submitLabel: string }) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);
    const body = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const d = await api<DeviceDTO>(device ? `/api/devices/${device.id}` : "/api/devices", {
        method: device ? "PATCH" : "POST",
        body,
      });
      setSaved(true);
      onSaved(d);
    } catch (err) {
      setError((err as Error).message);
      if (err instanceof ApiError && err.details) setFieldErrors(err.details);
    } finally {
      setLoading(false);
    }
  }
  const fe = (k: string) => fieldErrors[k]?.[0];

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && <Alert>{error}</Alert>}
      {saved && device && <Alert tone="green">Modifications enregistrées.</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l'appareil" error={fe("name")}>
          <Input name="name" defaultValue={device?.name} placeholder="Ex. : Téléphone de Hery" required />
        </Field>
        <Field label="Type" error={fe("type")}>
          <Select name="type" defaultValue={device?.type ?? "PHONE"}>
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>{LABELS.deviceType[t]}</option>
            ))}
          </Select>
        </Field>
        <Field label="Marque et modèle" error={fe("model")}>
          <Input name="model" defaultValue={device?.model ?? ""} placeholder="Ex. : Samsung Galaxy A15" />
        </Field>
        <Field label="IMEI" error={fe("imei")} hint={<>Tapez <b>*#06#</b> sur le téléphone pour l&apos;afficher. Indispensable pour bloquer un téléphone volé.</>}>
          <Input name="imei" defaultValue={device?.imei ?? ""} inputMode="numeric" placeholder="15 chiffres" />
        </Field>
        <Field label="Numéro de la carte SIM" error={fe("simNumber")}>
          <Input name="simNumber" defaultValue={device?.simNumber ?? ""} type="tel" placeholder="+261 34 …" />
        </Field>
        {device && (
          <Field
            label="Code secret des commandes SMS"
            error={fe("smsSecret")}
            hint="Sans internet, envoyez « LOCATE code » par SMS au téléphone perdu pour recevoir sa position (Android). Laissez vide pour désactiver."
          >
            <Input name="smsSecret" defaultValue="" placeholder={device.hasSmsSecret ? "•••• (déjà défini)" : "4 à 12 lettres ou chiffres"} autoComplete="off" />
          </Field>
        )}
      </div>
      {device && (
        <Field
          label="Fréquence d'envoi de la position"
          hint="Quand vous ouvrez cette fiche, le suivi passe automatiquement en direct (toutes les 15 s). En mode perdu : chaque minute. Plus c'est fréquent, plus la batterie s'use."
        >
          <Select name="trackingIntervalSec" defaultValue={String(device.trackingIntervalSec)}>
            {TRACKING_INTERVAL_CHOICES.map((s) => (
              <option key={s} value={s}>Toutes les {s / 60} min{s === 300 ? " (recommandé)" : ""}</option>
            ))}
          </Select>
        </Field>
      )}
      {device && (
        <Field label="Message du mode perdu" error={fe("lostMessage")} hint="Affiché sur l'écran de l'appareil en mode perdu.">
          <Input name="lostMessage" defaultValue={device.lostMessage ?? ""} placeholder="Ce téléphone a été perdu. Merci d'appeler son propriétaire." />
        </Field>
      )}
      <Button type="submit" loading={loading}>{submitLabel}</Button>
    </form>
  );
}
