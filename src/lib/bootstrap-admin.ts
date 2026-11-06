import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

/**
 * Crée un compte SUPER_ADMIN au démarrage si aucun n'existe encore.
 * Ne fait rien si ADMIN_EMAIL / ADMIN_PASSWORD sont absents ou si un administrateur existe déjà.
 */
export async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  try {
    const admins = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (admins > 0) return;
    await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        role: "SUPER_ADMIN",
        firstName: process.env.ADMIN_FIRST_NAME || "Administrateur",
        lastName: process.env.ADMIN_LAST_NAME || "IMMOB KONY",
      },
    });
    console.log(`[bootstrap] Administrateur créé : ${email}`);
  } catch (err) {
    console.error("[bootstrap] Impossible de créer l'administrateur :", err);
  }
}
