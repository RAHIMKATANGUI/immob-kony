import { prisma } from "@/lib/prisma";
import { parseBody, route, type Ctx } from "@/lib/api";
import { tenantBaseSchema } from "@/lib/validations";
import { tenantScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";
import { assertPlacement, syncApartmentStatus } from "@/lib/services/tenant.service";
import { leaseBalance } from "@/lib/services/rent.service";

type P = { id: string };

async function load(ctx: Ctx<P>) {
  const t = await prisma.tenant.findFirst({ where: { id: ctx.params.id, ...tenantScope(ctx.session) } });
  if (!t) throw notFound("Locataire introuvable");
  return t;
}

export const GET = route<P>({ permission: "tenants:read" }, async (ctx) => {
  await load(ctx);
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      residence: { include: { owner: true } },
      apartment: true,
      leases: {
        orderBy: { startDate: "desc" },
        include: {
          deposit: true,
          apartment: { select: { number: true } },
          rents: { orderBy: { period: "desc" }, take: 24 },
          payments: { orderBy: { paidAt: "desc" }, take: 50, include: { receipt: true } },
        },
      },
    },
  });
  const active = tenant.leases.find((l) => l.status === "ACTIVE");
  const balance = active ? await leaseBalance(active.id) : null;
  const history = await prisma.auditLog.findMany({ where: { entity: "Tenant", entityId: tenant.id }, orderBy: { createdAt: "desc" }, take: 30, include: { user: { select: { firstName: true, lastName: true } } } });
  return { tenant, balance, history };
});

export const PATCH = route<P>({ permission: "tenants:write" }, async (ctx) => {
  const before = await load(ctx);
  const data = await parseBody(ctx.req, tenantBaseSchema.partial());
  const residenceId = data.residenceId ?? before.residenceId;
  const apartmentId = data.apartmentId === undefined ? before.apartmentId : data.apartmentId;
  if (data.residenceId || data.apartmentId !== undefined) await assertPlacement(ctx.session, residenceId, apartmentId);
  const adults = data.adults ?? before.adults;
  const children = data.children ?? before.children;
  const after = await prisma.$transaction(async (tx) => {
    const t = await tx.tenant.update({
      where: { id: before.id },
      data: {
        ...data,
        entryDate: data.entryDate ? new Date(data.entryDate) : undefined,
        exitDate: data.exitDate === undefined ? undefined : data.exitDate ? new Date(data.exitDate) : null,
        totalOccupants: adults + children,
        updatedById: ctx.session.sub,
      },
    });
    for (const id of new Set([before.apartmentId, t.apartmentId].filter(Boolean) as string[])) await syncApartmentStatus(tx, id);
    return t;
  });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Tenant", after.id, { ...d.before, photoUrl: undefined }, { ...d.after, photoUrl: undefined });
  return after;
});

export const DELETE = route<P>({ permission: "tenants:delete" }, async (ctx) => {
  const t = await load(ctx);
  const active = await prisma.lease.count({ where: { tenantId: t.id, status: "ACTIVE" } });
  if (active) throw conflict("Résiliez d'abord le bail actif de ce locataire.");
  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({ where: { id: t.id }, data: { deletedAt: new Date(), exitDate: t.exitDate ?? new Date() } });
    if (t.apartmentId) await syncApartmentStatus(tx, t.apartmentId);
  });
  await audit(ctx, "DELETE", "Tenant", t.id, { ...t, photoUrl: null }, null);
  return { ok: true };
});
