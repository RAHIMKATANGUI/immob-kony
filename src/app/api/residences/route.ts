import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { residenceSchema } from "@/lib/validations";
import { isAdmin, ownerScope, residenceScope } from "@/lib/rbac";
import { nextCode } from "@/lib/sequence";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

export const GET = route({ permission: "residences:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const ownerId = req.nextUrl.searchParams.get("ownerId");
  const where: Prisma.ResidenceWhereInput = {
    ...residenceScope(session),
    ...(ownerId && { ownerId }),
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { city: { contains: q, mode: "insensitive" } }, { commune: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] }),
  };
  const [items, total] = await Promise.all([
    prisma.residence.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
        apartments: { where: { deletedAt: null }, select: { status: true } },
        _count: { select: { tenants: { where: { deletedAt: null, exitDate: null } } } },
      },
    }),
    prisma.residence.count({ where }),
  ]);
  return paged(
    items.map(({ apartments, ...r }) => ({
      ...r,
      apartmentsCount: apartments.length,
      occupiedCount: apartments.filter((a) => a.status === "OCCUPIED").length,
    })),
    total,
    page,
    pageSize,
  );
});

export const POST = route({ permission: "residences:write" }, async (ctx) => {
  const data = await parseBody(ctx.req, residenceSchema);
  const owner = await prisma.owner.findFirst({ where: { id: data.ownerId, ...ownerScope(ctx.session) } });
  if (!owner) throw badRequest("Propriétaire invalide");
  // un gestionnaire crée des résidences dans son propre périmètre
  const managerId = isAdmin(ctx.session) ? data.managerId : ctx.session.managerId;
  const residence = await prisma.residence.create({ data: { ...data, managerId, code: await nextCode("RES"), createdById: ctx.session.sub } });
  await audit(ctx, "CREATE", "Residence", residence.id, null, residence);
  return residence;
});
