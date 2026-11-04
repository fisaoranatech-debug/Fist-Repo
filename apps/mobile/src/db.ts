import * as SQLite from "expo-sqlite";
import type { QueueStore } from "./queue";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Base locale : file d'attente des positions et petites valeurs (état, commandes faites). */
export function db(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await SQLite.openDatabaseAsync("retrouve.db");
      await d.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS queue (id INTEGER PRIMARY KEY AUTOINCREMENT, payload TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      `);
      return d;
    })();
  }
  return dbPromise;
}

export const sqliteQueue: QueueStore = {
  async add(payloads) {
    const d = await db();
    await d.withTransactionAsync(async () => {
      for (const p of payloads) await d.runAsync("INSERT INTO queue (payload) VALUES (?)", p);
    });
  },
  async peek(limit) {
    const d = await db();
    return d.getAllAsync<{ id: number; payload: string }>("SELECT id, payload FROM queue ORDER BY id LIMIT ?", limit);
  },
  async remove(ids) {
    if (ids.length === 0) return;
    const d = await db();
    await d.runAsync(`DELETE FROM queue WHERE id IN (${ids.map(() => "?").join(",")})`, ...ids);
  },
  async count() {
    const d = await db();
    const row = await d.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM queue");
    return row?.n ?? 0;
  },
  async trim(max) {
    const d = await db();
    await d.runAsync("DELETE FROM queue WHERE id NOT IN (SELECT id FROM queue ORDER BY id DESC LIMIT ?)", max);
  },
};

export async function kvGet<T>(key: string): Promise<T | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ value: string }>("SELECT value FROM kv WHERE key = ?", key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const d = await db();
  await d.runAsync("INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)", key, JSON.stringify(value));
}

export async function kvDelete(key: string): Promise<void> {
  const d = await db();
  await d.runAsync("DELETE FROM kv WHERE key = ?", key);
}

export async function clearQueue(): Promise<void> {
  const d = await db();
  await d.runAsync("DELETE FROM queue");
}
