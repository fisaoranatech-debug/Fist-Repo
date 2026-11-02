"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { LABELS, type DeviceDTO, type GeofenceDTO, type LocationDTO } from "@retrouve/shared";
import { CommandsPanel } from "@/components/CommandsPanel";
import { DeviceForm } from "@/components/DeviceForm";
import { GeofencesPanel } from "@/components/GeofencesPanel";
import { Map } from "@/components/Map";
import { PairingPanel } from "@/components/PairingPanel";
import { SharesPanel } from "@/components/SharesPanel";
import { Alert, Badge, BatteryBadge, Button, Card, cx } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { DEVICE_ICON, formatDateTime, isOnline, timeAgo } from "@/lib/format";

const PERIODS = [
  { label: "1 h", hours: 1 },
  { label: "24 h", hours: 24 },
  { label: "7 j", hours: 24 * 7 },
  { label: "30 j", hours: 24 * 30 },
];

export default function DevicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [hours, setHours] = useState(24);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number; radiusM: number } | null>(null);
  const [tab, setTab] = useState<"infos" | "zones" | "partage" | "association">("infos");

  const { data: device, error, mutate } = useSWR<DeviceDTO>(`/api/devices/${id}`, fetcher, { refreshInterval: 5_000 });

  // Suivi en direct tant que la page est ouverte et visible : le téléphone envoie sa position toutes les 15 s.
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") void api(`/api/devices/${id}/live`, { method: "POST" }).catch(() => {});
    };
    ping();
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [id]);
  // Arrondi à la minute pour ne pas changer la clé SWR à chaque rendu.
  const from = new Date(Math.floor((Date.now() - hours * 3600_000) / 60_000) * 60_000).toISOString();
  const { data: track, mutate: mutateTrack } = useSWR<LocationDTO[]>(
    `/api/devices/${id}/locations?from=${encodeURIComponent(from)}&limit=2000`,
    fetcher,
    { refreshInterval: 10_000 },
  );
  const { data: fences, mutate: mutateFences } = useSWR<GeofenceDTO[]>(`/api/devices/${id}/geofences`, fetcher);

  if (error) return <Alert>{error.message}</Alert>;
  if (!device) return <p className="text-muted">Chargement…</p>;

  const owner = device.access === "OWNER";
  const last = device.lastLocation;

  async function remove() {
    if (!confirm(`Supprimer « ${device!.name} » et tout son historique ? L'application sur l'appareil sera déconnectée.`)) return;
    await api(`/api/devices/${id}`, { method: "DELETE" });
    router.replace("/appareils");
  }

  return (
    <>
      <Link href="/appareils" className="text-sm text-muted hover:underline">← Mes appareils</Link>
      <div className="mt-2 mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-brand-500/10 text-2xl">{DEVICE_ICON[device.type]}</div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{device.name}</h1>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {device.lostMode && <Badge tone="red">🚨 Mode perdu</Badge>}
              {!device.paired ? <Badge tone="amber">À associer</Badge> : isOnline(device.lastSeenAt) ? <Badge tone="green">● En ligne</Badge> : <Badge>Vu {timeAgo(device.lastSeenAt)}</Badge>}
              <BatteryBadge level={device.battery} charging={device.charging} />
              {device.carrierName && <Badge>📶 {device.carrierName}</Badge>}
              {device.live && <Badge tone="red">🔴 En direct (toutes les 15 s)</Badge>}
              {device.capabilities.includes("bgRestricted") && (
                <Badge tone="red">⚠️ Restreinte par Android (batterie)</Badge>
              )}
              {device.paired && (
                <Badge tone={device.instantWakeUp ? "green" : "amber"}>
                  ⚡ Réveil instantané : {device.instantWakeUp ? "activé" : "non activé"}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <a href={`/api/devices/${id}/report`} className="surface rounded-xl px-4 py-2.5 text-sm font-semibold hover:brightness-95">
          📄 Déclaration de perte (PDF)
        </a>
      </div>

      {device.capabilities.includes("bgRestricted") && (
        <div className="mb-4">
          <Alert tone="amber">
            Android a placé Retrouve en mode « restreint » sur ce téléphone : l&apos;application ne peut pas fonctionner
            fermée. Sur le téléphone : Paramètres → Applications → Retrouve → Batterie → « Sans restriction », et autorisez le
            démarrage automatique.
          </Alert>
        </div>
      )}

      {device.lostMode && device.unlockCode && (
        <div className="mb-4">
          <Alert tone="blue">
            🔐 Code de déblocage du téléphone : <b data-testid="unlock-code" className="font-mono text-lg tracking-widest">{device.unlockCode}</b>
            <br />
            Si vous retrouvez le téléphone, tapez ce code sur son écran de blocage (ou cliquez sur « ✅ Retrouvé »).
          </Alert>
        </div>
      )}

      {device.lostMode && (
        <div className="mb-4">
          <Alert>
            Mode perdu actif : l&apos;appareil affiche votre message et envoie sa position chaque minute. Ne cherchez pas à le récupérer
            seul chez un inconnu : transmettez la position et le PDF à la police.
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card className="p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2">
              <p className="text-sm">
                {last ? (
                  <>
                    <b>Dernière position :</b> {formatDateTime(last.recordedAt)} ({timeAgo(last.recordedAt)})
                    {last.accuracy != null && <> · ±{Math.round(last.accuracy)} m</>} · {LABELS.source[last.source]}
                  </>
                ) : (
                  <span className="text-muted">Aucune position reçue pour l&apos;instant.</span>
                )}
              </p>
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button
                    key={p.hours}
                    onClick={() => setHours(p.hours)}
                    className={cx("rounded-lg px-2.5 py-1 text-xs font-semibold", hours === p.hours ? "bg-brand-600 text-white" : "surface-2")}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <Map
              className={cx("h-[380px] w-full rounded-xl lg:h-[480px]", picking && "cursor-crosshair")}
              devices={last ? [{ id: device.id, name: device.name, type: device.type, lat: last.lat, lng: last.lng, accuracy: last.accuracy, lost: device.lostMode, recordedAt: last.recordedAt }] : []}
              track={track ?? []}
              geofences={fences ?? []}
              draftFence={draft}
              onMapClick={picking ? (lat, lng) => setDraft({ lat, lng, radiusM: draft?.radiusM ?? 300 }) : undefined}
            />
            {last && (
              <div className="mt-3 flex flex-wrap gap-2 px-2 pb-1 text-sm">
                <a className="font-semibold text-brand-600" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${last.lat},${last.lng}`}>
                  Itinéraire Google Maps ↗
                </a>
                <span className="text-muted">·</span>
                <button className="text-muted hover:underline" onClick={() => navigator.clipboard?.writeText(`${last.lat.toFixed(6)}, ${last.lng.toFixed(6)}`)}>
                  Copier les coordonnées
                </button>
                <span className="text-muted">· {track?.length ?? 0} positions sur la période</span>
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap gap-1 border-b border-app pb-3">
              {(
                [
                  ["infos", "Informations"],
                  ["zones", "Zones"],
                  ...(owner ? [["partage", "Partage"], ["association", "Association"]] : []),
                ] as [typeof tab, string][]
              ).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", tab === k ? "bg-brand-500/10 text-brand-600 dark:text-brand-100" : "text-muted")}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "infos" &&
              (owner ? (
                <DeviceForm device={device} onSaved={() => mutate()} submitLabel="Enregistrer" />
              ) : (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-muted">Propriétaire</dt><dd>{device.ownerName}</dd></div>
                  <div><dt className="text-muted">Modèle</dt><dd>{device.model ?? "—"}</dd></div>
                  <div><dt className="text-muted">IMEI</dt><dd className="font-mono">{device.imei ?? "—"}</dd></div>
                  <div><dt className="text-muted">SIM</dt><dd>{device.simNumber ?? "—"}</dd></div>
                </dl>
              ))}
            {tab === "zones" && (
              <GeofencesPanel
                deviceId={id}
                geofences={fences ?? []}
                canEdit={device.access !== "VIEWER"}
                draft={draft}
                picking={picking}
                setPicking={setPicking}
                setDraft={setDraft}
                onChange={() => mutateFences()}
              />
            )}
            {tab === "partage" && owner && <SharesPanel deviceId={id} />}
            {tab === "association" && owner && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  {device.paired
                    ? "L'appareil est associé. Générer un nouveau code permet d'installer l'application sur un autre téléphone (l'ancien sera déconnecté)."
                    : "Installez l'application sur l'appareil puis saisissez le code."}
                </p>
                <PairingPanel deviceId={id} onPaired={() => mutate()} />
                <hr className="border-app" />
                <Button variant="ghost" className="text-red-600" onClick={remove}>Supprimer cet appareil</Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <CommandsPanel device={device} onChange={() => { mutate(); mutateTrack(); }} />
          <Card>
            <h2 className="font-semibold">Fiche de l&apos;appareil</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Type" value={LABELS.deviceType[device.type]} />
              <Row label="Modèle" value={device.model} />
              <Row label="IMEI" value={device.imei} mono />
              <Row label="SIM" value={device.simNumber} />
              <Row label="Système" value={device.platform} />
              <Row label="Dernier contact" value={device.lastSeenAt ? formatDateTime(device.lastSeenAt) : null} />
            </dl>
            {!device.imei && owner && (
              <p className="mt-3 text-xs text-amber-600">Ajoutez l&apos;IMEI (onglet Informations) : il est indispensable pour faire bloquer un téléphone volé.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className={cx("truncate text-right", mono && "font-mono")}>{value || "—"}</dd>
    </div>
  );
}
