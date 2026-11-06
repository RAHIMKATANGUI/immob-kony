import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { ownerSchema } from "@/lib/validations";
import { assertCan, ownerScope, residenceScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { conflict, notFound } from "@/lib/errors";

type P = { id: string };

async function load(id: string, session: Parameters<typeof ownerScope>[0]) {
  const owner = await prisma.owner.findFirst({ where: { id, ...ownerScope(session) } });
  if (!owner) throw notFound("Propriétaire introuvable");
  return owner;
}

export const GET = route<P>({ permission: "owners:read" }, async ({ params, session }) => {
  const owner = await load(params.id, session);
  const [residences, history] = await Promise.all([
    prisma.residence.findMany({
      where: { ownerId: owner.id, ...residenceScope(session) },
      include: { _count: { select: { apartments: { where: { deletedAt: null } } } }, apartments: { where: { deletedAt: null }, select: { status: true } } },
    }),
    prisma.auditLog.findMany({ where: { entity: "Owner", entityId: owner.id }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { firstName: true, lastName: true } } } }),
  ]);
  return { owner, residences, history };
});

export const PATCH = route<P>({ permission: "owners:write" }, async (ctx) => {
  const before = await load(ctx.params.id, ctx.session);
  const data = await parseBody(ctx.req, ownerSchema.partial());
  const after = await prisma.owner.update({ where: { id: before.id }, data: { ...data, updatedById: ctx.session.sub } });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Owner", after.id, d.before, d.after);
  return after;
});

export const DELETE = route<P>({ permission: "owners:delete" }, async (ctx) => {
  assertCan(ctx.session, "owners:delete");
  const owner = await load(ctx.params.id, ctx.session);
  const active = await prisma.residence.count({ where: { ownerId: owner.id, deletedAt: null } });
  if (active) throw conflict(`Ce propriétaire possède encore ${active} résidence(s). Réattribuez-les ou supprimez-les d'abord.`);
  await prisma.owner.update({ where: { id: owner.id }, data: { deletedAt: new Date(), updatedById: ctx.session.sub } });
  await audit(ctx, "DELETE", "Owner", owner.id, owner, null);
  return { ok: true };
});
