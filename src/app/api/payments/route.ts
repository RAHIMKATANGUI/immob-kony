import type { PaymentType, Prisma } from "@prisma/client";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { paged, pagination, parseBody, route } from "@/lib/api";
import { paymentSchema } from "@/lib/validations";
import { leaseScope } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import { notFound } from "@/lib/errors";
import { toDateOnly } from "@/lib/dates";
import { recordPayment } from "@/lib/services/rent.service";
import { sendReceiptEmail } from "@/lib/services/receipt.service";

export const GET = route({ permission: "payments:read" }, async ({ req, session }) => {
  const { skip, take, page, pageSize, q } = pagination(req);
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") as PaymentType | null;
  const from = sp.get("from");
  const to = sp.get("to");
  const leaseId = sp.get("leaseId");
  const where: Prisma.PaymentWhereInput = {
    lease: leaseScope(session),
    ...(leaseId && { leaseId }),
    ...(type && { type }),
    ...((from || to) && { paidAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(`${to}T23:59:59Z`) }) } }),
    ...(q && {
      OR: [
        { reference: { contains: q, mode: "insensitive" } },
        { receipt: { number: { contains: q, mode: "insensitive" } } },
        { lease: { reference: { contains: q, mode: "insensitive" } } },
        { lease: { tenant: { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }] } } },
      ],
    }),
  };
  const [items, total, sum] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { paidAt: "desc" },
      include: {
        receipt: { select: { id: true, number: true } },
        recordedBy: { select: { firstName: true, lastName: true } },
        lease: { select: { id: true, reference: true, tenant: { select: { id: true, firstName: true, lastName: true } }, residence: { select: { name: true } }, apartment: { select: { number: true } } } },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where, _sum: { amount: true } }),
  ]);
  return { ...paged(items, total, page, pageSize), totalAmount: Number(sum._sum.amount ?? 0) };
});

/** Enregistre un paiement → reçu automatique (n° unique + QR code) + email optionnel. */
export const POST = route({ permission: "payments:write", rateLimit: 60 }, async (ctx) => {
  const data = await parseBody(ctx.req, paymentSchema);
  const lease = await prisma.lease.findFirst({ where: { id: data.leaseId, ...leaseScope(ctx.session) }, select: { id: true } });
  if (!lease) throw notFound("Bail introuvable");
  const result = await recordPayment({
    leaseId: lease.id,
    type: data.type,
    amount: data.amount,
    method: data.method,
    paidAt: toDateOnly(data.paidAt),
    reference: data.reference,
    notes: data.notes,
    recordedById: ctx.session.sub,
  });
  await audit(ctx, "PAYMENT", "Payment", result.payment.id, null, { ...result.payment, receipt: result.receipt.number, monthsCovered: result.monthsCovered });
  if (data.sendEmail) after(() => sendReceiptEmail(result.receipt.id).catch((e) => console.error("[receipt-email]", e)));
  return result;
});
