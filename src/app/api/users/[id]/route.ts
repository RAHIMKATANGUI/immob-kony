import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { userUpdateSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth/password";
import { audit, diff } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";

type P = { id: string };

export const PATCH = route<P>({ permission: "users:manage" }, async (ctx) => {
  const before = await prisma.user.findUnique({ where: { id: ctx.params.id }, include: { manager: true } });
  if (!before) throw notFound("Utilisateur introuvable");
  const { password, residenceIds, address, ...data } = await parseBody(ctx.req, userUpdateSchema);
  if (before.id === ctx.session.sub && (data.isActive === false || data.role === "MANAGER")) throw badRequest("Vous ne pouvez pas vous désactiver ou vous rétrograder vous-même");
  const after = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({ where: { id: before.id }, data: { ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) } });
    const manager = await tx.manager.upsert({
      where: { userId: u.id },
      create: { userId: u.id, firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? "", email: u.email, address: address ?? "" },
      update: { firstName: u.firstName, lastName: u.lastName, phone: u.phone ?? undefined, email: u.email, ...(address ? { address } : {}) },
    });
    if (residenceIds) {
      await tx.residence.updateMany({ where: { managerId: manager.id, id: { notIn: residenceIds } }, data: { managerId: null } });
      await tx.residence.updateMany({ where: { id: { in: residenceIds } }, data: { managerId: manager.id } });
    }
    return u;
  });
  const d = diff(before, after);
  await audit(ctx, "UPDATE", "User", after.id, d.before, { ...d.after, ...(residenceIds ? { residenceIds } : {}), ...(password ? { password: "modifié" } : {}) });
  return { ok: true };
});

export const DELETE = route<P>({ permission: "users:manage" }, async (ctx) => {
  if (ctx.params.id === ctx.session.sub) throw badRequest("Impossible de supprimer votre propre compte");
  const user = await prisma.user.findUnique({ where: { id: ctx.params.id } });
  if (!user) throw notFound("Utilisateur introuvable");
  // désactivation (conservation de l'historique) + libération des résidences
  await prisma.$transaction([
    prisma.residence.updateMany({ where: { manager: { userId: user.id } }, data: { managerId: null } }),
    prisma.user.update({ where: { id: user.id }, data: { isActive: false } }),
  ]);
  await audit(ctx, "DELETE", "User", user.id, { email: user.email, isActive: true }, { isActive: false });
  return { ok: true };
});
