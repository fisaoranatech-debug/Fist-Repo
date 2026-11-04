import { afterEach, describe, expect, it } from "vitest";
import { authSecret } from "@/lib/env";
import { requireCron } from "@/app/api/cron/auth";
import { signSession, verifySession } from "@/lib/session";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("clé de session sans AUTH_SECRET", () => {
  it("dérive une clé stable de l'adresse de la base", async () => {
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL_UNPOOLED = "postgresql://u:motdepasse@hote/base";
    const a = await authSecret();
    const b = await authSecret();
    expect(a).toEqual(b);
    expect(a.length).toBe(32);
    const token = await signSession("user1", 0);
    expect((await verifySession(token))?.userId).toBe("user1");
  });

  it("une autre base donne une autre clé (les jetons ne sont plus valides)", async () => {
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL_UNPOOLED = "postgresql://u:a@hote/base";
    const token = await signSession("user1", 0);
    process.env.DATABASE_URL_UNPOOLED = "postgresql://u:b@hote/base";
    expect(await verifySession(token)).toBeNull();
  });

  it("refuse un AUTH_SECRET trop court", async () => {
    process.env.AUTH_SECRET = "court";
    await expect(authSecret()).rejects.toThrow(/trop court/);
  });
});

describe("tâches planifiées sans CRON_SECRET", () => {
  const req = (headers: Record<string, string>) => new Request("http://x/api/cron/cleanup", { headers });

  it("accepte le planificateur Vercel, refuse le reste", () => {
    delete process.env.CRON_SECRET;
    process.env.VERCEL = "1";
    expect(() => requireCron(req({ "user-agent": "vercel-cron/1.0" }))).not.toThrow();
    expect(() => requireCron(req({ "user-agent": "curl/8" }))).toThrow();
  });

  it("hors Vercel, refuse toujours sans secret", () => {
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL;
    expect(() => requireCron(req({ "user-agent": "vercel-cron/1.0" }))).toThrow();
  });

  it("avec CRON_SECRET, le jeton est obligatoire", () => {
    process.env.CRON_SECRET = "s3cret";
    process.env.VERCEL = "1";
    expect(() => requireCron(req({ "user-agent": "vercel-cron/1.0" }))).toThrow();
    expect(() => requireCron(req({ authorization: "Bearer s3cret" }))).not.toThrow();
  });
});
