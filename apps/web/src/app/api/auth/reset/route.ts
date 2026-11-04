import { resetPasswordSchema } from "@retrouve/shared";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { clientIp, HttpError, json, readJson, route } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import { passwordChangedMail } from "@/lib/mail-templates";
import { hashPassword } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { sessionCookieHeader, signSession } from "@/lib/session";

/** Nouveau mot de passe à partir du lien reçu par email. Déconnecte toutes les autres sessions. */
export const POST = route(async (req) => {
  await rateLimit(`reset:${clientIp(req)}`, 20, 60 * 60_000);
  const { token, password } = await readJson(req, resetPasswordSchema);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new HttpError(400, "Ce lien n'est plus valable. Faites une nouvelle demande de réinitialisation.");
  }
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (used.count !== 1) throw new HttpError(400, "Ce lien vient déjà d'être utilisé.");
    await tx.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } });
    return tx.user.update({
      where: { id: record.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  });
  await sendMail(passwordChangedMail(user.email, user.name));
  const res = json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookieHeader(await signSession(user.id, user.sessionVersion)));
  return res;
});
