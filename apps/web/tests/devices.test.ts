import { describe, expect, it } from "vitest";
import * as devices from "@/app/api/devices/route";
import * as device from "@/app/api/devices/[id]/route";
import * as pairingCode from "@/app/api/devices/pairing-code/route";
import * as pair from "@/app/api/agent/pair/route";
import * as heartbeat from "@/app/api/agent/heartbeat/route";
import * as shares from "@/app/api/devices/[id]/shares/route";
import * as commands from "@/app/api/devices/[id]/commands/route";
import * as report from "@/app/api/devices/[id]/report/route";
import { call, resetDb } from "./helpers";
import { newPairedDevice, newUser } from "./flows";

resetDb();

describe("appareils et association", () => {
  it("crée un appareil, l'associe avec un code et refuse la réutilisation du code", async () => {
    const { cookie } = await newUser();
    const d = await call(devices.POST, { cookie, body: { name: "Tel de maman", imei: "490154203237518" } });
    expect(d.status).toBe(201);
    expect(d.data.paired).toBe(false);

    const code = await call(pairingCode.POST, { cookie, body: { deviceId: d.data.id } });
    expect(code.data.code).toMatch(/^\d{6}$/);

    const p = await call(pair.POST, { body: { code: code.data.code, platform: "android", model: "Tecno Spark" } });
    expect(p.status).toBe(201);
    expect(p.data.token).toMatch(/^dev_/);

    const again = await call(pair.POST, { body: { code: code.data.code } });
    expect(again.status).toBe(400);

    const got = await call(device.GET, { cookie, params: { id: d.data.id } });
    expect(got.data.paired).toBe(true);
    expect(got.data.model).toBe("Tecno Spark");
  });

  it("une nouvelle association déconnecte l'ancien téléphone", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const code = await call(pairingCode.POST, { cookie, body: { deviceId } });
    await call(pair.POST, { body: { code: code.data.code } });
    const old = await call(heartbeat.POST, { token, body: { battery: 50 } });
    expect(old.status).toBe(401);
  });

  it("un autre utilisateur ne voit pas mes appareils (404)", async () => {
    const a = await newUser("A");
    const b = await newUser("B");
    const { deviceId } = await newPairedDevice(a.cookie);
    expect((await call(device.GET, { cookie: b.cookie, params: { id: deviceId } })).status).toBe(404);
    expect((await call(report.GET, { cookie: b.cookie, params: { id: deviceId } })).status).toBe(404);
    expect(
      (await call(commands.POST, { cookie: b.cookie, params: { id: deviceId }, body: { type: "RING" } })).status,
    ).toBe(404);
    expect((await call(pairingCode.POST, { cookie: b.cookie, body: { deviceId } })).status).toBe(404);
    const list = await call(devices.GET, { cookie: b.cookie });
    expect(list.data).toHaveLength(0);
  });

  it("partage familial : lecture seule puis contrôle", async () => {
    const owner = await newUser("Papa");
    const kid = await newUser("Enfant");
    const { deviceId } = await newPairedDevice(owner.cookie);

    const s = await call(shares.POST, {
      cookie: owner.cookie,
      params: { id: deviceId },
      body: { email: kid.user.email, role: "VIEWER" },
    });
    expect(s.status).toBe(201);

    const list = await call(devices.GET, { cookie: kid.cookie });
    expect(list.data[0].access).toBe("VIEWER");
    expect(list.data[0].ownerName).toBe("Papa");

    const ring = await call(commands.POST, { cookie: kid.cookie, params: { id: deviceId }, body: { type: "RING" } });
    expect(ring.status).toBe(403);

    await call(shares.POST, {
      cookie: owner.cookie,
      params: { id: deviceId },
      body: { email: kid.user.email, role: "CONTROLLER" },
    });
    const ring2 = await call(commands.POST, { cookie: kid.cookie, params: { id: deviceId }, body: { type: "RING" } });
    expect(ring2.status).toBe(201);

    // Seul le propriétaire peut supprimer.
    expect((await call(device.DELETE, { cookie: kid.cookie, params: { id: deviceId } })).status).toBe(403);
  });

  it("génère le PDF de déclaration", async () => {
    const { cookie } = await newUser();
    const { deviceId } = await newPairedDevice(cookie);
    const r = await call(report.GET, { cookie, params: { id: deviceId } });
    expect(r.status).toBe(200);
    expect(r.res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await r.res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});
