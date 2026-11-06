import { prisma } from "@/lib/prisma";
import { route } from "@/lib/api";
import { apartmentScope, leaseScope, ownerScope, residenceScope, tenantScope } from "@/lib/rbac";
import { badRequest } from "@/lib/errors";
import { toCsv, toXlsx, type Column } from "@/lib/export";
import { tablePdf } from "@/lib/pdf/documents";
import { audit } from "@/lib/audit";
import { formatDate, formatMonth, toNumber } from "@/lib/utils";
import { APARTMENT_STATUS, DEPOSIT_STATUS, LEASE_STATUS, PAYMENT_METHODS, PAYMENT_TYPES, RENT_STATUS } from "@/lib/labels";
import type { SessionPayload } from "@/lib/auth/jwt";

export const runtime = "nodejs";

type Def = { title: string; load: (s: SessionPayload) => Promise<unknown[]>; columns: Column<any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any

const full = (p?: { firstName: string; lastName: string } | null) => (p ? `${p.firstName} ${p.lastName}` : "");

const DEFS: Record<string, Def> = {
  owners: {
    title: "Propriétaires",
    load: (s) => prisma.owner.findMany({ where: ownerScope(s), orderBy: { lastName: "asc" }, include: { _count: { select: { residences: true } } } }),
    columns: [
      { header: "Code", value: (r) => r.code },
      { header: "Nom", value: (r) => r.lastName },
      { header: "Prénom", value: (r) => r.firstName },
      { header: "Téléphone", value: (r) => r.phone },
      { header: "Email", value: (r) => r.email },
      { header: "Adresse", value: (r) => r.address, width: 35 },
      { header: "Résidences", value: (r) => r._count.residences },
      { header: "Créé le", value: (r) => formatDate(r.createdAt) },
    ],
  },
  residences: {
    title: "Résidences",
    load: (s) => prisma.residence.findMany({ where: residenceScope(s), orderBy: { name: "asc" }, include: { owner: true, manager: true, apartments: { where: { deletedAt: null }, select: { status: true } } } }),
    columns: [
      { header: "Code", value: (r) => r.code },
      { header: "Nom", value: (r) => r.name, width: 30 },
      { header: "Ville", value: (r) => r.city },
      { header: "Commune", value: (r) => r.commune },
      { header: "Propriétaire", value: (r) => full(r.owner) },
      { header: "Gestionnaire", value: (r) => full(r.manager) },
      { header: "Appartements", value: (r) => r.apartments.length },
      { header: "Occupés", value: (r) => r.apartments.filter((a: { status: string }) => a.status === "OCCUPIED").length },
    ],
  },
  apartments: {
    title: "Appartements",
    load: (s) => prisma.apartment.findMany({ where: apartmentScope(s), orderBy: [{ residence: { name: "asc" } }, { number: "asc" }], include: { residence: true } }),
    columns: [
      { header: "Résidence", value: (r) => r.residence.name, width: 28 },
      { header: "Numéro", value: (r) => r.number },
      { header: "Étage", value: (r) => r.floor },
      { header: "Surface (m²)", value: (r) => toNumber(r.surface) },
      { header: "Pièces", value: (r) => r.roomsCount },
      { header: "Loyer de base", value: (r) => toNumber(r.baseRent) },
      { header: "Statut", value: (r) => APARTMENT_STATUS[r.status as keyof typeof APARTMENT_STATUS] },
    ],
  },
  tenants: {
    title: "Locataires",
    load: (s) => prisma.tenant.findMany({ where: tenantScope(s), orderBy: { lastName: "asc" }, include: { residence: true, apartment: true } }),
    columns: [
      { header: "Code", value: (r) => r.code },
      { header: "Nom", value: (r) => r.lastName },
      { header: "Prénom", value: (r) => r.firstName },
      { header: "Téléphone", value: (r) => r.phone },
      { header: "Email", value: (r) => r.email },
      { header: "Profession", value: (r) => r.profession },
      { header: "Résidence", value: (r) => r.residence.name },
      { header: "Appartement", value: (r) => r.apartment?.number },
      { header: "Occupants", value: (r) => r.totalOccupants },
      { header: "Entrée", value: (r) => formatDate(r.entryDate) },
      { header: "Sortie", value: (r) => (r.exitDate ? formatDate(r.exitDate) : "") },
    ],
  },
  leases: {
    title: "Baux",
    load: (s) => prisma.lease.findMany({ where: leaseScope(s), orderBy: { startDate: "desc" }, include: { tenant: true, residence: true, apartment: true } }),
    columns: [
      { header: "Référence", value: (r) => r.reference },
      { header: "Locataire", value: (r) => full(r.tenant) },
      { header: "Résidence", value: (r) => r.residence.name },
      { header: "Appt", value: (r) => r.apartment?.number },
      { header: "Début", value: (r) => formatDate(r.startDate) },
      { header: "Fin", value: (r) => formatDate(r.endDate) },
      { header: "Loyer", value: (r) => toNumber(r.monthlyRent) },
      { header: "Charges", value: (r) => toNumber(r.charges) },
      { header: "Solde dispo.", value: (r) => toNumber(r.creditBalance) },
      { header: "Statut", value: (r) => LEASE_STATUS[r.status as keyof typeof LEASE_STATUS] },
    ],
  },
  rents: {
    title: "Loyers",
    load: (s) => prisma.rent.findMany({ where: { lease: leaseScope(s) }, orderBy: { dueDate: "desc" }, include: { lease: { include: { tenant: true, residence: true } } } }),
    columns: [
      { header: "Période", value: (r) => formatMonth(r.period) },
      { header: "Échéance", value: (r) => formatDate(r.dueDate) },
      { header: "Bail", value: (r) => r.lease.reference },
      { header: "Locataire", value: (r) => full(r.lease.tenant) },
      { header: "Résidence", value: (r) => r.lease.residence.name },
      { header: "Montant", value: (r) => toNumber(r.amount) },
      { header: "Payé", value: (r) => toNumber(r.amountPaid) },
      { header: "Reste", value: (r) => toNumber(r.amount) - toNumber(r.amountPaid) },
      { header: "Statut", value: (r) => RENT_STATUS[r.status as keyof typeof RENT_STATUS] },
    ],
  },
  payments: {
    title: "Paiements",
    load: (s) => prisma.payment.findMany({ where: { lease: leaseScope(s) }, orderBy: { paidAt: "desc" }, include: { receipt: true, lease: { include: { tenant: true, residence: true } } } }),
    columns: [
      { header: "Date", value: (r) => formatDate(r.paidAt) },
      { header: "Reçu", value: (r) => r.receipt?.number },
      { header: "Bail", value: (r) => r.lease.reference },
      { header: "Locataire", value: (r) => full(r.lease.tenant) },
      { header: "Résidence", value: (r) => r.lease.residence.name },
      { header: "Type", value: (r) => PAYMENT_TYPES[r.type as keyof typeof PAYMENT_TYPES] },
      { header: "Mode", value: (r) => PAYMENT_METHODS[r.method as keyof typeof PAYMENT_METHODS] },
      { header: "Référence", value: (r) => r.reference },
      { header: "Montant", value: (r) => toNumber(r.amount) },
    ],
  },
  receipts: {
    title: "Reçus",
    load: (s) => prisma.receipt.findMany({ where: { payment: { lease: leaseScope(s) } }, orderBy: { issuedAt: "desc" }, include: { payment: { include: { lease: { include: { tenant: true } } } } } }),
    columns: [
      { header: "Numéro", value: (r) => r.number },
      { header: "Émis le", value: (r) => formatDate(r.issuedAt) },
      { header: "Locataire", value: (r) => full(r.payment.lease.tenant) },
      { header: "Objet", value: (r) => r.label },
      { header: "Montant", value: (r) => toNumber(r.amount) },
    ],
  },
  deposits: {
    title: "Cautions",
    load: (s) => prisma.deposit.findMany({ where: { lease: leaseScope(s) }, include: { lease: { include: { tenant: true, residence: true } } } }),
    columns: [
      { header: "Bail", value: (r) => r.lease.reference },
      { header: "Locataire", value: (r) => full(r.lease.tenant) },
      { header: "Résidence", value: (r) => r.lease.residence.name },
      { header: "Montant", value: (r) => toNumber(r.amount) },
      { header: "Versé", value: (r) => toNumber(r.amountPaid) },
      { header: "Restant", value: (r) => toNumber(r.amount) - toNumber(r.amountPaid) },
      { header: "Statut", value: (r) => DEPOSIT_STATUS[r.status as keyof typeof DEPOSIT_STATUS] },
    ],
  },
};

/** Export PDF / Excel / CSV de chaque module. GET /api/exports/{entity}?format=csv|xlsx|pdf */
export const GET = route<{ entity: string }>({ permission: "exports:run" }, async (ctx) => {
  const def = DEFS[ctx.params.entity];
  if (!def) throw badRequest("Export inconnu");
  const format = ctx.req.nextUrl.searchParams.get("format") ?? "csv";
  const rows = await def.load(ctx.session);
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `immob-kony-${ctx.params.entity}-${stamp}`;
  await audit(ctx, "EXPORT", "Export", ctx.params.entity, null, { format, rows: rows.length });

  if (format === "xlsx") {
    const buf = await toXlsx(def.title, rows, def.columns);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}.xlsx"` },
    });
  }
  if (format === "pdf") {
    const buf = await tablePdf(def.title, def.columns.map((c) => c.header), rows.map((r) => def.columns.map((c) => String(c.value(r) ?? ""))));
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` } });
  }
  if (format !== "csv") throw badRequest("Format invalide (csv, xlsx, pdf)");
  return new Response(toCsv(rows, def.columns), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"` } });
});
