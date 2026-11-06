import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { tenantSchema } from "@/lib/validations";
import { tenantScope } from "@/lib/rbac";
import { nextCode } from "@/lib/sequence";
import { audit } from "@/lib/audit";
import { assertPlacement } from "@/lib/services/tenant.service";

export const GET = route({ permission: "tenants:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const residenceId = sp.get("residenceId");
  const state = sp.get("state"); // active | left
  const where: Prisma.TenantWhereInput = {
    ...tenantScope(session),
    ...(residenceId && { residenceId }),
    ...(state === "active" && { exitDate: null }),
    ...(state === "left" && { exitDate: { not: null } }),
    ...(q && {
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { idNumber: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        residence: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        leases: { where: { status: "ACTIVE" }, select: { id: true, reference: true, monthlyRent: true, rents: { where: { status: "LATE" }, select: { id: true } } } },
      },
    }),
    prisma.tenant.count({ where }),
  ]);
  return paged(
    items.map(({ leases, ...t }) => ({ ...t, activeLease: leases[0] ? { id: leases[0].id, reference: leases[0].reference, monthlyRent: leases[0].monthlyRent, lateCount: leases[0].rents.length } : null })),
    total,
    page,
    pageSize,
  );
});

export const POST = route({ permission: "tenants:write" }, async (ctx) => {
  const data = await parseBody(ctx.req, tenantSchema);
  await assertPlacement(ctx.session, data.residenceId, data.apartmentId);
  const tenant = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.create({
      data: {
        ...data,
        entryDate: new Date(data.entryDate),
        exitDate: data.exitDate ? new Date(data.exitDate) : null,
        totalOccupants: data.adults + data.children,
        code: await nextCode("LOC", tx),
        createdById: ctx.session.sub,
      },
    });
    if (t.apartmentId && !t.exitDate) await tx.apartment.update({ where: { id: t.apartmentId }, data: { status: "OCCUPIED" } });
    return t;
  });
  await audit(ctx, "CREATE", "Tenant", tenant.id, null, { ...tenant, photoUrl: tenant.photoUrl ? "[image]" : null });
  return tenant;
});
