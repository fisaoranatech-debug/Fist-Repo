import type { LocationPointInput } from "@retrouve/shared";
import { isPermanentFailure } from "./http";

/**
 * File d'attente des positions : si le téléphone n'a pas de réseau,
 * les positions sont gardées et envoyées plus tard, dans l'ordre.
 */
export interface QueueStore {
  add(payloads: string[]): Promise<void>;
  peek(limit: number): Promise<{ id: number; payload: string }[]>;
  remove(ids: number[]): Promise<void>;
  count(): Promise<number>;
  /** Supprime les plus anciens au-delà de `max` éléments. */
  trim(max: number): Promise<void>;
}

export const MAX_QUEUE = 5000;
export const BATCH_SIZE = 200;

export async function enqueuePoints(store: QueueStore, points: LocationPointInput[]): Promise<void> {
  if (points.length === 0) return;
  await store.add(points.map((p) => JSON.stringify(p)));
  await store.trim(MAX_QUEUE);
}

export async function flushQueue(
  store: QueueStore,
  send: (points: LocationPointInput[]) => Promise<unknown>,
  maxBatches = 10,
): Promise<{ sent: number; dropped: number; remaining: number; error?: unknown }> {
  let sent = 0;
  let dropped = 0;
  for (let i = 0; i < maxBatches; i++) {
    const rows = await store.peek(BATCH_SIZE);
    if (rows.length === 0) break;
    const points: LocationPointInput[] = [];
    const bad: number[] = [];
    for (const r of rows) {
      try {
        points.push(JSON.parse(r.payload) as LocationPointInput);
      } catch {
        bad.push(r.id);
      }
    }
    if (bad.length) {
      await store.remove(bad);
      dropped += bad.length;
    }
    const ids = rows.filter((r) => !bad.includes(r.id)).map((r) => r.id);
    if (ids.length === 0) continue;
    try {
      await send(points);
      await store.remove(ids);
      sent += ids.length;
    } catch (err) {
      if (isPermanentFailure(err)) {
        // Le serveur refuse ces données : inutile de les renvoyer indéfiniment.
        await store.remove(ids);
        dropped += ids.length;
        continue;
      }
      return { sent, dropped, remaining: await store.count(), error: err };
    }
  }
  return { sent, dropped, remaining: await store.count() };
}

/** File en mémoire (tests). */
export function memoryQueue(): QueueStore & { items: { id: number; payload: string }[] } {
  let next = 1;
  const items: { id: number; payload: string }[] = [];
  return {
    items,
    async add(payloads) {
      for (const payload of payloads) items.push({ id: next++, payload });
    },
    async peek(limit) {
      return items.slice(0, limit);
    },
    async remove(ids) {
      for (const id of ids) {
        const i = items.findIndex((x) => x.id === id);
        if (i >= 0) items.splice(i, 1);
      }
    },
    async count() {
      return items.length;
    },
    async trim(max) {
      if (items.length > max) items.splice(0, items.length - max);
    },
  };
}
