import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { leaseScope } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { leaseContractPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/core";

export const runtime = "nodejs";

export const GET = route<{ id: string }>({ permission: "leases:read" }, async ({ params, session, req }) => {
  const l = await prisma.lease.findFirst({ where: { id: params.id, ...leaseScope(session) }, select: { id: true } });
  if (!l) throw notFound("Bail introuvable");
  const { buffer, filename } = await leaseContractPdf(l.id);
  return pdfResponse(buffer, filename, req.nextUrl.searchParams.get("download") !== "1");
});
