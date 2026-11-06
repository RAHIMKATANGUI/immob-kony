import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { isoDate, money, optStr } from "@/lib/validations";
import { toNumber } from "@/lib/utils";

const schema = z.object({ amount: money, date: isoDate, notes: optStr(1000) });

export const POST = route<{ id: string }>({ permission: "payments:write" }, async (ctx) => {
  const d = await prisma.deposit.findFirst({ where: { id: ctx.params.id, lease: leaseScope(ctx.session) } });
  if (!d) throw notFound("Caution introuvable");
  const body = await parseBody(ctx.req, schema);
  if (body.amount > toNumber(d.amountPaid)) throw badRequest("Le montant restitué dépasse la caution versée");
  const updated = await prisma.deposit.update({
    where: { id: d.id },
    data: { status: "REFUNDED", refundedAmount: body.amount, refundedAt: new Date(body.date), notes: body.notes },
  });
  await audit(ctx, "UPDATE", "Deposit", d.id, { status: d.status }, { status: "REFUNDED", refundedAmount: body.amount });
  return updated;
});
