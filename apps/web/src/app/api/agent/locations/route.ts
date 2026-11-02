import { locationBatchSchema } from "@retrouve/shared";
import { requireAgent } from "@/lib/auth";
import { json, readJson, route } from "@/lib/http";
import { ingestLocations } from "@/lib/locations";

export const POST = route(async (req) => {
  const device = await requireAgent(req);
  const { points } = await readJson(req, locationBatchSchema);
  const result = await ingestLocations(device, points);
  return json(result);
});
