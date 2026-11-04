import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { notFound, route } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const alert = await prisma.alert.findUnique({ where: { id }, select: { deviceId: true, photo: true } });
  if (!alert?.photo) throw notFound("Photo");
  await requireDevice(alert.deviceId, user.id, "view");
  return new Response(Buffer.from(alert.photo), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" },
  });
});
