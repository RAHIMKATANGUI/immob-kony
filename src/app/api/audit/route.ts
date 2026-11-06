import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, route } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";

/** Journal d'audit : l'admin voit tout, un gestionnaire voit ses propres actions. */
export const GET = route({ permission: "audit:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const where: Prisma.AuditLogWhereInput = {
    ...(!isAdmin(session) && { userId: session.sub }),
    ...(sp.get("entity") && { entity: sp.get("entity")! }),
    ...(sp.get("action") && { action: sp.get("action") as AuditAction }),
    ...(sp.get("entityId") && { entityId: sp.get("entityId")! }),
    ...(q && { OR: [{ userEmail: { contains: q, mode: "insensitive" } }, { entityId: { contains: q } }, { entity: { contains: q, mode: "insensitive" } }] }),
  };
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { user: { select: { firstName: true, lastName: true, role: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return paged(items, total, page, pageSize);
});
