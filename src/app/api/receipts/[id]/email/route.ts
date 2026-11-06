import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { badRequest, notFound } from "@/lib/errors";
import { sendReceiptEmail } from "@/lib/services/receipt.service";

export const runtime = "nodejs";

export const POST = route<{ id: string }>({ permission: "payments:write", rateLimit: 20 }, async ({ params, session }) => {
  const r = await prisma.receipt.findFirst({ where: { id: params.id, payment: { lease: leaseScope(session) } }, select: { id: true } });
  if (!r) throw notFound("Reçu introuvable");
  const res = await sendReceiptEmail(r.id);
  if (!res.ok) throw badRequest(res.error ?? "Envoi impossible");
  return { ok: true };
});
