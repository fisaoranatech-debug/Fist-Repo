"use client";

import { useState } from "react";
import type { GeofenceDTO } from "@retrouve/shared";
import { api } from "@/lib/api-client";
import { Alert, Button, Field, Input } from "./ui";

interface Props {
  deviceId: string;
  geofences: GeofenceDTO[];
  canEdit: boolean;
  draft: { lat: number; lng: number; radiusM: number } | null;
  picking: boolean;
  setPicking: (v: boolean) => void;
  setDraft: (d: { lat: number; lng: number; radiusM: number } | null) => void;
  onChange: () => void;
}

/** Zones : une alerte est créée quand l'appareil sort d'une zone. */
export function GeofencesPanel({ deviceId, geofences, canEdit, draft, picking, setPicking, setDraft, onChange }: Props) {
  const [name, setName] = useState("Maison");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/devices/${deviceId}/geofences`, { body: { name, ...draft } });
      setDraft(null);
      setPicking(false);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function toggle(g: GeofenceDTO) {
    await api(`/api/devices/${deviceId}/geofences/${g.id}`, { method: "PATCH", body: { enabled: !g.enabled } });
    onChange();
  }
  async function remove(g: GeofenceDTO) {
    if (!confirm(`Supprimer la zone « ${g.name} » ?`)) return;
    await api(`/api/devices/${deviceId}/geofences/${g.id}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div>
      <h2 className="sr-only">Zones de sécurité</h2>
      <p className="mt-1 text-sm text-muted">Recevez une alerte quand l&apos;appareil sort d&apos;une zone (maison, école…).</p>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      <ul className="mt-3 space-y-2">
        {geofences.map((g) => (
          <li key={g.id} className="surface-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
            <span className={g.enabled ? "" : "text-muted line-through"}>
              {g.name} · {g.radiusM} m
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => toggle(g)}>{g.enabled ? "Désactiver" : "Activer"}</Button>
                <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => remove(g)}>Supprimer</Button>
              </span>
            )}
          </li>
        ))}
        {geofences.length === 0 && <li className="text-sm text-muted">Aucune zone.</li>}
      </ul>
      {canEdit && !picking && (
        <Button variant="secondary" className="mt-3" onClick={() => setPicking(true)}>+ Ajouter une zone</Button>
      )}
      {canEdit && picking && (
        <div className="mt-4 space-y-3">
          <Alert tone="blue">{draft ? "Ajustez le nom et le rayon, puis enregistrez." : "Cliquez sur la carte pour placer le centre de la zone."}</Alert>
          <Field label="Nom">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
          <Field label={`Rayon : ${draft?.radiusM ?? 300} m`}>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={draft?.radiusM ?? 300}
              disabled={!draft}
              onChange={(e) => draft && setDraft({ ...draft, radiusM: Number(e.target.value) })}
              className="w-full accent-[var(--color-brand-600)]"
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={save} disabled={!draft || !name.trim()} loading={loading}>Enregistrer</Button>
            <Button variant="ghost" onClick={() => { setPicking(false); setDraft(null); }}>Annuler</Button>
          </div>
        </div>
      )}
    </div>
  );
}
