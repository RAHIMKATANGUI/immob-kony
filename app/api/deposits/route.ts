import type { DepositStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";

export const GET = route({ permission: "payments:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const status = req.nextUrl.searchParams.get("status") as DepositStatus | null;
  const where: Prisma.DepositWhereInput = {
    lease: leaseScope(session),
    amount: { gt: 0 },
    ...(status && { status }),
    ...(q && { lease: { ...leaseScope(session), OR: [{ reference: { contains: q, mode: "insensitive" } }, { tenant: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } }] } }),
  };
  const [items, total, sums] = await Promise.all([
    prisma.deposit.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        lease: { select: { id: true, reference: true, status: true, tenant: { select: { id: true, firstName: true, lastName: true } }, residence: { select: { name: true } }, apartment: { select: { number: true } } } },
        payments: { orderBy: { paidAt: "desc" }, select: { id: true, amount: true, paidAt: true, method: true, receipt: { select: { id: true, number: true } } } },
      },
    }),
    prisma.deposit.count({ where }),
    prisma.deposit.aggregate({ where, _sum: { amount: true, amountPaid: true } }),
  ]);
  return {
    ...paged(items, total, page, pageSize),
    totals: { amount: Number(sums._sum.amount ?? 0), paid: Number(sums._sum.amountPaid ?? 0) },
  };
});
