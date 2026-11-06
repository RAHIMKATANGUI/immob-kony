import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { apartmentScope, leaseScope, residenceScope, tenantScope } from "@/lib/rbac";

/** Recherche globale : locataires, appartements, résidences, baux, reçus. */
export const GET = route({}, async ({ req, session }) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return { tenants: [], apartments: [], residences: [], leases: [], receipts: [] };
  const ci = { contains: q, mode: "insensitive" as const };
  const [tenants, apartments, residences, leases, receipts] = await Promise.all([
    prisma.tenant.findMany({
      where: { ...tenantScope(session), OR: [{ firstName: ci }, { lastName: ci }, { phone: { contains: q } }, { email: ci }, { code: ci }] },
      select: { id: true, firstName: true, lastName: true, code: true, phone: true, residence: { select: { name: true } } },
      take: 6,
    }),
    prisma.apartment.findMany({
      where: { ...apartmentScope(session), OR: [{ number: ci }, { residence: { name: ci } }] },
      select: { id: true, number: true, status: true, residence: { select: { name: true } } },
      take: 6,
    }),
    prisma.residence.findMany({ where: { ...residenceScope(session), OR: [{ name: ci }, { city: ci }, { commune: ci }, { code: ci }] }, select: { id: true, name: true, commune: true, city: true }, take: 5 }),
    prisma.lease.findMany({
      where: { ...leaseScope(session), OR: [{ reference: ci }, { tenant: { OR: [{ firstName: ci }, { lastName: ci }] } }] },
      select: { id: true, reference: true, status: true, tenant: { select: { firstName: true, lastName: true } } },
      take: 5,
    }),
    prisma.receipt.findMany({
      where: { payment: { lease: leaseScope(session) }, OR: [{ number: ci }, { payment: { reference: ci } }] },
      select: { id: true, number: true, amount: true, payment: { select: { lease: { select: { tenant: { select: { firstName: true, lastName: true } } } } } } },
      take: 5,
    }),
  ]);
  return { tenants, apartments, residences, leases, receipts };
});
