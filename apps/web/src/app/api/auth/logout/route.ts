import { json, route } from "@/lib/http";
import { clearSessionCookieHeader } from "@/lib/session";

export const POST = route(async () => {
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookieHeader());
  return res;
});
