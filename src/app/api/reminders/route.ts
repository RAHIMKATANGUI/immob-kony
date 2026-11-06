import type { NotificationChannel, NotificationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paged, pagination, route } from "@/lib/api";
import { isAdmin, leaseScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { runReminders } from "@/lib/services/reminder.service";

export const runtime = "nodejs";

/** Historique des relances (email / SMS). */
export const GET = route({ permission: "reminders:run" }, async ({ req, session }) => {
  const { skip, take, page, pageSize } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const where: Prisma.NotificationWhereInput = {
    kind: { in: ["RENT_REMINDER_BEFORE", "RENT_REMINDER_AFTER"] },
    channel: (sp.get("channel") as NotificationChannel) ?? { in: ["EMAIL", "SMS"] },
    ...(sp.get("status") && { status: sp.get("status") as NotificationStatus }),
    lease: leaseScope(session),
  };
  const [items, total, stats] = await Promise.all([
    prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: { tenant: { select: { id: true, firstName: true, lastName: true } }, lease: { select: { id: true, reference: true } } } }),
    prisma.notification.count({ where }),
    prisma.notification.groupBy({ by: ["status"], where, _count: true }),
  ]);
  return { ...paged(items, total, page, pageSize), stats: Object.fromEntries(stats.map((s) => [s.status, s._count])) };
});

/** Lancement manuel des relances (périmètre du gestionnaire ou global pour l'admin). */
export const POST = route({ permission: "reminders:run", rateLimit: 5 }, async (ctx) => {
  const result = await runReminders(undefined, { managerId: isAdmin(ctx.session) ? null : ctx.session.managerId ?? "__none__" });
  await audit(ctx, "CREATE", "Reminder", null, null, result);
  return result;
});
