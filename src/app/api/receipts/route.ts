import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";

export const GET = route({ permission: "payments:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const where: Prisma.ReceiptWhereInput = {
    payment: { lease: leaseScope(session) },
    ...(q && {
      OR: [
        { number: { contains: q, mode: "insensitive" } },
        { payment: { lease: { tenant: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } } } },
      ],
    }),
  };
  const [items, total] = await Promise.all([
    prisma.receipt.findMany({
      where,
      skip,
      take,
      orderBy: { issuedAt: "desc" },
      include: { payment: { select: { type: true, method: true, paidAt: true, lease: { select: { id: true, reference: true, tenant: { select: { firstName: true, lastName: true, email: true } }, residence: { select: { name: true } } } } } } },
    }),
    prisma.receipt.count({ where }),
  ]);
  return paged(items, total, page, pageSize);
});
