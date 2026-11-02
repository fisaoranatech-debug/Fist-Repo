import * as Battery from "expo-battery";
import * as Cellular from "expo-cellular";
import * as Device from "expo-device";
import * as Location from "expo-location";
import type { AgentCommand, AgentState } from "@retrouve/shared";
import { agentApi, type AgentApi } from "./api";
import { runCommands } from "./commands";
import { APP_VERSION, CRITICAL_BATTERY, RING_SECONDS } from "./config";
import { sqliteQueue } from "./db";
import { HttpStatusError } from "./http";
import { RetrouveNative } from "./native";
import { getPushToken, hideLostModeNotification, ringWithNotification, showLostModeNotification } from "./notifications";
import { enqueuePoints, flushQueue } from "./queue";
import {
  getState,
  isCommandDone,
  loadCredentials,
  markCommandDone,
  patchStatus,
  setState,
  type Credentials,
} from "./storage";
import { startTracking, stopTracking, toPoint } from "./tracking";

async function batteryInfo(): Promise<{ level?: number; charging?: boolean }> {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return {
      level: level >= 0 ? Math.round(level * 100) : undefined,
      charging: state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL,
    };
  } catch {
    return {};
  }
}

async function cellularInfo() {
  try {
    const [carrierName, mcc, mnc] = await Promise.all([
      Cellular.getCarrierNameAsync(),
      Cellular.getMobileCountryCodeAsync(),
      Cellular.getMobileNetworkCodeAsync(),
    ]);
    return { carrierName, mcc, mnc };
  } catch {
    return {};
  }
}

function capabilities(): string[] {
  const caps = ["ring", "lostMode", "locate"];
  if (RetrouveNative) {
    caps.push("sms");
    if (RetrouveNative.isAdminActive()) caps.push("deviceAdmin");
  }
  return caps;
}

/** Position immédiate (haute précision), avec repli sur la dernière connue. */
async function currentPosition(): Promise<Location.LocationObject | null> {
  try {
    return await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), 25_000)),
    ]) ?? (await Location.getLastKnownPositionAsync());
  } catch {
    return Location.getLastKnownPositionAsync().catch(() => null);
  }
}

async function applyState(creds: Credentials, state: AgentState, previous: AgentState | null) {
  await setState(state);
  RetrouveNative?.setAgentConfig(creds.apiUrl, creds.token, state.smsSecret, state.contactPhone);
  if (state.lostMode) {
    await showLostModeNotification(state.lostMessage ?? "Ce téléphone a été perdu.", state.contactPhone);
  } else if (previous?.lostMode) {
    await hideLostModeNotification();
  }
  if (previous && previous.intervalSec !== state.intervalSec) {
    await startTracking(state.intervalSec).catch(() => {});
  }
}

function commandDeps(api: AgentApi, creds: Credentials) {
  return {
    ring: async () => {
      if (RetrouveNative) {
        RetrouveNative.startAlarm(RING_SECONDS);
        return `Sonnerie pendant ${RING_SECONDS} s`;
      }
      await ringWithNotification();
      return "Notification sonore (module natif absent)";
    },
    locateNow: async () => {
      const loc = await currentPosition();
      if (!loc) throw new Error("Position indisponible (localisation désactivée ?)");
      const { level } = await batteryInfo();
      await enqueuePoints(sqliteQueue, [toPoint(loc, level)]);
      await flushQueue(sqliteQueue, api.sendLocations);
      return `Précision ±${Math.round(loc.coords.accuracy ?? 0)} m`;
    },
    setLostMode: async (on: boolean, payload: AgentCommand["payload"]) => {
      const prev = await getState();
      if (!prev) return;
      const next: AgentState = {
        ...prev,
        lostMode: on,
        lostMessage: on ? payload?.message ?? prev.lostMessage : prev.lostMessage,
        contactPhone: on ? payload?.contactPhone || prev.contactPhone : prev.contactPhone,
        intervalSec: on ? 60 : 300,
      };
      await applyState(creds, next, prev);
    },
    lock: async (pin: string | null) => {
      if (!RetrouveNative) throw new Error("Verrouillage indisponible sur cet appareil");
      if (!RetrouveNative.isAdminActive()) throw new Error("Administrateur de l'appareil non activé dans Retrouve");
      const pinApplied = RetrouveNative.lockNow(pin);
      return pin && !pinApplied ? "Écran verrouillé (PIN non modifiable sur cette version d'Android)" : "Écran verrouillé";
    },
    wipe: async () => {
      if (!RetrouveNative?.isAdminActive()) throw new Error("Administrateur de l'appareil non activé dans Retrouve");
      RetrouveNative.wipe();
    },
    ack: (id: string, body: Parameters<AgentApi["ack"]>[1]) => api.ack(id, body).then(() => undefined),
    alreadyDone: isCommandDone,
    markDone: markCommandDone,
  };
}

let chain: Promise<void> = Promise.resolve();

/**
 * Synchronisation complète avec le serveur :
 * positions en attente → état de l'appareil → commandes.
 * Appelée par la tâche de localisation, le réveil périodique, les notifications push et l'écran d'accueil.
 */
export function sync(opts: { reason: string; locations?: Location.LocationObject[]; forceLocate?: boolean } = { reason: "manual" }) {
  // Les synchronisations s'enchaînent une par une (jamais deux en même temps).
  const job = chain.then(() => doSync(opts));
  chain = job.catch(() => {});
  return job;
}

async function doSync({ locations = [], forceLocate = false }: { reason: string; locations?: Location.LocationObject[]; forceLocate?: boolean }) {
  const creds = await loadCredentials();
  if (!creds) return;
  const api = agentApi(creds.apiUrl, creds.token);
  const battery = await batteryInfo();

  let locs = locations;
  // Batterie presque vide ou demande explicite : on envoie une position fraîche tout de suite.
  const critical = battery.level !== undefined && battery.level <= CRITICAL_BATTERY && !battery.charging;
  if ((forceLocate || critical) && locs.length === 0) {
    const loc = await currentPosition();
    if (loc) locs = [loc];
  }
  if (locs.length) {
    await enqueuePoints(sqliteQueue, locs.map((l) => toPoint(l, battery.level)));
    await patchStatus({ lastLocationAt: new Date(locs[locs.length - 1]!.timestamp).toISOString() });
  }

  try {
    const flush = await flushQueue(sqliteQueue, api.sendLocations);
    if (flush.error) throw flush.error;

    const previous = await getState();
    const state = await api.heartbeat({
      battery: battery.level,
      charging: battery.charging,
      ...(await cellularInfo()),
      pushToken: await getPushToken(),
      appVersion: APP_VERSION,
      model: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || undefined,
      osVersion: Device.osVersion ? `Android ${Device.osVersion}` : undefined,
      capabilities: capabilities(),
    });
    await applyState(creds, state, previous);

    if (state.pendingCommands > 0) {
      const commands = await api.getCommands();
      await runCommands(commands, commandDeps(api, creds));
    }
    await patchStatus({ lastSyncAt: new Date().toISOString(), lastSyncOk: true, lastError: null, revoked: false });
  } catch (err) {
    if (err instanceof HttpStatusError && err.status === 401) {
      // Appareil supprimé ou associé sur un autre téléphone : on arrête tout.
      await patchStatus({ revoked: true, lastSyncOk: false, lastError: err.message });
      await stopTracking();
      RetrouveNative?.setAgentConfig(null, null, null, null);
      return;
    }
    await patchStatus({ lastSyncAt: new Date().toISOString(), lastSyncOk: false, lastError: (err as Error).message });
  }
}
