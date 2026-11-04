import { accountDeleteSchema, profileUpdateSchema } from "@retrouve/shared";
import type { User } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forbidden, json, readJson, route } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import { accountDeletedMail } from "@/lib/mail-templates";
import { verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { clearSessionCookieHeader } from "@/lib/session";

const publicUser = (u: User) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  contactPhone: u.contactPhone,
  emailAlerts: u.emailAlerts,
});

export const GET = route(async (req) => {
  const user = await requireUser(req);
  return json(publicUser(user));
});

export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  const input = await readJson(req, profileUpdateSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || null } : {}),
      ...(input.emailAlerts !== undefined ? { emailAlerts: input.emailAlerts } : {}),
    },
  });
  return json(publicUser(updated));
});

/** Suppression définitive du compte et de toutes ses données (appareils, positions, partages…). */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`delete:${user.id}`, 5, 60 * 60_000);
  const { password } = await readJson(req, accountDeleteSchema);
  if (!(await verifyPassword(password, user.passwordHash))) throw forbidden("Mot de passe incorrect.");
  await prisma.user.delete({ where: { id: user.id } });
  await sendMail(accountDeletedMail(user.email, user.name));
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", clearSessionCookieHeader());
  return res;
});
