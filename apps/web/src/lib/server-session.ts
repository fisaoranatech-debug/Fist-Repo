import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** Utilisateur connecté, pour les composants serveur (pages, layout). */
export async function getSessionUser() {
  const store = await cookies();
  const id = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, contactPhone: true },
  });
}
