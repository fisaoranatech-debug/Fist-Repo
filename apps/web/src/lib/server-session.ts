import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Utilisateur connecté, pour les composants serveur (pages, layout). */
export async function getSessionUser() {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, contactPhone: true, sessionVersion: true },
  });
  if (!user || user.sessionVersion !== session.sv) return null;
  return user;
}
