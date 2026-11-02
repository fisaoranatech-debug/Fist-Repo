import * as register from "@/app/api/auth/register/route";
import * as devices from "@/app/api/devices/route";
import * as pairingCode from "@/app/api/devices/pairing-code/route";
import * as pair from "@/app/api/agent/pair/route";
import { call, cookieFrom } from "./helpers";

let n = 0;
export async function newUser(name = "Nyavo") {
  n++;
  const r = await call(register.POST, {
    body: { name, email: `user${n}-${Date.now()}@exemple.mg`, password: "motdepasse123", contactPhone: "+261 34 00 000 00" },
  });
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  return { cookie: cookieFrom(r.res), user: r.data as { id: string; email: string }, password: "motdepasse123" };
}

export async function newPairedDevice(cookie: string, name = "Mon Samsung") {
  const d = await call(devices.POST, { cookie, body: { name, type: "PHONE", imei: "490154203237518" } });
  const code = await call(pairingCode.POST, { cookie, body: { deviceId: d.data.id } });
  const p = await call(pair.POST, { body: { code: code.data.code, platform: "android", model: "Galaxy A15" } });
  if (p.status !== 201) throw new Error(JSON.stringify(p.data));
  return { deviceId: d.data.id as string, token: p.data.token as string };
}
