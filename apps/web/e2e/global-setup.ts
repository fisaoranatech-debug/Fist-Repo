import { PrismaClient } from "@prisma/client";

/** Repart d'un compteur de tentatives vide (les tests créent beaucoup de comptes depuis la même adresse). */
export default async function globalSetup() {
  if (process.env.E2E_BASE_URL) return; // site distant : on ne touche pas à sa base
  const prisma = new PrismaClient();
  try {
    await prisma.rateLimit.deleteMany({});
  } finally {
    await prisma.$disconnect();
  }
}
