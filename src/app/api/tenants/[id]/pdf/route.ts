import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { tenantScope } from "@/lib/rbac";
import { notFound } from "@/lib/errors";
import { tenantSheetPdf } from "@/lib/pdf/documents";
import { pdfResponse } from "@/lib/pdf/core";

export const runtime = "nodejs";

export const GET = route<{ id: string }>({ permission: "tenants:read" }, async ({ params, session, req }) => {
  const t = await prisma.tenant.findFirst({ where: { id: params.id, ...tenantScope(session) }, select: { id: true } });
  if (!t) throw notFound("Locataire introuvable");
  const { buffer, filename } = await tenantSheetPdf(t.id);
  return pdfResponse(buffer, filename, req.nextUrl.searchParams.get("download") !== "1");
});
