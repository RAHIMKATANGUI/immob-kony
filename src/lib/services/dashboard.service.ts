import "server-only";
import type { SessionPayload } from "../auth/jwt";
import { prisma } from "../prisma";
import { apartmentScope, leaseScope, residenceScope, tenantScope } from "../rbac";
import { addMonths, endOfMonth, startOfMonth, today as todayFn } from "../dates";
import { toNumber } from "../utils";

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

export async function getDashboard(session: SessionPayload, now: Date = todayFn()) {
  const resWhere = residenceScope(session);
  const aptWhere = apartmentScope(session);
  const leaseWhere = leaseScope(session);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const twelveAgo = addMonths(monthStart, -11);

  const [
    residences,
    apartmentsByStatus,
    tenants,
    activeLeases,
    rentsThisMonth,
    lateRents,
    payments12m,
    yearPayments,
    upcoming,
    recentPayments,
    residencesOccupancy,
    rentsByStatus,
  ] = await Promise.all([
    prisma.residence.count({ where: resWhere }),
    prisma.apartment.groupBy({ by: ["status"], where: aptWhere, _count: true }),
    prisma.tenant.count({ where: { ...tenantScope(session), exitDate: null } }),
    prisma.lease.count({ where: { ...leaseWhere, status: "ACTIVE" } }),
    prisma.rent.findMany({ where: { lease: leaseWhere, period: monthStart }, select: { amount: true, amountPaid: true, status: true } }),
    prisma.rent.findMany({ where: { lease: leaseWhere, status: "LATE" }, select: { amount: true, amountPaid: true } }),
    prisma.payment.findMany({
      where: { lease: leaseWhere, paidAt: { gte: twelveAgo }, type: { in: ["RENT", "ADVANCE"] } },
      select: { amount: true, paidAt: true },
    }),
    prisma.payment.aggregate({ where: { lease: leaseWhere, paidAt: { gte: yearStart }, type: { in: ["RENT", "ADVANCE"] } }, _sum: { amount: true } }),
    prisma.rent.findMany({
      where: { lease: { ...leaseWhere, status: "ACTIVE" }, status: { not: "PAID" }, dueDate: { gte: now, lte: addMonths(now, 1) } },
      include: { lease: { include: { tenant: true, residence: true, apartment: true } } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
    prisma.payment.findMany({
      where: { lease: leaseWhere },
      include: { lease: { include: { tenant: true, residence: true } }, receipt: true },
      orderBy: { paidAt: "desc" },
      take: 6,
    }),
    prisma.residence.findMany({
      where: resWhere,
      select: { id: true, name: true, apartments: { where: { deletedAt: null }, select: { status: true } } },
      take: 12,
    }),
    prisma.rent.groupBy({ by: ["status"], where: { lease: leaseWhere, period: { gte: twelveAgo, lte: monthStart } }, _count: true }),
  ]);

  const aptCount = (s: string) => apartmentsByStatus.find((a) => a.status === s)?._count ?? 0;
  const totalApartments = apartmentsByStatus.reduce((acc, a) => acc + a._count, 0);
  const occupied = aptCount("OCCUPIED");
  const occupancyRate = totalApartments ? Math.round((occupied / totalApartments) * 1000) / 10 : 0;

  const expectedThisMonth = rentsThisMonth.reduce((a, r) => a + toNumber(r.amount), 0);
  const collectedOnMonthRents = rentsThisMonth.reduce((a, r) => a + toNumber(r.amountPaid), 0);
  const unpaid = rentsThisMonth.reduce((a, r) => a + Math.max(0, toNumber(r.amount) - toNumber(r.amountPaid)), 0);
  const lateAmount = lateRents.reduce((a, r) => a + Math.max(0, toNumber(r.amount) - toNumber(r.amountPaid)), 0);

  // Revenus encaissés par mois (12 derniers mois)
  const revenue = Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(twelveAgo, i);
    return { key: `${m.getUTCFullYear()}-${m.getUTCMonth()}`, month: `${MONTHS_FR[m.getUTCMonth()]} ${String(m.getUTCFullYear()).slice(2)}`, revenue: 0 };
  });
  for (const p of payments12m) {
    const k = `${p.paidAt.getUTCFullYear()}-${p.paidAt.getUTCMonth()}`;
    const row = revenue.find((r) => r.key === k);
    if (row) row.revenue += toNumber(p.amount);
  }
  const monthlyRevenue = payments12m
    .filter((p) => p.paidAt >= monthStart && p.paidAt <= new Date(monthEnd.getTime() + 86_399_999))
    .reduce((a, p) => a + toNumber(p.amount), 0);

  return {
    kpis: {
      residences,
      apartments: totalApartments,
      tenants,
      activeLeases,
      collected: collectedOnMonthRents,
      expected: expectedThisMonth,
      unpaid,
      late: lateAmount,
      lateCount: lateRents.length,
      occupancyRate,
      monthlyRevenue,
      annualRevenue: toNumber(yearPayments._sum.amount),
      collectionRate: expectedThisMonth ? Math.round((collectedOnMonthRents / expectedThisMonth) * 1000) / 10 : 0,
    },
    revenue: revenue.map(({ month, revenue }) => ({ month, revenue })),
    occupancy: [
      { status: "OCCUPIED", label: "Occupés", value: occupied },
      { status: "AVAILABLE", label: "Disponibles", value: aptCount("AVAILABLE") },
      { status: "RESERVED", label: "Réservés", value: aptCount("RESERVED") },
      { status: "MAINTENANCE", label: "Maintenance", value: aptCount("MAINTENANCE") },
    ],
    occupancyByResidence: residencesOccupancy.map((r) => {
      const total = r.apartments.length;
      const occ = r.apartments.filter((a) => a.status === "OCCUPIED").length;
      return { name: r.name, total, occupied: occ, rate: total ? Math.round((occ / total) * 100) : 0 };
    }),
    payments: [
      { status: "PAID", label: "Payé", value: rentsByStatus.find((r) => r.status === "PAID")?._count ?? 0 },
      { status: "PARTIAL", label: "Partiel", value: rentsByStatus.find((r) => r.status === "PARTIAL")?._count ?? 0 },
      { status: "LATE", label: "En retard", value: rentsByStatus.find((r) => r.status === "LATE")?._count ?? 0 },
      { status: "UNPAID", label: "Non payé", value: rentsByStatus.find((r) => r.status === "UNPAID")?._count ?? 0 },
    ],
    upcoming: upcoming.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      tenant: `${r.lease.tenant.firstName} ${r.lease.tenant.lastName}`,
      place: `${r.lease.residence.name}${r.lease.apartment ? ` · ${r.lease.apartment.number}` : ""}`,
      dueDate: r.dueDate,
      remaining: toNumber(r.amount) - toNumber(r.amountPaid),
      status: r.status,
    })),
    recentPayments: recentPayments.map((p) => ({
      id: p.id,
      tenant: `${p.lease.tenant.firstName} ${p.lease.tenant.lastName}`,
      residence: p.lease.residence.name,
      amount: toNumber(p.amount),
      type: p.type,
      paidAt: p.paidAt,
      receiptId: p.receipt?.id ?? null,
      receiptNumber: p.receipt?.number ?? null,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
