import { registerSchema } from "@retrouve/shared";
import { prisma } from "@/lib/db";
import { clientIp, HttpError, json, readJson, route } from "@/lib/http";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { sessionCookieHeader, signSession } from "@/lib/session";

export const POST = route(async (req) => {
  await rateLimit(`register:${clientIp(req)}`, 10, 60 * 60_000);
  const input = await readJson(req, registerSchema);
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) throw new HttpError(409, "Un compte existe déjà avec cet email.");
  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      contactPhone: input.contactPhone || null,
      passwordHash: await hashPassword(input.password),
      termsAcceptedAt: new Date(),
    },
  });
  const res = json({ id: user.id, name: user.name, email: user.email }, 201);
  res.headers.append("Set-Cookie", sessionCookieHeader(await signSession(user.id, user.sessionVersion)));
  return res;
});
