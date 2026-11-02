import { requireDevice, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { route } from "@/lib/http";
import { buildReportPdf } from "@/lib/report";

type Ctx = { params: Promise<{ id: string }> };

/** PDF de déclaration de perte ou de vol (à présenter à la police et à l'opérateur). */
export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser(req);
  const { id } = await params;
  const { device } = await requireDevice(id, user.id, "view");
  const [owner, locations] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: device.userId } }),
    prisma.location.findMany({ where: { deviceId: id }, orderBy: { recordedAt: "desc" }, take: 15 }),
  ]);
  const bytes = await buildReportPdf({ device, owner, locations });
  const safeName = device.name.normalize("NFD").replace(/[^\w-]+/g, "_").slice(0, 40) || "appareil";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="declaration-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
