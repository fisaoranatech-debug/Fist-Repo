"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { LABELS, type DeviceDTO } from "@retrouve/shared";
import { Map, type MapDevice } from "@/components/Map";
import { Badge, BatteryBadge, Card, PageTitle } from "@/components/ui";
import { fetcher } from "@/lib/api-client";
import { DEVICE_ICON, isOnline, timeAgo } from "@/lib/format";

export default function DevicesPage() {
  const router = useRouter();
  const { data, error, isLoading } = useSWR<DeviceDTO[]>("/api/devices", fetcher, { refreshInterval: 15_000 });

  const markers: MapDevice[] = (data ?? [])
    .filter((d) => d.lastLocation)
    .map((d) => ({
      id: d.id,
      name: d.name,
      type: d.type,
      lat: d.lastLocation!.lat,
      lng: d.lastLocation!.lng,
      accuracy: d.lastLocation!.accuracy,
      lost: d.lostMode,
      recordedAt: d.lastLocation!.recordedAt,
    }));

  return (
    <>
      <PageTitle
        title="Mes appareils"
        subtitle="Positions mises à jour automatiquement."
        action={
          <Link href="/appareils/nouveau" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            + Ajouter un appareil
          </Link>
        }
      />
      {error && <p className="text-red-600">{error.message}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="order-2 lg:order-1">
          <Map devices={markers} onDeviceClick={(id) => router.push(`/appareils/${id}`)} className="h-[360px] w-full rounded-2xl lg:h-[560px]" />
        </div>
        <div className="order-1 space-y-3 lg:order-2">
          {isLoading && <Card>Chargement…</Card>}
          {data?.length === 0 && (
            <Card>
              <p className="font-semibold">Aucun appareil pour l&apos;instant</p>
              <p className="mt-1 text-sm text-muted">Ajoutez votre premier téléphone pour commencer à le protéger.</p>
              <Link href="/appareils/nouveau" className="mt-3 inline-block text-sm font-semibold text-brand-600">Ajouter un appareil →</Link>
            </Card>
          )}
          {data?.map((d) => (
            <Link key={d.id} href={`/appareils/${d.id}`} className="block">
              <Card className="transition hover:border-brand-500">
                <div className="flex items-start gap-3">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-xl">{DEVICE_ICON[d.type]}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{d.name}</p>
                      {d.lostMode && <Badge tone="red">Perdu</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted">
                      {[LABELS.deviceType[d.type], d.model, d.access !== "OWNER" ? `partagé par ${d.ownerName}` : null].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {!d.paired ? (
                        <Badge tone="amber">À associer</Badge>
                      ) : isOnline(d.lastSeenAt) ? (
                        <Badge tone="green">● En ligne</Badge>
                      ) : (
                        <Badge>Vu {timeAgo(d.lastSeenAt)}</Badge>
                      )}
                      <BatteryBadge level={d.battery} charging={d.charging} />
                      {d.lastLocation && <Badge tone="blue">📍 {timeAgo(d.lastLocation.recordedAt)}</Badge>}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
