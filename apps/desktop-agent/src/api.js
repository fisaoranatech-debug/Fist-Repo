export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(baseUrl, path, { method, body, token } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl.replace(/\/$/, "") + path, {
    method: method ?? (body !== undefined ? "POST" : "GET"),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new HttpError(res.status, data?.error ?? `Erreur ${res.status}`);
  return data;
}

export const pair = (baseUrl, body) => request(baseUrl, "/api/agent/pair", { body });

export function agentApi(baseUrl, token) {
  return {
    heartbeat: (body) => request(baseUrl, "/api/agent/heartbeat", { body, token }),
    sendLocations: (points) => request(baseUrl, "/api/agent/locations", { body: { points }, token }),
    getCommands: () => request(baseUrl, "/api/agent/commands", { token }),
    ack: (id, body) => request(baseUrl, `/api/agent/commands/${encodeURIComponent(id)}/ack`, { body, token }),
  };
}
