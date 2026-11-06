import { prisma } from "@/lib/prisma";
import { parseBody, route, type Ctx } from "@/lib/api";
import { residenceSchema } from "@/lib/validations";
import { assertCan, isAdmin, residenceScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";

type P = { id: string };

async function load(ctx: Ctx<P>) {
  const r = await prisma.residence.findFirst({ where: { id: ctx.params.id, ...residenceScope(ctx.session) } });
  if (!r) throw notFound("Résidence introuvable");
  return r;
}

export const GET = route<P>({ permission: "residences:read" }, async (ctx) => {
  await load(ctx);
  return prisma.residence.findUniqueOrThrow({
    where: { id: ctx.params.id },
    include: {
      owner: true,
      manager: true,
      apartments: {
        where: { deletedAt: null },
        orderBy: [{ floor: "asc" }, { number: "asc" }],
        include: {
          _count: { select: { rooms: true } },
          tenants: { where: { deletedAt: null, exitDate: null }, select: { id: true, firstName: true, lastName: true } },
        },
      },
      tenants: { where: { deletedAt: null, apartmentId: null, exitDate: null }, select: { id: true, firstName: true, lastName: true, phone: true } },
    },
  });
});

export const PATCH = route<P>({ permission: "residences:write" }, async (ctx) => {
  const before = await load(ctx);
  const data = await parseBody(ctx.req, residenceSchema.partial());
  if (data.managerId !== undefined && !isAdmin(ctx.session)) delete data.managerId; // seule l'administration attribue
  const after = await prisma.residence.update({ where: { id: before.id }, data: { ...data, updatedById: ctx.session.sub } });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Residence", after.id, d.before, d.after);
  return after;
});

export const DELETE = route<P>({ permission: "residences:delete" }, async (ctx) => {
  assertCan(ctx.session, "residences:delete");
  const r = await load(ctx);
  const active = await prisma.lease.count({ where: { residenceId: r.id, status: "ACTIVE" } });
  if (active) throw conflict(`Impossible : ${active} bail(aux) actif(s) dans cette résidence.`);
  await prisma.$transaction([
    prisma.apartment.updateMany({ where: { residenceId: r.id }, data: { deletedAt: new Date() } }),
    prisma.residence.update({ where: { id: r.id }, data: { deletedAt: new Date(), updatedById: ctx.session.sub } }),
  ]);
  await audit(ctx, "DELETE", "Residence", r.id, r, null);
  return { ok: true };
});
