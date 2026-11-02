import type { AlertType, Prisma } from "@prisma/client";
import { ALERT_ICONS, describeAlert, LABELS } from "@retrouve/shared";
import { prisma } from "./db";
import { sendMail } from "./mail";
import { alertMail } from "./mail-templates";
import { sendWebPush } from "./web-push";

export interface NewAlert {
  deviceId: string;
  type: AlertType;
  data?: Record<string, string | number | boolean | null>;
  photo?: Uint8Array<ArrayBuffer>;
}

/** Pas deux notifications du même type pour le même appareil dans cet intervalle. */
export const NOTIFY_COOLDOWN_MS = 15 * 60_000;
const NOTIFY_TIMEOUT_MS = 10_000;

/**
 * Enregistre des alertes puis prévient le propriétaire et la famille
 * (email si activé, notification du navigateur). Un échec d'envoi ne bloque jamais l'enregistrement.
 */
export async function createAlerts(inputs: NewAlert[]): Promise<{ id: string }[]> {
  const created: { id: string }[] = [];
  for (const input of inputs) {
    const alert = await prisma.alert.create({
      data: {
        deviceId: input.deviceId,
        type: input.type,
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
        photo: input.photo,
      },
      select: { id: true, createdAt: true },
    });
    created.push({ id: alert.id });
    try {
      await Promise.race([
        notify(alert.id, alert.createdAt, input),
        new Promise((resolve) => setTimeout(resolve, NOTIFY_TIMEOUT_MS)),
      ]);
    } catch (err) {
      console.error("Notification d'alerte non envoyée :", err);
    }
  }
  return created;
}

async function notify(alertId: string, createdAt: Date, input: NewAlert) {
  const recent = await prisma.alert.count({
    where: {
      deviceId: input.deviceId,
      type: input.type,
      id: { not: alertId },
      createdAt: { gte: new Date(createdAt.getTime() - NOTIFY_COOLDOWN_MS) },
    },
  });
  if (recent > 0) return;

  const device = await prisma.device.findUnique({
    where: { id: input.deviceId },
    select: {
      id: true,
      name: true,
      user: { select: { id: true, email: true, name: true, emailAlerts: true } },
      shares: { select: { user: { select: { id: true, email: true, name: true, emailAlerts: true } } } },
    },
  });
  if (!device) return;
  const recipients = [device.user, ...device.shares.map((s) => s.user)];
  const data = input.data ?? null;

  await Promise.allSettled([
    ...recipients
      .filter((r) => r.emailAlerts)
      .map((r) =>
        sendMail(alertMail({ to: r.email, name: r.name, deviceId: device.id, deviceName: device.name, type: input.type, data })),
      ),
    sendWebPush(
      recipients.map((r) => r.id),
      {
        title: `${ALERT_ICONS[input.type]} ${LABELS.alert[input.type]} : ${device.name}`,
        body: describeAlert(input.type, data),
        url: `/appareils/${device.id}`,
        tag: `${device.id}:${input.type}`,
      },
    ),
  ]);
}
