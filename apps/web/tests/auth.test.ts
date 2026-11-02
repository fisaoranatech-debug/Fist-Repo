import { describe, expect, it } from "vitest";
import * as register from "@/app/api/auth/register/route";
import * as login from "@/app/api/auth/login/route";
import * as me from "@/app/api/auth/me/route";
import * as devices from "@/app/api/devices/route";
import { call, cookieFrom, resetDb } from "./helpers";

resetDb();

describe("comptes", () => {
  it("inscription, connexion et profil", async () => {
    const r = await call(register.POST, {
      body: { name: "Rasoa", email: "Rasoa@Exemple.mg", password: "motdepasse123" },
    });
    expect(r.status).toBe(201);
    expect(r.res.headers.get("set-cookie")).toContain("HttpOnly");

    const l = await call(login.POST, { body: { email: "rasoa@exemple.mg", password: "motdepasse123" } });
    expect(l.status).toBe(200);
    const m = await call(me.GET, { cookie: cookieFrom(l.res) });
    expect(m.data.email).toBe("rasoa@exemple.mg");
  });

  it("refuse un email déjà utilisé", async () => {
    const body = { name: "A", email: "a@exemple.mg", password: "motdepasse123" };
    await call(register.POST, { body });
    expect((await call(register.POST, { body })).status).toBe(409);
  });

  it("refuse un mauvais mot de passe puis bloque après trop d'essais", async () => {
    await call(register.POST, { body: { name: "B", email: "b@exemple.mg", password: "motdepasse123" } });
    for (let i = 0; i < 8; i++) {
      const r = await call(login.POST, { body: { email: "b@exemple.mg", password: "faux" } });
      expect(r.status).toBe(401);
    }
    const blocked = await call(login.POST, { body: { email: "b@exemple.mg", password: "motdepasse123" } });
    expect(blocked.status).toBe(429);
  });

  it("valide les données avec des messages en français", async () => {
    const r = await call(register.POST, { body: { name: "", email: "pas-un-email", password: "court" } });
    expect(r.status).toBe(400);
    expect(r.data.details.email).toBeDefined();
  });

  it("exige une session et rejette les requêtes d'un autre site", async () => {
    expect((await call(devices.GET)).status).toBe(401);
    const r = await call(register.POST, { body: { name: "C", email: "c@exemple.mg", password: "motdepasse123" } });
    const cross = await call(devices.POST, {
      cookie: cookieFrom(r.res),
      body: { name: "x" },
      headers: { origin: "https://site-malveillant.com", host: "localhost:3000" },
    });
    expect(cross.status).toBe(403);
  });

  it("refuse un jeton de session falsifié", async () => {
    const r = await call(me.GET, { cookie: "retrouve_session=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.faux" });
    expect(r.status).toBe(401);
  });
});
