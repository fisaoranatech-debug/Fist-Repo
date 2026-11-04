import { prisma } from "@/lib/db";
import { beforeEach } from "vitest";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

interface CallOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  token?: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
}

export async function call<T = any>(handler: unknown, opts: CallOptions = {}) {
  const url = new URL("http://localhost:3000/api/test");
  for (const [k, v] of Object.entries(opts.query ?? {})) url.searchParams.set(k, v);
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const req = new Request(url, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const res = await (handler as Handler)(req, { params: Promise.resolve(opts.params ?? {}) });
  const type = res.headers.get("content-type") ?? "";
  const data = type.includes("application/json") ? ((await res.json()) as T) : (undefined as T);
  return { status: res.status, data, res };
}

export function cookieFrom(res: Response): string {
  const set = res.headers.get("set-cookie") ?? "";
  return set.split(";")[0]!;
}

export function resetDb() {
  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      `TRUNCATE "User", "Device", "DeviceShare", "PairingCode", "Location", "Command", "Alert", "Geofence", "RateLimit" CASCADE`,
    );
  });
}
