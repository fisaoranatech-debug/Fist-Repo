"use client";

import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { LABELS, SHARE_ROLES, type ShareDTO } from "@retrouve/shared";
import { api, fetcher } from "@/lib/api-client";
import { Alert, Button, Input, Select } from "./ui";

export function SharesPanel({ deviceId }: { deviceId: string }) {
  const { data, mutate } = useSWR<ShareDTO[]>(`/api/devices/${deviceId}/shares`, fetcher);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);
    try {
      await api(`/api/devices/${deviceId}/shares`, { body: Object.fromEntries(new FormData(form)) });
      form.reset();
      await mutate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }
  async function remove(s: ShareDTO) {
    if (!confirm(`Retirer l'accès de ${s.name} ?`)) return;
    await api(`/api/devices/${deviceId}/shares/${s.id}`, { method: "DELETE" });
    await mutate();
  }

  return (
    <div>
      <h2 className="sr-only">Partage familial</h2>
      <p className="mt-1 text-sm text-muted">Donnez accès à cet appareil à un proche qui a un compte Retrouve.</p>
      {error && <div className="mt-3"><Alert>{error}</Alert></div>}
      <ul className="mt-3 space-y-2">
        {data?.map((s) => (
          <li key={s.id} className="surface-2 flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.name}</span>
              <span className="block truncate text-xs text-muted">{s.email} · {LABELS.shareRole[s.role]}</span>
            </span>
            <Button variant="ghost" className="px-2 py-1 text-xs text-red-600" onClick={() => remove(s)}>Retirer</Button>
          </li>
        ))}
        {data?.length === 0 && <li className="text-sm text-muted">Pas encore partagé.</li>}
      </ul>
      <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input name="email" type="email" placeholder="email@exemple.mg" required className="sm:flex-1" />
        <Select name="role" defaultValue="VIEWER" className="sm:w-auto">
          {SHARE_ROLES.map((r) => <option key={r} value={r}>{LABELS.shareRole[r]}</option>)}
        </Select>
        <Button type="submit" loading={loading}>Partager</Button>
      </form>
    </div>
  );
}
