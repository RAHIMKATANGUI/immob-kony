import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { ownerSchema } from "@/lib/validations";
import { ownerScope } from "@/lib/rbac";
import { nextCode } from "@/lib/sequence";
import { audit } from "@/lib/audit";

export const GET = route({ permission: "owners:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const where: Prisma.OwnerWhereInput = {
    ...ownerScope(session),
    ...(q && {
      AND: [{ OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.owner.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { _count: { select: { residences: { where: { deletedAt: null } } } } } }),
    prisma.owner.count({ where }),
  ]);
  return paged(items, total, page, pageSize);
});

export const POST = route({ permission: "owners:write" }, async (ctx) => {
  const data = await parseBody(ctx.req, ownerSchema);
  const owner = await prisma.owner.create({ data: { ...data, code: await nextCode("PRO"), createdById: ctx.session.sub } });
  await audit(ctx, "CREATE", "Owner", owner.id, null, owner);
  return owner;
});
