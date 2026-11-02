import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { sentMails } from "@/lib/mail";
import * as forgot from "@/app/api/auth/forgot/route";
import * as reset from "@/app/api/auth/reset/route";
import * as password from "@/app/api/auth/password/route";
import * as me from "@/app/api/auth/me/route";
import * as login from "@/app/api/auth/login/route";
import * as subscribe from "@/app/api/push/subscribe/route";
import { call, cookieFrom, resetDb } from "./helpers";
import { newPairedDevice, newUser } from "./flows";

resetDb();
beforeEach(() => {
  sentMails().length = 0;
});

const tokenFromMail = () => {
  const m = /token=([\w-]+)/.exec(sentMails().at(-1)!.text);
  return decodeURIComponent(m![1]!);
};

describe("mot de passe oublié", () => {
  it("même réponse que le compte existe ou non (pas de fuite)", async () => {
    const { user } = await newUser();
    const a = await call(forgot.POST, { body: { email: user.email } });
    const b = await call(forgot.POST, { body: { email: "inconnu@exemple.mg" } });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data.message).toBe(b.data.message);
    expect(sentMails()).toHaveLength(1);
    expect(sentMails()[0]!.to).toBe(user.email);
    expect(sentMails()[0]!.subject).toMatch(/Réinitialiser/);
  });

  it("réinitialise, déconnecte les anciennes sessions, lien à usage unique", async () => {
    const { user, cookie: oldCookie } = await newUser();
    await call(forgot.POST, { body: { email: user.email } });
    const token = tokenFromMail();

    const r = await call(reset.POST, { body: { token, password: "nouveaumotdepasse" } });
    expect(r.status).toBe(200);
    expect((await call(me.GET, { cookie: cookieFrom(r.res) })).status).toBe(200);
    expect((await call(me.GET, { cookie: oldCookie })).status).toBe(401);
    expect(sentMails().at(-1)!.subject).toMatch(/modifié/);

    expect((await call(reset.POST, { body: { token, password: "autremotdepasse" } })).status).toBe(400);
    expect((await call(login.POST, { body: { email: user.email, password: "motdepasse123" } })).status).toBe(401);
    expect((await call(login.POST, { body: { email: user.email, password: "nouveaumotdepasse" } })).status).toBe(200);
  });

  it("refuse un lien expiré", async () => {
    const { user } = await newUser();
    await call(forgot.POST, { body: { email: user.email } });
    const token = tokenFromMail();
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await call(reset.POST, { body: { token, password: "nouveaumotdepasse" } });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/plus valable/);
  });

  it("une nouvelle demande annule le lien précédent", async () => {
    const { user } = await newUser();
    await call(forgot.POST, { body: { email: user.email } });
    const first = tokenFromMail();
    await call(forgot.POST, { body: { email: user.email } });
    expect((await call(reset.POST, { body: { token: first, password: "nouveaumotdepasse" } })).status).toBe(400);
    expect((await call(reset.POST, { body: { token: tokenFromMail(), password: "nouveaumotdepasse" } })).status).toBe(200);
  });
});

describe("changement de mot de passe", () => {
  it("exige l'ancien mot de passe et garde la session courante", async () => {
    const { cookie, user } = await newUser();
    const bad = await call(password.PATCH, { method: "PATCH", cookie, body: { currentPassword: "faux", newPassword: "nouveaumotdepasse" } });
    expect(bad.status).toBe(403);
    const ok = await call(password.PATCH, {
      method: "PATCH",
      cookie,
      body: { currentPassword: "motdepasse123", newPassword: "nouveaumotdepasse" },
    });
    expect(ok.status).toBe(200);
    expect((await call(me.GET, { cookie })).status).toBe(401); // ancien cookie révoqué
    expect((await call(me.GET, { cookie: cookieFrom(ok.res) })).data.email).toBe(user.email);
  });
});

describe("suppression du compte", () => {
  it("supprime le compte et toutes ses données après confirmation", async () => {
    const { cookie } = await newUser();
    const { deviceId } = await newPairedDevice(cookie);
    await prisma.location.create({ data: { deviceId, lat: 1, lng: 1, recordedAt: new Date() } });
    expect((await call(me.DELETE, { method: "DELETE", cookie, body: { password: "faux" } })).status).toBe(403);
    const r = await call(me.DELETE, { method: "DELETE", cookie, body: { password: "motdepasse123" } });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(await prisma.device.count({ where: { id: deviceId } })).toBe(0);
    expect(await prisma.location.count({ where: { deviceId } })).toBe(0);
    expect(sentMails().at(-1)!.subject).toMatch(/supprimé/);
  });
});

describe("préférences et notifications du navigateur", () => {
  it("désactive les alertes par email", async () => {
    const { cookie } = await newUser();
    const r = await call(me.PATCH, { method: "PATCH", cookie, body: { emailAlerts: false } });
    expect(r.data.emailAlerts).toBe(false);
  });

  it("enregistre et retire un abonnement push", async () => {
    const { cookie } = await newUser();
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } };
    expect((await call(subscribe.POST, { cookie, body: sub })).status).toBe(201);
    expect((await call(subscribe.POST, { cookie, body: sub })).status).toBe(201); // idempotent
    expect(await prisma.pushSubscription.count()).toBe(1);
    expect((await call(subscribe.POST, { cookie, body: { ...sub, endpoint: "http://pas-https.com" } })).status).toBe(400);
    await call(subscribe.DELETE, { method: "DELETE", cookie, body: { endpoint: sub.endpoint } });
    expect(await prisma.pushSubscription.count()).toBe(0);
  });
});
