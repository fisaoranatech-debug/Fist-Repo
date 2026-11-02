import type { Device, User } from "@prisma/client";
import { prisma } from "./db";
import { hashToken } from "./crypto";
import { forbidden, HttpError, notFound, unauthorized } from "./http";
import { readCookie, SESSION_COOKIE, verifySession } from "./session";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Protection CSRF : une requête qui modifie quelque chose doit venir de notre propre site. */
function checkSameOrigin(req: Request) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // client non navigateur (tests, curl)
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw forbidden("Origine de la requête refusée.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw forbidden("Origine de la requête refusée.");
  }
}

export async function currentUserId(req: Request): Promise<string | null> {
  return verifySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
}

export async function requireUser(req: Request): Promise<User> {
  checkSameOrigin(req);
  const id = await currentUserId(req);
  if (!id) throw unauthorized();
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw unauthorized();
  return user;
}

export type Access = "OWNER" | "CONTROLLER" | "VIEWER";
export type AccessLevel = "view" | "control" | "owner";

const RANK: Record<Access, number> = { VIEWER: 1, CONTROLLER: 2, OWNER: 3 };
const NEEDED: Record<AccessLevel, number> = { view: 1, control: 2, owner: 3 };

/**
 * Charge un appareil et vérifie que l'utilisateur y a accès au niveau demandé.
 * Renvoie 404 (et non 403) si l'utilisateur n'a aucun accès, pour ne rien révéler.
 */
export async function requireDevice(
  deviceId: string,
  userId: string,
  level: AccessLevel = "view",
): Promise<{ device: Device; access: Access }> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { shares: { where: { userId }, select: { role: true } } },
  });
  if (!device) throw notFound("Appareil");
  let access: Access | null = null;
  if (device.userId === userId) access = "OWNER";
  else if (device.shares[0]) access = device.shares[0].role;
  if (!access) throw notFound("Appareil");
  if (RANK[access] < NEEDED[level]) {
    throw forbidden(
      level === "owner"
        ? "Seul le propriétaire peut faire cette action."
        : "Vous pouvez seulement voir cet appareil.",
    );
  }
  const { shares, ...plain } = device;
  void shares;
  return { device: plain, access };
}

/** Authentifie un appareil par son jeton (en-tête Authorization: Bearer ...). */
export async function requireAgent(req: Request): Promise<Device> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpError(401, "Jeton d'appareil manquant.");
  const device = await prisma.device.findUnique({ where: { tokenHash: hashToken(match[1]!) } });
  if (!device) throw new HttpError(401, "Appareil non reconnu. Associez-le à nouveau.");
  return device;
}
