"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { LABELS, mapLink, type AlertDTO } from "@retrouve/shared";
import { Modal } from "@/components/Modal";
import { Badge, Button, Card, PageTitle } from "@/components/ui";
import { api, fetcher } from "@/lib/api-client";
import { formatDateTime, timeAgo } from "@/lib/format";

const ICONS: Record<AlertDTO["type"], string> = {
  SIM_CHANGED: "📶",
  LOW_BATTERY: "🪫",
  GEOFENCE_EXIT: "🚧",
  INTRUDER_PHOTO: "📸",
  OFFLINE: "📴",
};

function describe(a: AlertDTO): string {
  const d = (a.data ?? {}) as Record<string, string | number | null>;
  switch (a.type) {
    case "SIM_CHANGED":
      return `Opérateur : ${d.before ?? "?"} → ${d.after ?? "?"}. Quelqu'un a peut-être mis une autre carte SIM.`;
    case "LOW_BATTERY":
      return `Batterie à ${d.battery ?? "?"} %. La dernière position a été envoyée.`;
    case "GEOFENCE_EXIT":
      return `L'appareil est sorti de la zone « ${d.zone ?? ""} ».`;
    case "INTRUDER_PHOTO":
      return `Photo prise après ${d.failedAttempts ?? "plusieurs"} mauvais codes de déverrouillage.`;
    case "OFFLINE":
      return `Aucune nouvelle depuis ${d.lastSeenAt ? formatDateTime(String(d.lastSeenAt)) : "plus de 24 h"}. Téléphone éteint, sans réseau ou application arrêtée.`;
  }
}

export default function AlertsPage() {
  const { data, mutate } = useSWR<AlertDTO[]>("/api/alerts", fetcher, { refreshInterval: 20_000 });
  const [photo, setPhoto] = useState<string | null>(null);
  const unread = data?.filter((a) => !a.readAt).length ?? 0;

  async function markAll() {
    await api("/api/alerts", { method: "PATCH" });
    await mutate();
  }
  async function markOne(a: AlertDTO) {
    if (a.readAt) return;
    await api(`/api/alerts/${a.id}`, { method: "PATCH" });
    await mutate();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle
        title="Alertes"
        subtitle={unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est lu."}
        action={unread > 0 ? <Button variant="secondary" onClick={markAll}>Tout marquer comme lu</Button> : undefined}
      />
      <div className="space-y-3">
        {data?.length === 0 && <Card><p className="text-muted">Aucune alerte. Tout va bien 👍</p></Card>}
        {data?.map((a) => {
          const d = (a.data ?? {}) as Record<string, number>;
          return (
            <Card key={a.id} className={a.readAt ? "opacity-75" : "border-l-4 border-l-brand-600"}>
              <div className="flex items-start gap-3" onMouseEnter={() => markOne(a)}>
                <span className="text-2xl">{ICONS[a.type]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{LABELS.alert[a.type]}</p>
                    {!a.readAt && <Badge tone="blue">Nouveau</Badge>}
                  </div>
                  <p className="text-sm">
                    <Link className="font-medium text-brand-600" href={`/appareils/${a.deviceId}`}>{a.deviceName}</Link> · {describe(a)}
                  </p>
                  <p className="mt-1 text-xs text-muted" title={formatDateTime(a.createdAt)}>{timeAgo(a.createdAt)}</p>
                  <div className="mt-2 flex gap-3 text-sm">
                    {a.hasPhoto && (
                      <button className="font-semibold text-brand-600" onClick={() => setPhoto(a.id)}>Voir la photo</button>
                    )}
                    {typeof d.lat === "number" && typeof d.lng === "number" && (
                      <a className="font-semibold text-brand-600" target="_blank" rel="noreferrer" href={mapLink(d.lat, d.lng)}>Voir sur la carte ↗</a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal title="Photo de l'intrus" open={!!photo} onClose={() => setPhoto(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={`/api/alerts/${photo}/photo`} alt="Photo prise par l'appareil" className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
}
