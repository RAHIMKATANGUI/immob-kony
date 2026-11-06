import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";

/** Liste légère des gestionnaires (sélecteurs d'attribution). */
export const GET = route({ permission: "residences:assign" }, async () => ({
  items: await prisma.manager.findMany({ where: { user: { isActive: true } }, select: { id: true, firstName: true, lastName: true }, orderBy: { lastName: "asc" } }),
}));
