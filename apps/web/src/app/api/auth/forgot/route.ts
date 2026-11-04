import { randomBytes } from "node:crypto";
import { forgotPasswordSchema } from "@retrouve/shared";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { clientIp, json, readJson, route } from "@/lib/http";
import { sendMail } from "@/lib/mail";
import { resetPasswordMail } from "@/lib/mail-templates";
import { rateLimit } from "@/lib/rate-limit";

const VALIDITY_MS = 60 * 60_000;
const MESSAGE = "Si un compte existe avec cet email, vous allez recevoir un lien pour choisir un nouveau mot de passe.";

/** Demande de réinitialisation : la réponse est toujours la même (on ne révèle pas qui est inscrit). */
export const POST = route(async (req) => {
  const { email } = await readJson(req, forgotPasswordSchema);
  await rateLimit(`forgot-ip:${clientIp(req)}`, 10, 60 * 60_000);
  await rateLimit(`forgot:${email}`, 5, 60 * 60_000);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const token = randomBytes(32).toString("base64url");
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + VALIDITY_MS) },
      }),
    ]);
    await sendMail(resetPasswordMail(user.email, user.name, token));
  }
  return json({ ok: true, message: MESSAGE });
});
