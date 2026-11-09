import type { LeaseStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { leaseSchema } from "@/lib/validations";
import { leaseScope, tenantScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { badRequest, conflict } from "@/lib/errors";
import { nextLeaseReference } from "@/lib/sequence";
import { addDays, addMonths, toDateOnly } from "@/lib/dates";
import { ensureRents, recordRentAdvance } from "@/lib/services/rent.service";
import { assertPlacement, syncApartmentStatus } from "@/lib/services/tenant.service";
import { getSettings } from "@/lib/settings";

export const GET = route({ permission: "leases:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const status = req.nextUrl.searchParams.get("status") as LeaseStatus | null;
  const where: Prisma.LeaseWhereInput = {
    ...leaseScope(session),
    ...(status && { status }),
    ...(q && {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { tenant: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } },
        { residence: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.lease.findMany({
      where,
      skip,
      take,
      orderBy: { startDate: "desc" },
      include: {
        tenant: { select: { id: true, firstName: true, lastName: true, phone: true } },
        residence: { select: { id: true, name: true } },
        apartment: { select: { id: true, number: true } },
        deposit: { select: { amount: true, amountPaid: true, status: true } },
        rents: { where: { status: { in: ["LATE", "PARTIAL", "UNPAID"] } }, select: { amount: true, amountPaid: true, status: true } },
      },
    }),
    prisma.lease.count({ where }),
  ]);
  return paged(
    items.map(({ rents, ...l }) => ({
      ...l,
      arrears: rents.filter((r) => r.status === "LATE").reduce((a, r) => a + Number(r.amount) - Number(r.amountPaid), 0),
      openRents: rents.length,
    })),
    total,
    page,
    pageSize,
  );
});

export const POST = route({ permission: "leases:write" }, async (ctx) => {
  const data = await parseBody(ctx.req, leaseSchema);
  const tenant = await prisma.tenant.findFirst({ where: { id: data.tenantId, ...tenantScope(ctx.session) } });
  if (!tenant) throw badRequest("Locataire invalide");
  await assertPlacement(ctx.session, data.residenceId, data.apartmentId);
  if (data.apartmentId) {
    const busy = await prisma.lease.findFirst({ where: { apartmentId: data.apartmentId, status: "ACTIVE" } });
    if (busy) throw conflict(`Cet appartement est déjà sous bail actif (${busy.reference}).`);
  }
  const already = await prisma.lease.findFirst({ where: { tenantId: tenant.id, status: "ACTIVE" } });
  if (already) throw conflict(`Ce locataire a déjà un bail actif (${already.reference}).`);

  if (data.advanceAmount > 0 && !data.activate) throw badRequest("Activez le bail pour enregistrer une avance sur loyer");
  const settings = await getSettings();
  const start = toDateOnly(data.startDate);
  const end = addDays(addMonths(start, data.durationMonths), -1);

  const lease = await prisma.$transaction(async (tx) => {
    const l = await tx.lease.create({
      data: {
        reference: await nextLeaseReference(tx, start.getUTCFullYear()),
        tenantId: tenant.id,
        residenceId: data.residenceId,
        apartmentId: data.apartmentId,
        startDate: start,
        endDate: end,
        durationMonths: data.durationMonths,
        monthlyRent: data.monthlyRent,
        charges: data.charges,
        dueDay: data.dueDay,
        clauses: data.clauses ?? settings.defaultClauses,
        status: data.activate ? "ACTIVE" : "DRAFT",
        signedAt: data.activate ? new Date() : null,
        createdById: ctx.session.sub,
        deposit: { create: { amount: data.depositAmount, status: data.depositAmount > 0 ? "PENDING" : "PAID" } },
      },
    });
    // rattachement du locataire au logement loué
    await tx.tenant.update({ where: { id: tenant.id }, data: { residenceId: data.residenceId, apartmentId: data.apartmentId ?? tenant.apartmentId } });
    if (data.activate) {
      await ensureRents(tx, l.id);
      if (data.advanceAmount > 0) {
        await recordRentAdvance(
          {
            leaseId: l.id,
            amount: data.advanceAmount,
            monthlyDeduction: data.advanceMonthly > 0 ? data.advanceMonthly : data.monthlyRent + data.charges,
            method: data.advanceMethod,
            paidAt: start,
            recordedById: ctx.session.sub,
          },
          tx,
        );
      }
      if (data.apartmentId) await syncApartmentStatus(tx, data.apartmentId);
    }
    return l;
  }, { timeout: 15_000 });
  await audit(ctx, "CREATE", "Lease", lease.id, null, lease);
  return lease;
});
