import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { depositStatementPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/core";

export const runtime = "nodejs";

export const GET = route<{ id: string }>({ permission: "payments:read" }, async ({ params, session }) => {
  const d = await prisma.deposit.findFirst({ where: { id: params.id, lease: leaseScope(session) }, select: { id: true } });
  if (!d) throw notFound("Caution introuvable");
  const { buffer, filename } = await depositStatementPdf(d.id);
  return pdfResponse(buffer, filename);
});
