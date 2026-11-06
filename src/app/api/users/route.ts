import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { userCreateSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";

const select = {
  id: true, email: true, role: true, firstName: true, lastName: true, phone: true, isActive: true, lastLoginAt: true, createdAt: true, onboardingCompleted: true,
  manager: { select: { id: true, address: true, company: true, residences: { where: { deletedAt: null }, select: { id: true, name: true } } } },
} as const;

export const GET = route({ permission: "users:manage" }, async () => {
  return { items: await prisma.user.findMany({ select, orderBy: { createdAt: "asc" } }) };
});

export const POST = route({ permission: "users:manage" }, async (ctx) => {
  const { password, residenceIds, address, ...data } = await parseBody(ctx.req, userCreateSchema);
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        ...data,
        passwordHash: await hashPassword(password),
        onboardingCompleted: true,
        manager: { create: { firstName: data.firstName, lastName: data.lastName, phone: data.phone, email: data.email, address } },
      },
      include: { manager: true },
    });
    if (residenceIds.length) await tx.residence.updateMany({ where: { id: { in: residenceIds } }, data: { managerId: u.manager!.id } });
    return tx.user.findUniqueOrThrow({ where: { id: u.id }, select });
  });
  await audit(ctx, "CREATE", "User", user.id, null, user);
  return user;
});
