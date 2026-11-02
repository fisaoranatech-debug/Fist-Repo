import { agentAlertSchema } from "@retrouve/shared";
import { createAlerts } from "@/lib/alerts";
import { requireAgent } from "@/lib/auth";
import { HttpError, json, readJson, route } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

/** Alerte signalée par l'appareil lui-même (ex. photo d'un intrus après de mauvais codes). */
export const POST = route(async (req) => {
  const device = await requireAgent(req);
  await rateLimit(`alert:${device.id}`, 30, 60 * 60_000);
  const input = await readJson(req, agentAlertSchema);
  let photo: Buffer | undefined;
  if (input.photoBase64) {
    photo = Buffer.from(input.photoBase64, "base64");
    const isJpeg = photo.length > 3 && photo[0] === 0xff && photo[1] === 0xd8 && photo[2] === 0xff;
    if (!isJpeg) throw new HttpError(400, "La photo doit être au format JPEG.");
  }
  const [alert] = await createAlerts([
    { deviceId: device.id, type: input.type, data: input.data, photo: photo ? new Uint8Array(photo) as Uint8Array<ArrayBuffer> : undefined },
  ]);
  return json({ id: alert!.id }, 201);
});
