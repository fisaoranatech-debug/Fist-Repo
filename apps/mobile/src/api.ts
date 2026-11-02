import type {
  AgentCommand,
  AgentState,
  CommandAckInput,
  HeartbeatInput,
  LocationPointInput,
  PairInput,
  PairResponse,
} from "@retrouve/shared";
import { HttpStatusError } from "./http";

async function request<T>(baseUrl: string, path: string, init: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    const res = await fetch(baseUrl.replace(/\/$/, "") + path, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* réponse non JSON */
    }
    if (!res.ok) {
      const msg = (data as { error?: string } | null)?.error ?? `Erreur ${res.status}`;
      throw new HttpStatusError(res.status, msg);
    }
    return data as T;
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new Error("Le serveur ne répond pas (délai dépassé).");
    if (err instanceof TypeError) throw new Error("Pas de connexion au serveur. Vérifiez internet et l'adresse du serveur.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function pairDevice(baseUrl: string, body: PairInput) {
  return request<PairResponse>(baseUrl, "/api/agent/pair", { body });
}

/** Client de l'API « agent », authentifié par le jeton de l'appareil. */
export function agentApi(baseUrl: string, token: string) {
  return {
    heartbeat: (body: HeartbeatInput) => request<AgentState>(baseUrl, "/api/agent/heartbeat", { body, token }),
    sendLocations: (points: LocationPointInput[]) =>
      request<{ accepted: number }>(baseUrl, "/api/agent/locations", { body: { points }, token }),
    getCommands: () => request<AgentCommand[]>(baseUrl, "/api/agent/commands", { token }),
    ack: (id: string, body: CommandAckInput) =>
      request<{ ok: boolean }>(baseUrl, `/api/agent/commands/${encodeURIComponent(id)}/ack`, { body, token }),
  };
}
export type AgentApi = ReturnType<typeof agentApi>;
