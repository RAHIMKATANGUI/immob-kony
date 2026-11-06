import type { ApartmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { apartmentSchema } from "@/lib/validations";
import { apartmentScope, residenceScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { badRequest } from "@/lib/errors";

export const GET = route({ permission: "apartments:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") as ApartmentStatus | null;
  const residenceId = sp.get("residenceId");
  const where: Prisma.ApartmentWhereInput = {
    ...apartmentScope(session),
    ...(status && { status }),
    ...(residenceId && { residenceId }),
    ...(q && { OR: [{ number: { contains: q, mode: "insensitive" } }, { residence: { name: { contains: q, mode: "insensitive" } } }] }),
  };
  const [items, total] = await Promise.all([
    prisma.apartment.findMany({
      where,
      skip,
      take,
      orderBy: [{ residence: { name: "asc" } }, { floor: "asc" }, { number: "asc" }],
      include: {
        residence: { select: { id: true, name: true, commune: true } },
        _count: { select: { rooms: true } },
        tenants: { where: { deletedAt: null, exitDate: null }, select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.apartment.count({ where }),
  ]);
  return paged(items, total, page, pageSize);
});

export const POST = route({ permission: "apartments:write" }, async (ctx) => {
  const { rooms, ...data } = await parseBody(ctx.req, apartmentSchema);
  const residence = await prisma.residence.findFirst({ where: { id: data.residenceId, ...residenceScope(ctx.session) } });
  if (!residence) throw badRequest("Résidence invalide");
  const apt = await prisma.apartment.create({
    data: { ...data, rooms: rooms?.length ? { create: rooms } : undefined },
    include: { rooms: true },
  });
  await audit(ctx, "CREATE", "Apartment", apt.id, null, apt);
  return apt;
});
