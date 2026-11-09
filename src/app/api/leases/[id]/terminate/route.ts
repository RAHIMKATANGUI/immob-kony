import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { terminateLeaseSchema } from "@/lib/validations";
import { leaseScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/errors";
import { startOfMonth, toDateOnly } from "@/lib/dates";
import { syncApartmentStatus } from "@/lib/services/tenant.service";
import { toNumber } from "@/lib/utils";

/** Résiliation : fin du bail, sortie du locataire, libération du logement, restitution éventuelle de la caution. */
export const POST = route<{ id: string }>({ permission: "leases:write" }, async (ctx) => {
  const lease = await prisma.lease.findFirst({ where: { id: ctx.params.id, ...leaseScope(ctx.session) }, include: { deposit: true } });
  if (!lease) throw notFound("Bail introuvable");
  if (lease.status !== "ACTIVE") throw badRequest("Seul un bail actif peut être résilié");
  const body = await parseBody(ctx.req, terminateLeaseSchema);
  const date = toDateOnly(body.date);
  if (body.refundDeposit !== undefined && lease.deposit && body.refundDeposit > toNumber(lease.deposit.amountPaid)) {
    throw badRequest("Le montant restitué dépasse la caution versée");
  }
  const result = await prisma.$transaction(async (tx) => {
    // supprime les échéances futures non réglées
    await tx.rent.deleteMany({ where: { leaseId: lease.id, period: { gt: startOfMonth(date) }, amountPaid: 0 } });
    const l = await tx.lease.update({
      where: { id: lease.id },
      data: { status: "TERMINATED", terminatedAt: date, updatedById: ctx.session.sub, clauses: body.reason ? `${lease.clauses ?? ""}\n\nRésiliation : ${body.reason}` : undefined },
    });
    await tx.tenant.update({ where: { id: lease.tenantId }, data: { exitDate: date } });
    if (lease.deposit && body.refundDeposit !== undefined) {
      await tx.deposit.update({ where: { id: lease.deposit.id }, data: { status: "REFUNDED", refundedAmount: body.refundDeposit, refundedAt: date, deductedAmount: Math.max(0, toNumber(lease.deposit.amountPaid) - body.refundDeposit) } });
    }
    if (lease.apartmentId) await syncApartmentStatus(tx, lease.apartmentId);
    return l;
  });
  await audit(ctx, "UPDATE", "Lease", lease.id, { status: lease.status }, { status: "TERMINATED", terminatedAt: date, reason: body.reason, refundDeposit: body.refundDeposit });
  return result;
});
