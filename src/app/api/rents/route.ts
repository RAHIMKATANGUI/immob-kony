import type { Prisma, RentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";

/** Échéancier global des loyers (filtrable par statut / période). */
export const GET = route({ permission: "payments:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") as RentStatus | null;
  const month = sp.get("month"); // AAAA-MM
  const where: Prisma.RentWhereInput = {
    lease: { ...leaseScope(session), ...(q && { OR: [{ reference: { contains: q, mode: "insensitive" } }, { tenant: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } }] }) },
    ...(status && { status }),
    ...(month && { period: new Date(`${month}-01T00:00:00Z`) }),
  };
  const [items, total, sums] = await Promise.all([
    prisma.rent.findMany({
      where,
      skip,
      take,
      orderBy: [{ dueDate: "desc" }],
      include: { lease: { select: { id: true, reference: true, tenant: { select: { id: true, firstName: true, lastName: true, phone: true } }, residence: { select: { name: true } }, apartment: { select: { number: true } } } } },
    }),
    prisma.rent.count({ where }),
    prisma.rent.aggregate({ where, _sum: { amount: true, amountPaid: true } }),
  ]);
  return { ...paged(items, total, page, pageSize), totals: { amount: Number(sums._sum.amount ?? 0), paid: Number(sums._sum.amountPaid ?? 0) } };
});
