import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { isAdmin } from "@/lib/rbac";

/** Notifications internes de l'utilisateur connecté (les admins voient aussi les notifications non attribuées). */
export const GET = route({}, async ({ session }) => {
  const where = { channel: "IN_APP" as const, OR: [{ userId: session.sub }, ...(isAdmin(session) ? [{ userId: null }] : [])] };
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return { items, unread };
});

const schema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export const PATCH = route({}, async ({ req, session }) => {
  const { ids, all } = await parseBody(req, schema);
  const where = { channel: "IN_APP" as const, readAt: null, OR: [{ userId: session.sub }, ...(isAdmin(session) ? [{ userId: null }] : [])] };
  await prisma.notification.updateMany({ where: all ? where : { ...where, id: { in: ids ?? [] } }, data: { readAt: new Date() } });
  return { ok: true };
});
