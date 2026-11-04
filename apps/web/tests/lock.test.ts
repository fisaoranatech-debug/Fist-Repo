import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as commands from "@/app/api/devices/[id]/commands/route";
import * as device from "@/app/api/devices/[id]/route";
import * as heartbeat from "@/app/api/agent/heartbeat/route";
import * as unlock from "@/app/api/agent/unlock/route";
import * as shares from "@/app/api/devices/[id]/shares/route";
import { call, resetDb } from "./helpers";
import { newPairedDevice, newUser } from "./flows";

resetDb();

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("écran de blocage du mode perdu", () => {
  it("génère un code, le téléphone ne reçoit que son empreinte", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const c = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    expect(c.data.unlockCode).toMatch(/^\d{6}$/);
    const state = (await call(heartbeat.POST, { token, body: {} })).data;
    expect(state.lockHash).toBe(sha(`${deviceId}:${c.data.unlockCode}`));
    expect(JSON.stringify(state)).not.toContain(c.data.unlockCode);
    expect((await call(device.GET, { cookie, params: { id: deviceId } })).data.unlockCode).toBe(c.data.unlockCode);
  });

  it("le bon code tapé sur le téléphone met fin au mode perdu", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const c = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    const bad = await call(unlock.POST, { token, body: { code: c.data.unlockCode === "000000" ? "111111" : "000000" } });
    expect(bad.status).toBe(403);
    const ok = await call(unlock.POST, { token, body: { code: c.data.unlockCode } });
    expect(ok.data.lostMode).toBe(false);
    const state = (await call(heartbeat.POST, { token, body: {} })).data;
    expect(state.lostMode).toBe(false);
    expect(state.lockHash).toBeNull();
  });

  it("une nouvelle activation change le code ; « Retrouvé » l'efface", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const a = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_OFF" } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.lockHash).toBeNull();
    const b = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.lockHash).toBe(sha(`${deviceId}:${b.data.unlockCode}`));
    void a;
  });

  it("un membre en lecture seule ne voit pas le code", async () => {
    const owner = await newUser("Papa");
    const kid = await newUser("Enfant");
    const { deviceId } = await newPairedDevice(owner.cookie);
    await call(shares.POST, { cookie: owner.cookie, params: { id: deviceId }, body: { email: kid.user.email, role: "VIEWER" } });
    await call(commands.POST, { cookie: owner.cookie, params: { id: deviceId }, body: { type: "LOST_MODE_ON" } });
    expect((await call(device.GET, { cookie: kid.cookie, params: { id: deviceId } })).data.unlockCode).toBeNull();
  });
});

describe("SMS d'urgence", () => {
  it("le propriétaire l'active, le téléphone le reçoit dans son état", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    expect((await call(heartbeat.POST, { token, body: {} })).data.smsAlerts).toBe(false);
    const r = await call(device.PATCH, { method: "PATCH", cookie, params: { id: deviceId }, body: { smsAlerts: "on" } });
    expect(r.data.smsAlerts).toBe(true);
    expect((await call(heartbeat.POST, { token, body: {} })).data.smsAlerts).toBe(true);
    await call(device.PATCH, { method: "PATCH", cookie, params: { id: deviceId }, body: { smsAlerts: "off" } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.smsAlerts).toBe(false);
  });
});
