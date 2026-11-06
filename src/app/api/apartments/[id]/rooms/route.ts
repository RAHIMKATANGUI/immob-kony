import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { roomSchema } from "@/lib/validations";
import { apartmentScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

type P = { id: string };

export const POST = route<P>({ permission: "apartments:write" }, async (ctx) => {
  const apt = await prisma.apartment.findFirst({ where: { id: ctx.params.id, ...apartmentScope(ctx.session) } });
  if (!apt) throw notFound("Appartement introuvable");
  const data = await parseBody(ctx.req, roomSchema);
  const room = await prisma.room.create({ data: { ...data, apartmentId: apt.id } });
  await audit(ctx, "CREATE", "Room", room.id, null, room);
  return room;
});
