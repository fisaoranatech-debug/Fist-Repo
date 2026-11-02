import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

/** Lance l'agent automatiquement à l'ouverture de session. */
export function installService(cliPath) {
  const node = process.execPath;
  const sys = platform();
  if (sys === "win32") {
    execFileSync("schtasks", ["/Create", "/F", "/SC", "ONLOGON", "/TN", "Retrouve", "/TR", `"${node}" "${cliPath}" run`, "/RL", "LIMITED"]);
    return "Tâche planifiée « Retrouve » créée (démarrage à l'ouverture de session).";
  }
  if (sys === "darwin") {
    const dir = join(homedir(), "Library", "LaunchAgents");
    mkdirSync(dir, { recursive: true });
    const plist = join(dir, "mg.retrouve.agent.plist");
    writeFileSync(
      plist,
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>mg.retrouve.agent</string>
  <key>ProgramArguments</key><array><string>${node}</string><string>${cliPath}</string><string>run</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict></plist>
`,
    );
    execFileSync("launchctl", ["load", "-w", plist]);
    return `Agent installé : ${plist}`;
  }
  const dir = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "systemd", "user");
  mkdirSync(dir, { recursive: true });
  const unit = join(dir, "retrouve-agent.service");
  writeFileSync(
    unit,
    `[Unit]
Description=Agent Retrouve (localisation de l'ordinateur)
After=network-online.target

[Service]
ExecStart=${node} ${cliPath} run
Restart=always
RestartSec=30

[Install]
WantedBy=default.target
`,
  );
  execFileSync("systemctl", ["--user", "daemon-reload"]);
  execFileSync("systemctl", ["--user", "enable", "--now", "retrouve-agent.service"]);
  return `Service systemd utilisateur installé : ${unit}`;
}
