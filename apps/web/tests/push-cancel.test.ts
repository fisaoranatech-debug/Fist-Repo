import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { sendWakeUpPush } from "@/lib/push";
import * as commands from "@/app/api/devices/[id]/commands/route";
import * as cancel from "@/app/api/devices/[id]/commands/[cid]/route";
import * as heartbeat from "@/app/api/agent/heartbeat/route";
import * as agentCommands from "@/app/api/agent/commands/route";
import * as report from "@/app/api/devices/[id]/report/route";
import * as shares from "@/app/api/devices/[id]/shares/route";
import { call, resetDb } from "./helpers";
import { newPairedDevice, newUser } from "./flows";

resetDb();

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

const TOKEN = "ExponentPushToken[abc123]";

function mockExpo(body: unknown, status = 200) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("réveil par notification push (réponse d'Expo)", () => {
  it("sans jeton : no-token, aucun appel réseau", async () => {
    const f = mockExpo({});
    expect(await sendWakeUpPush({ id: "x", pushToken: null }, {})).toBe("no-token");
    expect(f).not.toHaveBeenCalled();
  });

  it("ticket ok : sent", async () => {
    delete process.env.PUSH_DISABLED;
    mockExpo({ data: { status: "ok", id: "t1" } });
    expect(await sendWakeUpPush({ id: "x", pushToken: TOKEN }, {})).toBe("sent");
  });

  it("ticket en erreur : failed (Expo répond pourtant 200)", async () => {
    delete process.env.PUSH_DISABLED;
    mockExpo({ data: { status: "error", message: "creds", details: { error: "InvalidCredentials" } } });
    expect(await sendWakeUpPush({ id: "x", pushToken: TOKEN }, {})).toBe("failed");
  });

  it("DeviceNotRegistered : le jeton est effacé", async () => {
    const { cookie } = await newUser();
    const { deviceId } = await newPairedDevice(cookie);
    await prisma.device.update({ where: { id: deviceId }, data: { pushToken: TOKEN } });
    delete process.env.PUSH_DISABLED;
    mockExpo({ data: { status: "error", details: { error: "DeviceNotRegistered" } } });
    expect(await sendWakeUpPush({ id: deviceId, pushToken: TOKEN }, {})).toBe("failed");
    expect((await prisma.device.findUniqueOrThrow({ where: { id: deviceId } })).pushToken).toBeNull();
  });

  it("la création de commande indique le résultat du réveil", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    let r = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "RING" } });
    expect(r.data.wakeUp).toBe("no-token");
    await call(heartbeat.POST, { token, body: { pushToken: TOKEN } });
    delete process.env.PUSH_DISABLED;
    mockExpo({ data: { status: "ok" } });
    r = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOCATE_NOW" } });
    expect(r.data.wakeUp).toBe("sent");
  });
});

describe("annulation d'une commande", () => {
  it("annule une commande en attente, elle n'est plus envoyée à l'appareil", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const c = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "RING" } });
    const r = await call(cancel.DELETE, { method: "DELETE", cookie, params: { id: deviceId, cid: c.data.id } });
    expect(r.status).toBe(200);
    expect(r.data.status).toBe("FAILED");
    expect(r.data.result).toBe("Annulée par l'utilisateur");
    expect((await call(agentCommands.GET, { token })).data).toHaveLength(0);
    // Déjà traitée : on ne peut plus l'annuler.
    expect((await call(cancel.DELETE, { method: "DELETE", cookie, params: { id: deviceId, cid: c.data.id } })).status).toBe(409);
  });

  it("annuler le mode perdu remet l'appareil en état normal", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const c = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    await call(cancel.DELETE, { method: "DELETE", cookie, params: { id: deviceId, cid: c.data.id } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.lostMode).toBe(false);
  });

  it("un membre en lecture seule ne peut pas annuler", async () => {
    const owner = await newUser("Papa");
    const kid = await newUser("Enfant");
    const { deviceId } = await newPairedDevice(owner.cookie);
    await call(shares.POST, { cookie: owner.cookie, params: { id: deviceId }, body: { email: kid.user.email, role: "VIEWER" } });
    const c = await call(commands.POST, { cookie: owner.cookie, params: { id: deviceId }, body: { type: "RING" } });
    expect((await call(cancel.DELETE, { method: "DELETE", cookie: kid.cookie, params: { id: deviceId, cid: c.data.id } })).status).toBe(403);
  });
});

describe("PDF sur Vercel", () => {
  it("se génère même si TZ vaut « :UTC » (valeur de Vercel)", async () => {
    process.env.TZ = ":UTC";
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    await prisma.location.create({ data: { deviceId, lat: -18.9, lng: 47.5, recordedAt: new Date() } });
    void token;
    const r = await call(report.GET, { cookie, params: { id: deviceId } });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("content-type")).toBe("application/pdf");
  });
});

describe("suivi en direct et fréquence", () => {
  it("ouvrir la fiche passe l'appareil en direct (15 s), puis il revient à son rythme", async () => {
    const live = await import("@/app/api/devices/[id]/live/route");
    const device = await import("@/app/api/devices/[id]/route");
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    expect((await call(heartbeat.POST, { token, body: {} })).data.intervalSec).toBe(300);

    const r = await call(live.POST, { cookie, params: { id: deviceId } });
    expect(r.data.live).toBe(true);
    expect((await call(heartbeat.POST, { token, body: {} })).data.intervalSec).toBe(15);
    expect((await call(device.GET, { cookie, params: { id: deviceId } })).data.live).toBe(true);

    await prisma.device.update({ where: { id: deviceId }, data: { liveUntil: new Date(Date.now() - 1000) } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.intervalSec).toBe(300);
  });

  it("le propriétaire choisit la fréquence normale", async () => {
    const device = await import("@/app/api/devices/[id]/route");
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const ok = await call(device.PATCH, { method: "PATCH", cookie, params: { id: deviceId }, body: { trackingIntervalSec: "60" } });
    expect(ok.data.trackingIntervalSec).toBe(60);
    expect((await call(heartbeat.POST, { token, body: {} })).data.intervalSec).toBe(60);
    const bad = await call(device.PATCH, { method: "PATCH", cookie, params: { id: deviceId }, body: { trackingIntervalSec: 5 } });
    expect(bad.status).toBe(400);
  });
});
