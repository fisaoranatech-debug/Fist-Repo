#!/usr/bin/env node
import { hostname, platform, release } from "node:os";
import { fileURLToPath } from "node:url";
import { pair } from "./api.js";
import { cycle, runForever } from "./agent.js";
import { configPath, loadConfig, saveConfig } from "./config.js";
import { installService } from "./service.js";

const [, , command, ...rest] = process.argv;
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

const HELP = `Agent Retrouve pour ordinateur

  retrouve-agent pair <code> --url https://mon-site.vercel.app [--lat -18.91 --lng 47.52]
      Associe cet ordinateur (code à 6 chiffres affiché sur le site).
      --lat/--lng : position fixe pour un ordinateur de bureau qui ne bouge pas.
  retrouve-agent run          Envoie la position et exécute les commandes en continu.
  retrouve-agent once         Un seul cycle (test).
  retrouve-agent install      Démarrage automatique à l'ouverture de session.
  retrouve-agent status       Affiche la configuration.

La position d'un ordinateur sans GPS est approximative (adresse IP : quartier ou ville).`;

async function main() {
  switch (command) {
    case "pair": {
      const code = rest.find((a) => /^\d{6}$/.test(a));
      const url = opt("url") ?? process.env.RETROUVE_URL;
      if (!code || !url) throw new Error("Usage : retrouve-agent pair 123456 --url https://mon-site.vercel.app");
      const res = await pair(url, { code, platform: platform(), model: hostname(), osVersion: `${platform()} ${release()}` });
      const lat = Number(opt("lat"));
      const lng = Number(opt("lng"));
      const cfg = {
        apiUrl: url.replace(/\/$/, ""),
        token: res.token,
        deviceId: res.deviceId,
        name: res.name,
        ...(Number.isFinite(lat) && Number.isFinite(lng) && opt("lat") ? { fixedLocation: { lat, lng } } : {}),
      };
      const p = saveConfig(cfg);
      console.log(`✅ « ${res.name} » associé. Configuration : ${p}`);
      console.log("Lancez « retrouve-agent install » pour démarrer automatiquement.");
      return;
    }
    case "run":
    case "once": {
      const cfg = loadConfig();
      if (!cfg) throw new Error("Ordinateur non associé : lancez d'abord « retrouve-agent pair ».");
      if (command === "once") await cycle(cfg);
      else await runForever(cfg);
      return;
    }
    case "install":
      console.log(installService(fileURLToPath(import.meta.url)));
      return;
    case "status": {
      const cfg = loadConfig();
      console.log(cfg ? { ...cfg, token: "••••", config: configPath() } : "Non associé.");
      return;
    }
    default:
      console.log(HELP);
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
