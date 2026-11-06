import { prisma } from "@/lib/prisma";
import { parseBody, route, type Ctx } from "@/lib/api";
import { leaseUpdateSchema } from "@/lib/validations";
import { leaseScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { ensureRents, leaseBalance } from "@/lib/services/rent.service";
import { syncApartmentStatus } from "@/lib/services/tenant.service";

type P = { id: string };

async function load(ctx: Ctx<P>) {
  const l = await prisma.lease.findFirst({ where: { id: ctx.params.id, ...leaseScope(ctx.session) } });
  if (!l) throw notFound("Bail introuvable");
  return l;
}

export const GET = route<P>({ permission: "leases:read" }, async (ctx) => {
  const l = await load(ctx);
  if (l.status === "ACTIVE") await prisma.$transaction((tx) => ensureRents(tx, l.id));
  const lease = await prisma.lease.findUniqueOrThrow({
    where: { id: l.id },
    include: {
      tenant: true,
      residence: { include: { owner: true, manager: true } },
      apartment: true,
      deposit: { include: { payments: { orderBy: { paidAt: "desc" }, include: { receipt: true } } } },
      rents: { orderBy: { period: "asc" } },
      payments: { orderBy: { paidAt: "desc" }, include: { receipt: true, recordedBy: { select: { firstName: true, lastName: true } } } },
      advancePayments: { orderBy: { createdAt: "desc" } },
    },
  });
  return { lease, balance: await leaseBalance(l.id) };
});

export const PATCH = route<P>({ permission: "leases:write" }, async (ctx) => {
  const before = await load(ctx);
  const data = await parseBody(ctx.req, leaseUpdateSchema);
  const after = await prisma.$transaction(async (tx) => {
    const l = await tx.lease.update({
      where: { id: before.id },
      data: { ...data, signedAt: data.status === "ACTIVE" && !before.signedAt ? new Date() : undefined, updatedById: ctx.session.sub },
    });
    if (data.status === "ACTIVE") await ensureRents(tx, l.id);
    // échéances non encore réglées : répercuter un changement de charges / jour d'échéance
    if (data.charges !== undefined || data.dueDay !== undefined) {
      await tx.rent.updateMany({ where: { leaseId: l.id, amountPaid: 0, status: { in: ["UNPAID"] } }, data: { amount: Number(l.monthlyRent) + Number(l.charges) } });
    }
    if (l.apartmentId) await syncApartmentStatus(tx, l.apartmentId);
    return l;
  });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Lease", after.id, d.before, d.after);
  return after;
});
