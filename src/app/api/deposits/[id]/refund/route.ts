import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseBody, route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { badRequest, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { isoDate, optStr, positiveMoney, reqStr } from "@/lib/validations";
import { toNumber } from "@/lib/utils";

/**
 * Restitution de la caution à la sortie du locataire.
 * Les dégâts constatés (état des lieux de sortie) sont retenus sur la caution versée :
 *   montant rendu = caution versée − total des retenues (jamais négatif)
 *   si les dégâts dépassent la caution, la différence reste due par le locataire.
 */
const schema = z.object({
  date: isoDate,
  deductions: z
    .array(z.object({ label: reqStr("Le motif de la retenue", 200), amount: positiveMoney }))
    .max(50)
    .default([]),
  notes: optStr(1000),
});

export const POST = route<{ id: string }>({ permission: "payments:write" }, async (ctx) => {
  const d = await prisma.deposit.findFirst({ where: { id: ctx.params.id, lease: leaseScope(ctx.session) } });
  if (!d) throw notFound("Caution introuvable");
  if (d.status === "REFUNDED") throw badRequest("Cette caution a déjà été restituée");
  const paid = toNumber(d.amountPaid);
  if (paid <= 0) throw badRequest("Aucune caution n'a été versée");
  const body = await parseBody(ctx.req, schema);

  const deducted = body.deductions.reduce((s, x) => s + x.amount, 0);
  const refunded = Math.max(0, paid - deducted);
  const owed = Math.max(0, deducted - paid);

  const updated = await prisma.deposit.update({
    where: { id: d.id },
    data: {
      status: "REFUNDED",
      refundedAmount: refunded,
      refundedAt: new Date(body.date),
      deductedAmount: deducted,
      deductions: body.deductions,
      notes: body.notes,
    },
  });
  await audit(ctx, "UPDATE", "Deposit", d.id, { status: d.status }, { status: "REFUNDED", refundedAmount: refunded, deductedAmount: deducted, owed });
  return { ...updated, owed };
});
