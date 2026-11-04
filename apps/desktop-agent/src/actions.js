import { execFile } from "node:child_process";
import { platform } from "node:os";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60_000, windowsHide: true }, (err) => (err ? reject(err) : resolve()));
  });
}

/** Commandes système selon la plateforme. `sys` permet de forcer la plateforme (tests). */
export function plan(type, payload, sys = platform()) {
  const message = payload?.message ?? "Cet ordinateur a été perdu. Merci de contacter son propriétaire.";
  const phone = payload?.contactPhone ? ` Appelez le ${payload.contactPhone}.` : "";
  const text = `${message}${phone}`;
  switch (type) {
    case "RING":
      if (sys === "win32") return [["powershell", ["-NoProfile", "-Command", "1..15 | % { [console]::beep(1200,400); [console]::beep(800,400) }"]]];
      if (sys === "darwin") return Array.from({ length: 10 }, () => ["afplay", ["/System/Library/Sounds/Sosumi.aiff"]]);
      return [["sh", ["-c", "for i in $(seq 1 10); do paplay /usr/share/sounds/freedesktop/stereo/alarm-clock-elapsed.oga 2>/dev/null || printf '\\a'; sleep 1; done"]]];
    case "LOCK":
      if (sys === "win32") return [["rundll32.exe", ["user32.dll,LockWorkStation"]]];
      if (sys === "darwin") return [["pmset", ["displaysleepnow"]]];
      return [["loginctl", ["lock-session"]]];
    case "LOST_MODE_ON":
      if (sys === "win32") return [["msg", ["*", text]]];
      if (sys === "darwin") return [["osascript", ["-e", `display dialog ${JSON.stringify(text)} with title "Retrouve" buttons {"OK"} with icon stop`]]];
      return [["notify-send", ["-u", "critical", "Retrouve : ordinateur perdu", text]]];
    default:
      return [];
  }
}

export async function execute(type, payload) {
  if (type === "WIPE") throw new Error("Effacement non disponible sur ordinateur");
  if (type === "LOST_MODE_OFF" || type === "LOCATE_NOW") return;
  for (const [cmd, args] of plan(type, payload)) await run(cmd, args);
}
