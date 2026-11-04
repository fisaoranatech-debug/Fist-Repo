import type { Device, Prisma, User } from "@prisma/client";
import { SENSITIVE_COMMANDS, type CommandCreateInput } from "@retrouve/shared";
import { prisma } from "./db";
import { forbidden, HttpError } from "./http";
import { verifyPassword } from "./password";
import { generatePairingCode, unlockHash } from "./crypto";
import { sendWakeUpPush } from "./push";

/** Crée une commande pour un appareil et tente de le réveiller par push. */
export async function createCommand(device: Device, user: User, input: CommandCreateInput) {
  if (!device.tokenHash) {
    throw new HttpError(409, "Cet appareil n'est pas encore associé à l'application.");
  }
  if (SENSITIVE_COMMANDS.includes(input.type)) {
    if (!input.password || !(await verifyPassword(input.password, user.passwordHash))) {
      throw forbidden("Mot de passe incorrect.");
    }
    if (input.type === "WIPE" && device.userId !== user.id) {
      throw forbidden("Seul le propriétaire peut effacer l'appareil.");
    }
  }

  const payload: Prisma.JsonObject = {};
  let unlockCode: string | null = null;
  if (input.type === "LOST_MODE_ON") {
    payload.message = input.message || device.lostMessage || "Ce téléphone a été perdu. Merci d'appeler son propriétaire.";
    payload.contactPhone = input.contactPhone || user.contactPhone || "";
    // Nouveau code de déblocage à chaque activation ; le téléphone ne reçoit que son empreinte.
    unlockCode = generatePairingCode();
    payload.lockHash = unlockHash(device.id, unlockCode);
  }
  if (input.type === "LOCK") {
    if (input.pin) payload.pin = input.pin;
    if (input.message) payload.message = input.message;
  }

  const command = await prisma.$transaction(async (tx) => {
    // Une commande identique encore en attente est remplacée (pas de doublons).
    await tx.command.updateMany({
      where: { deviceId: device.id, type: input.type, status: "PENDING" },
      data: { status: "FAILED", result: "Remplacée par une commande plus récente" },
    });
    if (input.type === "LOST_MODE_ON") {
      await tx.device.update({
        where: { id: device.id },
        data: { lostMode: true, lostMessage: payload.message as string, unlockCode },
      });
    } else if (input.type === "LOST_MODE_OFF") {
      await tx.device.update({ where: { id: device.id }, data: { lostMode: false, unlockCode: null } });
    }
    return tx.command.create({
      data: {
        deviceId: device.id,
        type: input.type,
        payload: Object.keys(payload).length ? payload : undefined,
        createdById: user.id,
      },
    });
  });

  const wakeUp = await sendWakeUpPush(device, { kind: "command", commandId: command.id, type: command.type });
  return { command, wakeUp, unlockCode };
}
