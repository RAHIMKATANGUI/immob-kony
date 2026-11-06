import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { receiptPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/core";

export const runtime = "nodejs";

export const GET = route<{ id: string }>({ permission: "payments:read" }, async ({ params, session, req }) => {
  const r = await prisma.receipt.findFirst({ where: { id: params.id, payment: { lease: leaseScope(session) } }, select: { id: true } });
  if (!r) throw notFound("Reçu introuvable");
  const { buffer, filename } = await receiptPdf(r.id);
  return pdfResponse(buffer, filename, req.nextUrl.searchParams.get("download") !== "1");
});
