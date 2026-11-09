import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { isoDate, optStr, positiveMoney } from "@/lib/validations";
import { toDateOnly } from "@/lib/dates";
import { recordRentAdvance } from "@/lib/services/rent.service";

const schema = z.object({
  amount: positiveMoney,
  monthlyDeduction: positiveMoney,
  method: z.enum(["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "CHECK", "CARD"]).default("CASH"),
  paidAt: isoDate,
  reference: optStr(120),
  notes: optStr(1000),
});

/** Avance sur loyer : encaissement d'un montant libre, déduit automatiquement chaque mois du loyer dû. */
export const POST = route<{ id: string }>({ permission: "payments:write" }, async (ctx) => {
  const lease = await prisma.lease.findFirst({ where: { id: ctx.params.id, ...leaseScope(ctx.session) } });
  if (!lease) throw notFound("Bail introuvable");
  const body = await parseBody(ctx.req, schema);
  const result = await recordRentAdvance({
    leaseId: lease.id,
    amount: body.amount,
    monthlyDeduction: body.monthlyDeduction,
    method: body.method,
    paidAt: toDateOnly(body.paidAt),
    reference: body.reference,
    notes: body.notes,
    recordedById: ctx.session.sub,
  });
  await audit(ctx, "PAYMENT", "Payment", result.payment.id, null, { type: "RENT_ADVANCE", amount: body.amount, monthlyDeduction: body.monthlyDeduction });
  return result;
});
