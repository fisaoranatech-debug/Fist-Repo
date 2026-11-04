import { pushSubscriptionSchema } from "@retrouve/shared";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { HttpError, json, readJson, route } from "@/lib/http";

/** Abonne ce navigateur aux notifications d'alertes. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const sub = await readJson(req, pushSubscriptionSchema);
  if ((await prisma.pushSubscription.count({ where: { userId: user.id } })) >= 20) {
    throw new HttpError(400, "20 navigateurs maximum par compte.");
  }
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
    },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
  return json({ ok: true }, 201);
});

/** Désabonne ce navigateur. */
export const DELETE = route(async (req) => {
  const user = await requireUser(req);
  const { endpoint } = await readJson(req, z.object({ endpoint: z.string().url() }));
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return json({ ok: true });
});
