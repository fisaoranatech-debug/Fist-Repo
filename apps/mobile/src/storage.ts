import * as SecureStore from "expo-secure-store";
import type { AgentState } from "@retrouve/shared";
import { kvDelete, kvGet, kvSet } from "./db";

export interface Credentials {
  apiUrl: string;
  token: string;
  deviceId: string;
  name: string;
}

const CREDS_KEY = "retrouve.credentials";
// Accessible même écran verrouillé (les tâches en arrière-plan en ont besoin).
const OPTS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

export async function loadCredentials(): Promise<Credentials | null> {
  const raw = await SecureStore.getItemAsync(CREDS_KEY, OPTS);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

export async function saveCredentials(c: Credentials): Promise<void> {
  await SecureStore.setItemAsync(CREDS_KEY, JSON.stringify(c), OPTS);
}

export async function clearCredentials(): Promise<void> {
  await SecureStore.deleteItemAsync(CREDS_KEY, OPTS);
}

/** Informations de suivi affichées sur l'écran d'accueil. */
export interface LocalStatus {
  lastSyncAt: string | null;
  lastSyncOk: boolean;
  lastError: string | null;
  lastLocationAt: string | null;
  /** true si le serveur a refusé le jeton (appareil supprimé ou associé ailleurs). */
  revoked: boolean;
}

export const getState = () => kvGet<AgentState>("state");
export const setState = (s: AgentState) => kvSet("state", s);

export async function getStatus(): Promise<LocalStatus> {
  return (
    (await kvGet<LocalStatus>("status")) ?? {
      lastSyncAt: null,
      lastSyncOk: false,
      lastError: null,
      lastLocationAt: null,
      revoked: false,
    }
  );
}

export async function patchStatus(patch: Partial<LocalStatus>): Promise<void> {
  await kvSet("status", { ...(await getStatus()), ...patch });
}

/** Mémorise les commandes déjà exécutées (les 100 dernières). */
export async function isCommandDone(id: string): Promise<boolean> {
  return ((await kvGet<string[]>("doneCommands")) ?? []).includes(id);
}

export async function markCommandDone(id: string): Promise<void> {
  const list = (await kvGet<string[]>("doneCommands")) ?? [];
  if (!list.includes(id)) await kvSet("doneCommands", [...list, id].slice(-100));
}

export async function resetLocalData(): Promise<void> {
  await Promise.all(["state", "status", "doneCommands"].map(kvDelete));
}
