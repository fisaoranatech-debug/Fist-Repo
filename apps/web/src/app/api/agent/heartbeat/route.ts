import type { Prisma } from "@prisma/client";
import { heartbeatSchema, TRACKING_INTERVAL_SEC, type AgentState } from "@retrouve/shared";
import { createAlerts, type NewAlert } from "@/lib/alerts";
import { requireAgent } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { json, readJson, route } from "@/lib/http";

const LOW_BATTERY_THRESHOLD = 15;

/** Battement de cœur : l'appareil envoie son état et reçoit sa configuration. */
export const POST = route(async (req) => {
  const device = await requireAgent(req);
  const hb = await readJson(req, heartbeatSchema);

  const data: Prisma.DeviceUpdateInput = { lastSeenAt: new Date(), offlineAlertedAt: null };
  if (hb.battery !== undefined) data.battery = hb.battery;
  if (hb.charging !== undefined) data.charging = hb.charging;
  if (hb.carrierName !== undefined) data.carrierName = hb.carrierName;
  if (hb.mcc !== undefined) data.mcc = hb.mcc;
  if (hb.mnc !== undefined) data.mnc = hb.mnc;
  if (hb.pushToken !== undefined) data.pushToken = hb.pushToken;
  if (hb.appVersion) data.appVersion = hb.appVersion;
  if (hb.osVersion) data.osVersion = hb.osVersion;
  if (hb.model && !device.model) data.model = hb.model;
  if (hb.capabilities) data.capabilities = hb.capabilities;

  const alerts: NewAlert[] = [];
  // Changement de carte SIM / d'opérateur (code pays MCC + code réseau MNC).
  const simKnown = device.mcc && device.mnc;
  const simNow = hb.mcc && hb.mnc;
  if (simKnown && simNow && (device.mcc !== hb.mcc || device.mnc !== hb.mnc)) {
    alerts.push({
      deviceId: device.id,
      type: "SIM_CHANGED",
      data: {
        before: device.carrierName ?? `${device.mcc}-${device.mnc}`,
        after: hb.carrierName ?? `${hb.mcc}-${hb.mnc}`,
      },
    });
  }
  // Passage sous le seuil de batterie faible.
  if (
    hb.battery !== undefined &&
    hb.battery <= LOW_BATTERY_THRESHOLD &&
    !hb.charging &&
    (device.battery === null || device.battery > LOW_BATTERY_THRESHOLD)
  ) {
    alerts.push({ deviceId: device.id, type: "LOW_BATTERY", data: { battery: hb.battery } });
  }

  const [updated, pending, owner] = await Promise.all([
    prisma.device.update({ where: { id: device.id }, data }),
    prisma.command.count({ where: { deviceId: device.id, status: { in: ["PENDING", "SENT"] } } }),
    prisma.user.findUnique({ where: { id: device.userId }, select: { contactPhone: true } }),
    alerts.length ? createAlerts(alerts) : Promise.resolve(null),
  ]);

  const state: AgentState = {
    deviceId: updated.id,
    name: updated.name,
    lostMode: updated.lostMode,
    lostMessage: updated.lostMessage,
    contactPhone: owner?.contactPhone ?? null,
    smsSecret: updated.smsSecret,
    pendingCommands: pending,
    intervalSec: updated.lostMode ? TRACKING_INTERVAL_SEC.lost : TRACKING_INTERVAL_SEC.normal,
  };
  return json(state);
});
