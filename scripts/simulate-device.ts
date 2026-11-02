/**
 * Faux appareil pour tester le site sans téléphone.
 *
 * Utilisation (le site doit tourner : npm run dev) :
 *   npm run simulate -- --email moi@exemple.mg --password motdepasse123
 *       → crée un appareil « Simulateur », l'associe et envoie un trajet en boucle
 *   npm run simulate -- --code 123456
 *       → associe un appareil existant avec le code affiché sur le site
 *   Options : --url http://localhost:3000  --interval 5  --once
 */

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name: string) => args.includes(`--${name}`);

const BASE = (opt("url", process.env.APP_URL ?? "http://localhost:3000") as string).replace(/\/$/, "");
const INTERVAL = Number(opt("interval", "5")) * 1000;
const ONCE = flag("once");

// Petit trajet dans Antananarivo (Analakely → Anosy → Isoraka…).
const ROUTE: [number, number][] = [
  [-18.9075, 47.5255], [-18.9089, 47.5236], [-18.9104, 47.5218], [-18.9121, 47.5203],
  [-18.9139, 47.5197], [-18.9158, 47.5192], [-18.9176, 47.5186], [-18.9188, 47.5172],
  [-18.9179, 47.5153], [-18.9161, 47.5146], [-18.9142, 47.5151], [-18.9123, 47.516],
  [-18.9104, 47.5172], [-18.9088, 47.519], [-18.9077, 47.5212], [-18.9071, 47.5236],
];

async function http<T>(path: string, init: { method?: string; body?: unknown; token?: string; cookie?: string } = {}): Promise<{ data: T; res: Response }> {
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  if (init.cookie) headers.Cookie = init.cookie;
  const res = await fetch(BASE + path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data?.error ?? ""}`);
  return { data: data as T, res };
}

async function obtainCode(): Promise<string> {
  const code = opt("code");
  if (code) return code;
  const email = opt("email");
  const password = opt("password");
  if (!email || !password) {
    console.error("Indiquez --code 123456, ou --email et --password d'un compte existant.");
    process.exit(1);
  }
  const login = await http("/api/auth/login", { body: { email, password } });
  const cookie = (login.res.headers.get("set-cookie") ?? "").split(";")[0]!;
  const name = opt("name", "Simulateur") as string;
  const dev = await http<{ id: string }>("/api/devices", {
    cookie,
    body: { name, type: "PHONE", model: "Téléphone simulé", imei: "490154203237518" },
  });
  const pc = await http<{ code: string }>("/api/devices/pairing-code", { cookie, body: { deviceId: dev.data.id } });
  console.log(`Appareil « ${name} » créé, code ${pc.data.code}`);
  return pc.data.code;
}

let step = 0;
let battery = 87;
function nextPoint() {
  const [lat, lng] = ROUTE[step % ROUTE.length]!;
  step++;
  battery = Math.max(5, battery - 1);
  return {
    lat: lat + (Math.random() - 0.5) * 0.0002,
    lng: lng + (Math.random() - 0.5) * 0.0002,
    accuracy: 5 + Math.random() * 20,
    battery,
    source: "GPS",
    recordedAt: new Date().toISOString(),
  };
}

async function main() {
  const code = await obtainCode();
  const pair = await http<{ token: string; deviceId: string; name: string }>("/api/agent/pair", {
    body: { code, platform: "simulateur", model: "Téléphone simulé", osVersion: "1.0" },
  });
  const token = pair.data.token;
  console.log(`✅ Associé : ${pair.data.name} (${pair.data.deviceId})`);

  if (ONCE) {
    // Un trajet complet d'un coup, avec des dates étalées sur les 30 dernières minutes.
    const now = Date.now();
    const points = ROUTE.map(([lat, lng], i) => ({
      lat, lng, accuracy: 10, battery: 90 - i, source: "GPS",
      recordedAt: new Date(now - (ROUTE.length - i) * 120_000).toISOString(),
    }));
    await http("/api/agent/locations", { token, body: { points } });
    await http("/api/agent/heartbeat", { token, body: { battery: 74, charging: false, carrierName: "Telma", mcc: "646", mnc: "04", capabilities: ["ring", "lostMode"] } });
    console.log(`📍 ${points.length} positions envoyées.`);
    console.log(`TOKEN=${token}`);
    return;
  }

  for (;;) {
    const point = nextPoint();
    const state = await http<{ lostMode: boolean; intervalSec: number }>("/api/agent/heartbeat", {
      token,
      body: { battery, charging: false, carrierName: "Telma", mcc: "646", mnc: "04", capabilities: ["ring", "lostMode"] },
    });
    await http("/api/agent/locations", { token, body: { points: [point] } });
    console.log(`📍 ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · 🔋 ${battery} %${state.data.lostMode ? " · 🚨 mode perdu" : ""}`);

    const cmds = await http<{ id: string; type: string; payload: unknown }[]>("/api/agent/commands", { token });
    for (const c of cmds.data) {
      console.log(`⚡ Commande reçue : ${c.type}`, c.payload ?? "");
      if (c.type === "LOCATE_NOW") await http("/api/agent/locations", { token, body: { points: [nextPoint()] } });
      const unsupported = c.type === "LOCK" || c.type === "WIPE";
      await http(`/api/agent/commands/${c.id}/ack`, {
        token,
        body: unsupported ? { status: "FAILED", result: "Non disponible sur le simulateur" } : { status: "DONE", result: "Simulé" },
      });
    }
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
