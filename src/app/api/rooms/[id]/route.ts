import { prisma } from "@/lib/prisma";
import { parseBody, route, type Ctx } from "@/lib/api";
import { roomSchema } from "@/lib/validations";
import { apartmentScope } from "@/lib/rbac";
import { audit, diff } from "@/lib/audit";
import { notFound } from "@/lib/errors";

type P = { id: string };

async function load(ctx: Ctx<P>) {
  const room = await prisma.room.findFirst({ where: { id: ctx.params.id, apartment: apartmentScope(ctx.session) } });
  if (!room) throw notFound("Pièce introuvable");
  return room;
}

export const PATCH = route<P>({ permission: "apartments:write" }, async (ctx) => {
  const before = await load(ctx);
  const data = await parseBody(ctx.req, roomSchema.partial());
  const after = await prisma.room.update({ where: { id: before.id }, data });
  const d = diff(before, after);
  if (d.changed) await audit(ctx, "UPDATE", "Room", after.id, d.before, d.after);
  return after;
});

export const DELETE = route<P>({ permission: "apartments:write" }, async (ctx) => {
  const room = await load(ctx);
  await prisma.room.delete({ where: { id: room.id } });
  await audit(ctx, "DELETE", "Room", room.id, room, null);
  return { ok: true };
});
