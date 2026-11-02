import { loginSchema } from "@retrouve/shared";
import { prisma } from "@/lib/db";
import { clientIp, HttpError, json, readJson, route } from "@/lib/http";
import { verifyPassword } from "@/lib/password";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { sessionCookieHeader, signSession } from "@/lib/session";

export const POST = route(async (req) => {
  const input = await readJson(req, loginSchema);
  const key = `login:${clientIp(req)}:${input.email}`;
  await rateLimit(key, 8, 15 * 60_000);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new HttpError(401, "Email ou mot de passe incorrect.");
  }
  await resetRateLimit(key);
  const res = json({ id: user.id, name: user.name, email: user.email });
  res.headers.append("Set-Cookie", sessionCookieHeader(await signSession(user.id)));
  return res;
});
