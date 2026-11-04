import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

/** Emplacement du fichier de configuration selon le système. */
export function configPath() {
  if (process.env.RETROUVE_CONFIG) return process.env.RETROUVE_CONFIG;
  if (platform() === "win32") return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Retrouve", "agent.json");
  if (platform() === "darwin") return join(homedir(), "Library", "Application Support", "Retrouve", "agent.json");
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "retrouve", "agent.json");
}

export function loadConfig() {
  const p = configPath();
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveConfig(cfg) {
  const p = configPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  try {
    chmodSync(p, 0o600); // le jeton ne doit être lisible que par l'utilisateur
  } catch {
    /* Windows */
  }
  return p;
}
