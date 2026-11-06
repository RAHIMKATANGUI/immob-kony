import { prisma } from "@/lib/prisma";
import { parseBody, route, type Ctx } from "@/lib/api";
import { apartmentSchema } from "@/lib/validations";
import { apartmentScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";

type P = { id: string };

async function load(ctx: Ctx<P>) {
  const a = await prisma.apartment.findFirst({ where: { id: ctx.params.id, ...apartmentScope(ctx.session) } });
  if (!a) throw notFound("Appartement introuvable");
  return a;
}

export const GET = route<P>({ permission: "apartments:read" }, async (ctx) => {
  await load(ctx);
  return prisma.apartment.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      residence: { include: { owner: true } },
      rooms: { orderBy: { createdAt: "asc" } },
      tenants: { where: { deletedAt: null }, orderBy: { entryDate: "desc" } },
      leases: { orderBy: { startDate: "desc" }, include: { tenant: { select: { firstName: true, lastName: true } } } },
    },
  });
});

export const PATCH = route<P>({ permission: "apartments:write" }, async (ctx) => {
  const before = await load(ctx);
  const { rooms: _rooms, residenceId: _r, ...data } = await parseBody(ctx.req, apartmentSchema.partial());
  void _rooms; void _r;
  const after = await prisma.apartment.update({ where: { id: before.id }, data });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Apartment", after.id, d.before, d.after);
  return after;
});

export const DELETE = route<P>({ permission: "apartments:delete" }, async (ctx) => {
  const a = await load(ctx);
  const active = await prisma.lease.count({ where: { apartmentId: a.id, status: "ACTIVE" } });
  if (active) throw conflict("Impossible : un bail actif est rattaché à cet appartement.");
  await prisma.apartment.update({ where: { id: a.id }, data: { deletedAt: new Date(), number: `${a.number}~${Date.now()}` } });
  await audit(ctx, "DELETE", "Apartment", a.id, a, null);
  return { ok: true };
});
