import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import * as locations from "@/app/api/agent/locations/route";
import * as heartbeat from "@/app/api/agent/heartbeat/route";
import * as agentCommands from "@/app/api/agent/commands/route";
import * as ack from "@/app/api/agent/commands/[id]/ack/route";
import * as agentAlerts from "@/app/api/agent/alerts/route";
import * as commands from "@/app/api/devices/[id]/commands/route";
import * as deviceLocations from "@/app/api/devices/[id]/locations/route";
import * as geofences from "@/app/api/devices/[id]/geofences/route";
import * as alerts from "@/app/api/alerts/route";
import * as photo from "@/app/api/alerts/[id]/photo/route";
import * as cleanup from "@/app/api/cron/cleanup/route";
import * as offline from "@/app/api/cron/offline/route";
import { call, resetDb } from "./helpers";
import { newPairedDevice, newUser } from "./flows";

resetDb();

const TANA = { lat: -18.8792, lng: 47.5079 };

describe("agent : positions", () => {
  it("reçoit un lot de positions et les restitue dans l'ordre", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const now = Date.now();
    const r = await call(locations.POST, {
      token,
      body: {
        points: [
          { ...TANA, accuracy: 12, battery: 80, recordedAt: now - 120_000 },
          { lat: -18.88, lng: 47.51, accuracy: 8, battery: 79, recordedAt: new Date(now - 60_000).toISOString() },
          { lat: 0, lng: 0, recordedAt: now + 3600_000 }, // date dans le futur : ignorée
        ],
      },
    });
    expect(r.data.accepted).toBe(2);
    const list = await call(deviceLocations.GET, { cookie, params: { id: deviceId } });
    expect(list.data).toHaveLength(2);
    expect(list.data[1].battery).toBe(79);
  });

  it("refuse un appareil sans jeton valide", async () => {
    const r = await call(locations.POST, { token: "dev_faux", body: { points: [{ ...TANA, recordedAt: Date.now() }] } });
    expect(r.status).toBe(401);
  });

  it("crée une alerte à la sortie d'une zone", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    await call(geofences.POST, { cookie, params: { id: deviceId }, body: { name: "Maison", ...TANA, radiusM: 300 } });
    await call(locations.POST, { token, body: { points: [{ ...TANA, recordedAt: Date.now() - 1000 }] } });
    await call(locations.POST, { token, body: { points: [{ lat: -18.95, lng: 47.55, recordedAt: Date.now() }] } });
    const a = await call(alerts.GET, { cookie });
    expect(a.data.map((x: { type: string }) => x.type)).toContain("GEOFENCE_EXIT");
  });
});

describe("agent : battement de cœur", () => {
  it("détecte un changement de SIM et la batterie faible", async () => {
    const { cookie } = await newUser();
    const { token } = await newPairedDevice(cookie);
    await call(heartbeat.POST, { token, body: { battery: 60, mcc: "646", mnc: "02", carrierName: "Orange" } });
    const s = await call(heartbeat.POST, {
      token,
      body: { battery: 12, charging: false, mcc: "646", mnc: "04", carrierName: "Telma" },
    });
    expect(s.data.intervalSec).toBe(300);
    expect(s.data.contactPhone).toBe("+261 34 00 000 00");
    const a = await call(alerts.GET, { cookie });
    const types = a.data.map((x: { type: string }) => x.type).sort();
    expect(types).toEqual(["LOW_BATTERY", "SIM_CHANGED"]);
    const sim = a.data.find((x: { type: string }) => x.type === "SIM_CHANGED");
    expect(sim.data).toEqual({ before: "Orange", after: "Telma" });

    // Pas de nouvelle alerte batterie tant qu'on reste sous le seuil.
    await call(heartbeat.POST, { token, body: { battery: 10, charging: false } });
    expect((await call(alerts.GET, { cookie })).data).toHaveLength(2);
  });
});

describe("commandes", () => {
  it("cycle complet : création, récupération par l'appareil, accusé de réception", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const c = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "RING" } });
    expect(c.status).toBe(201);
    expect(c.data.status).toBe("PENDING");

    const pending = await call(agentCommands.GET, { token });
    expect(pending.data).toHaveLength(1);
    expect(pending.data[0].type).toBe("RING");

    const done = await call(ack.POST, { token, params: { id: c.data.id }, body: { status: "DONE" } });
    expect(done.data.status).toBe("DONE");
    // Un état terminé ne change plus.
    const back = await call(ack.POST, { token, params: { id: c.data.id }, body: { status: "ACKED" } });
    expect(back.data.status).toBe("DONE");
    expect((await call(agentCommands.GET, { token })).data).toHaveLength(0);
  });

  it("mode perdu : l'état est synchronisé et l'intervalle raccourci", async () => {
    const { cookie } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    await call(commands.POST, {
      cookie,
      params: { id: deviceId },
      body: { type: "LOST_MODE_ON", message: "Récompense si retrouvé" },
    });
    const s = await call(heartbeat.POST, { token, body: {} });
    expect(s.data.lostMode).toBe(true);
    expect(s.data.lostMessage).toBe("Récompense si retrouvé");
    expect(s.data.intervalSec).toBe(60);
    await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "LOST_MODE_OFF" } });
    expect((await call(heartbeat.POST, { token, body: {} })).data.lostMode).toBe(false);
  });

  it("verrouiller et effacer exigent le mot de passe", async () => {
    const { cookie, password } = await newUser();
    const { deviceId, token } = await newPairedDevice(cookie);
    const no = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "WIPE" } });
    expect(no.status).toBe(403);
    const bad = await call(commands.POST, { cookie, params: { id: deviceId }, body: { type: "WIPE", password: "x" } });
    expect(bad.status).toBe(403);
    const ok = await call(commands.POST, {
      cookie,
      params: { id: deviceId },
      body: { type: "LOCK", password, pin: "4821" },
    });
    expect(ok.status).toBe(201);
    expect(ok.data.payload.pin).toBe("••••"); // jamais renvoyé au site
    const agent = await call(agentCommands.GET, { token });
    expect(agent.data[0].payload.pin).toBe("4821"); // mais transmis à l'appareil
  });

  it("refuse une commande pour un appareil non associé", async () => {
    const { cookie } = await newUser();
    const d = await prisma.device.create({
      data: { name: "x", userId: (await prisma.user.findFirstOrThrow()).id },
    });
    const r = await call(commands.POST, { cookie, params: { id: d.id }, body: { type: "RING" } });
    expect(r.status).toBe(409);
  });
});

describe("alertes de l'appareil", () => {
  it("enregistre une photo d'intrus (JPEG uniquement)", async () => {
    const { cookie } = await newUser();
    const { token } = await newPairedDevice(cookie);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).toString("base64");
    const r = await call(agentAlerts.POST, {
      token,
      body: { type: "INTRUDER_PHOTO", data: { failedAttempts: 3 }, photoBase64: jpeg },
    });
    expect(r.status).toBe(201);
    const bad = await call(agentAlerts.POST, {
      token,
      body: { type: "INTRUDER_PHOTO", photoBase64: Buffer.from("pas une image").toString("base64") },
    });
    expect(bad.status).toBe(400);

    const list = await call(alerts.GET, { cookie });
    expect(list.data[0].hasPhoto).toBe(true);
    const img = await call(photo.GET, { cookie, params: { id: r.data.id } });
    expect(img.res.headers.get("content-type")).toBe("image/jpeg");

    const other = await newUser("Autre");
    expect((await call(photo.GET, { cookie: other.cookie, params: { id: r.data.id } })).status).toBe(404);
  });
});

describe("tâches planifiées", () => {
  it("protège les routes et nettoie les anciennes positions", async () => {
    expect((await call(cleanup.GET)).status).toBe(401);
    const { cookie } = await newUser();
    const { deviceId } = await newPairedDevice(cookie);
    await prisma.location.create({
      data: { deviceId, lat: 1, lng: 1, recordedAt: new Date(Date.now() - 40 * 86_400_000) },
    });
    const r = await call(cleanup.GET, { headers: { authorization: "Bearer cron-test" } });
    expect(r.data.locations).toBe(1);
  });

  it("signale un appareil hors ligne une seule fois", async () => {
    const { cookie } = await newUser();
    const { deviceId } = await newPairedDevice(cookie);
    await prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(Date.now() - 2 * 86_400_000) } });
    const h = { authorization: "Bearer cron-test" };
    expect((await call(offline.GET, { headers: h })).data.alerted).toBe(1);
    expect((await call(offline.GET, { headers: h })).data.alerted).toBe(0);
  });
});
