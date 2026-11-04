import { passwordChangeSchema } from "@retrouve/shared";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { forbidden, json, readJson, route } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import { passwordChangedMail } from "@/lib/mail-templates";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { sessionCookieHeader, signSession } from "@/lib/session";

/** Changement de mot de passe : les autres sessions sont déconnectées, celle-ci reste ouverte. */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  await rateLimit(`password:${user.id}`, 10, 60 * 60_000);
  const input = await readJson(req, passwordChangeSchema);
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw forbidden("Mot de passe actuel incorrect.");
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await sendMail(passwordChangedMail(updated.email, updated.name));
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookieHeader(await signSession(updated.id, updated.sessionVersion)));
  return res;
});
