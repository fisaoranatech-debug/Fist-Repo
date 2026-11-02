"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import useSWR from "swr";
import type { DeviceDTO } from "@retrouve/shared";
import { api, fetcher } from "@/lib/api-client";
import { Alert, Button } from "./ui";

/** Affiche un code à 6 chiffres et attend que l'app mobile l'utilise. */
export function PairingPanel({ deviceId, autoStart = false, onPaired }: { deviceId: string; autoStart?: boolean; onPaired?: () => void }) {
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [startedAt, setStartedAt] = useState<string | null>(null);

  const { data: device } = useSWR<DeviceDTO>(code ? `/api/devices/${deviceId}` : null, fetcher, { refreshInterval: 3000 });
  const paired = !!(device && startedAt && device.lastSeenAt && device.lastSeenAt > startedAt && device.paired);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setStartedAt(new Date(Date.now() - 1000).toISOString());
      setCode(await api(`/api/devices/pairing-code`, { body: { deviceId } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoStart) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (paired) onPaired?.();
  }, [paired, onPaired]);

  if (paired) {
    return (
      <Alert tone="green">
        ✅ Appareil associé ! Il va maintenant envoyer sa position.{" "}
        <Link className="font-semibold underline" href={`/appareils/${deviceId}`}>Voir l&apos;appareil</Link>
      </Alert>
    );
  }

  const remaining = code ? Math.max(0, Math.floor((new Date(code.expiresAt).getTime() - now) / 1000)) : 0;

  return (
    <div className="space-y-4">
      {error && <Alert>{error}</Alert>}
      {code && remaining > 0 ? (
        <>
          <div className="surface-2 rounded-2xl p-5 text-center">
            <p className="text-sm text-muted">Code d&apos;association</p>
            <p data-testid="pairing-code" className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]">{code.code}</p>
            <p className="mt-2 text-xs text-muted">
              Expire dans {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
            </p>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
            <li>Installez l&apos;application <b>Retrouve</b> sur l&apos;appareil (fichier APK).</li>
            <li>Ouvrez-la et saisissez ce code.</li>
            <li>Acceptez la localisation « Toujours autoriser » et les notifications.</li>
          </ol>
          <p className="flex items-center gap-2 text-sm text-muted">
            <span className="size-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /> En attente de l&apos;appareil…
          </p>
        </>
      ) : (
        <Button onClick={generate} loading={loading}>{code ? "Générer un nouveau code" : "Générer un code d'association"}</Button>
      )}
    </div>
  );
}
