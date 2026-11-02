import { hostname, platform, release } from "node:os";
import { agentApi, HttpError } from "./api.js";
import { execute } from "./actions.js";
import { locate } from "./locate.js";

const done = new Set();

/** Un cycle : position → état → commandes. Renvoie l'intervalle conseillé (secondes). */
export async function cycle(cfg, log = console.log) {
  const api = agentApi(cfg.apiUrl, cfg.token);
  const sendPosition = async () => {
    const pos = await locate(cfg);
    if (!pos) {
      log("Position indisponible (pas d'accès aux services de géolocalisation IP).");
      return null;
    }
    await api.sendLocations([{ lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, source: pos.source, recordedAt: new Date().toISOString() }]);
    log(`📍 ${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)} (${pos.where || pos.source})`);
    return pos;
  };

  await sendPosition();
  const state = await api.heartbeat({
    appVersion: "desktop-0.1.0",
    model: hostname(),
    osVersion: `${platform()} ${release()}`,
    capabilities: ["ring", "lostMode", "locate", "lock"],
  });

  if (state.pendingCommands > 0) {
    for (const cmd of await api.getCommands()) {
      if (done.has(cmd.id)) continue;
      done.add(cmd.id);
      log(`⚡ Commande : ${cmd.type}`);
      try {
        await api.ack(cmd.id, { status: "ACKED" });
        if (cmd.type === "LOCATE_NOW") await sendPosition();
        await execute(cmd.type, cmd.payload);
        await api.ack(cmd.id, { status: "DONE" });
      } catch (err) {
        await api.ack(cmd.id, { status: "FAILED", result: String(err.message).slice(0, 400) }).catch(() => {});
      }
    }
  }
  return state.intervalSec ?? 300;
}

export async function runForever(cfg) {
  for (;;) {
    let wait = 300;
    try {
      wait = await cycle(cfg);
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        console.error("Cet ordinateur n'est plus associé (supprimé du compte ?). Relancez « retrouve-agent pair ».");
        process.exit(2);
      }
      console.error("Erreur :", err.message, "(nouvel essai dans 5 min)");
    }
    // Vérifie les commandes plus souvent que la position (toutes les 60 s au maximum).
    await new Promise((r) => setTimeout(r, Math.min(wait, 60) * 1000));
  }
}
