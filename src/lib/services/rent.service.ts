import { Prisma, type Lease, type PaymentMethod, type Rent, type RentStatus } from "@prisma/client";
import { prisma, type Tx } from "../prisma";
import { addMonths, dueDateFor, startOfMonth, today as todayFn, toDateOnly } from "../dates";
import { nextReceiptNumber } from "../sequence";
import { toNumber } from "../utils";
import { badRequest, notFound } from "../errors";

/* =====================================================================
 *  Moteur de loyers
 *  - génération des échéances mensuelles
 *  - ventilation des paiements (plus ancienne échéance d'abord)
 *  - paiements anticipés (plusieurs mois d'avance) + solde disponible
 *  - calcul des statuts : Payé / Partiellement payé / En retard / Non payé
 * ===================================================================== */

const round = (n: number) => Math.round(n * 100) / 100;

export function rentTotal(lease: Pick<Lease, "monthlyRent" | "charges">) {
  return round(toNumber(lease.monthlyRent) + toNumber(lease.charges));
}

/** Règle de statut (pure, testée unitairement). */
export function computeRentStatus(amount: number, paid: number, dueDate: Date, now: Date = todayFn()): RentStatus {
  if (paid >= amount - 0.001) return "PAID";
  if (toDateOnly(dueDate) < toDateOnly(now)) return "LATE";
  if (paid > 0) return "PARTIAL";
  return "UNPAID";
}

/** Liste des périodes (1er du mois) couvertes par un bail. */
export function leasePeriods(startDate: Date, endDate: Date, until?: Date): Date[] {
  const out: Date[] = [];
  let p = startOfMonth(startDate);
  const last = startOfMonth(until && until < endDate ? until : endDate);
  // la dernière période n'est due que si le bail couvre au moins un jour de ce mois
  while (p <= last && p <= endDate) {
    out.push(p);
    p = addMonths(p, 1);
  }
  return out;
}

/**
 * Crée les échéances manquantes jusqu'au mois `until` (inclus),
 * puis impute le solde disponible (crédit d'avance) sur les échéances ouvertes.
 */
export async function ensureRents(db: Tx, leaseId: string, until: Date = todayFn()) {
  const lease = await db.lease.findUnique({ where: { id: leaseId } });
  if (!lease) throw notFound("Bail introuvable");
  if (lease.status !== "ACTIVE") return lease;
  const amount = rentTotal(lease);
  const periods = leasePeriods(lease.startDate, lease.endDate, until);
  if (periods.length) {
    await db.rent.createMany({
      data: periods.map((period) => ({
        leaseId,
        period,
        dueDate: dueDateFor(period, lease.dueDay),
        amount,
      })),
      skipDuplicates: true,
    });
  }
  await applyAdvance(db, lease.id);
  await applyCredit(db, lease.id);
  return lease;
}

/**
 * Avance sur loyer : déduit chaque mois un montant fixe (advanceMonthly) de l'échéance,
 * tant qu'il reste de l'avance (advanceBalance). Une échéance n'est déduite qu'une fois.
 */
async function applyAdvance(db: Tx, leaseId: string) {
  const lease = await db.lease.findUniqueOrThrow({ where: { id: leaseId } });
  let balance = toNumber(lease.advanceBalance);
  const perMonth = toNumber(lease.advanceMonthly);
  if (balance <= 0 || perMonth <= 0) return;
  const open = await db.rent.findMany({ where: { leaseId, status: { not: "PAID" }, advanceApplied: 0 }, orderBy: { period: "asc" } });
  for (const r of open) {
    if (balance <= 0) break;
    const due = round(toNumber(r.amount) - toNumber(r.amountPaid));
    const part = round(Math.min(perMonth, balance, due));
    if (part <= 0) continue;
    balance = round(balance - part);
    await updateRentPaid(db, r, round(toNumber(r.amountPaid) + part), new Date());
    await db.rent.update({ where: { id: r.id }, data: { advanceApplied: part } });
  }
  await db.lease.update({ where: { id: leaseId }, data: { advanceBalance: balance } });
}

export interface RecordAdvanceInput {
  leaseId: string;
  amount: number;
  monthlyDeduction: number;
  method: PaymentMethod;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
  recordedById?: string | null;
}

/** Encaisse une avance sur loyer (montant libre) : elle est déduite automatiquement, mois après mois, du loyer dû. */
export async function recordRentAdvance(input: RecordAdvanceInput, db?: Tx) {
  const run = async (tx: Tx) => {
    const lease = await tx.lease.findUnique({ where: { id: input.leaseId } });
    if (!lease) throw notFound("Bail introuvable");
    if (lease.status !== "ACTIVE") throw badRequest("Le bail n'est pas actif");
    if (input.amount <= 0) throw badRequest("Montant invalide");
    if (input.monthlyDeduction <= 0) throw badRequest("La déduction mensuelle doit être supérieure à 0");
    const payment = await tx.payment.create({
      data: {
        leaseId: lease.id,
        type: "RENT_ADVANCE",
        method: input.method,
        amount: input.amount,
        paidAt: input.paidAt,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        recordedById: input.recordedById ?? null,
      },
    });
    await tx.lease.update({ where: { id: lease.id }, data: { advanceBalance: { increment: input.amount }, advanceMonthly: input.monthlyDeduction } });
    await ensureRents(tx, lease.id);
    const receipt = await tx.receipt.create({
      data: { number: await nextReceiptNumber(tx), paymentId: payment.id, amount: input.amount, label: "Avance sur loyer" },
    });
    return { payment, receipt, advance: null, creditBalance: toNumber(lease.creditBalance), monthsCovered: 0 };
  };
  return db ? run(db) : prisma.$transaction(run, { timeout: 20_000 });
}

/** Impute le solde disponible du bail sur les échéances ouvertes. */
async function applyCredit(db: Tx, leaseId: string) {
  const lease = await db.lease.findUniqueOrThrow({ where: { id: leaseId } });
  let credit = toNumber(lease.creditBalance);
  if (credit <= 0) return;
  const open = await db.rent.findMany({
    where: { leaseId, status: { not: "PAID" } },
    orderBy: { period: "asc" },
  });
  for (const r of open) {
    if (credit <= 0) break;
    const due = round(toNumber(r.amount) - toNumber(r.amountPaid));
    const part = Math.min(due, credit);
    credit = round(credit - part);
    await updateRentPaid(db, r, round(toNumber(r.amountPaid) + part), new Date());
  }
  await db.lease.update({ where: { id: leaseId }, data: { creditBalance: credit } });
}

async function updateRentPaid(db: Tx, rent: Rent, newPaid: number, paidAt: Date) {
  const amount = toNumber(rent.amount);
  const status = computeRentStatus(amount, newPaid, rent.dueDate);
  return db.rent.update({
    where: { id: rent.id },
    data: { amountPaid: newPaid, status, paidAt: status === "PAID" ? paidAt : rent.paidAt },
  });
}

/** Met à jour les statuts (ex. passage en retard) de toutes les échéances non soldées. */
export async function refreshRentStatuses(db: Tx = prisma, now: Date = todayFn()) {
  const late = await db.rent.updateMany({
    where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: now } },
    data: { status: "LATE" },
  });
  return late.count;
}

/** Génère les échéances du mois courant pour tous les baux actifs (tâche planifiée). */
export async function generateMonthlyRents(now: Date = todayFn()) {
  const leases = await prisma.lease.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  for (const l of leases) {
    await prisma.$transaction((tx) => ensureRents(tx, l.id, now));
  }
  const late = await refreshRentStatuses(prisma, now);
  // Expiration automatique des baux échus
  const expired = await prisma.lease.updateMany({ where: { status: "ACTIVE", endDate: { lt: now } }, data: { status: "EXPIRED" } });
  return { leases: leases.length, late, expired: expired.count };
}

export interface LeaseBalance {
  monthlyTotal: number;
  totalDue: number;
  totalPaid: number;
  arrears: number; // arriéré : échéances passées non soldées
  creditBalance: number; // solde disponible
  advanceBalance: number; // avance sur loyer restante
  advanceMonthly: number; // montant de l'avance déduit chaque mois
  nextDueDate: Date | null;
  nextDueAmount: number;
  paidUntil: Date | null; // dernier mois intégralement payé
}

/** Situation financière d'un bail. */
export async function leaseBalance(leaseId: string, db: Tx = prisma, now: Date = todayFn()): Promise<LeaseBalance> {
  const lease = await db.lease.findUniqueOrThrow({ where: { id: leaseId }, include: { rents: { orderBy: { period: "asc" } } } });
  let totalDue = 0;
  let totalPaid = 0;
  let arrears = 0;
  let paidUntil: Date | null = null;
  let next: Rent | null = null;
  for (const r of lease.rents) {
    const amt = toNumber(r.amount);
    const paid = toNumber(r.amountPaid);
    totalDue += amt;
    totalPaid += paid;
    if (r.dueDate < now && paid < amt) arrears += amt - paid;
    if (paid >= amt) paidUntil = r.period;
    if (!next && paid < amt) next = r;
  }
  const monthly = rentTotal(lease);
  let nextDueDate: Date | null = next?.dueDate ?? null;
  let nextDueAmount = next ? round(toNumber(next.amount) - toNumber(next.amountPaid)) : 0;
  if (!next && lease.status === "ACTIVE") {
    const lastPeriod = lease.rents.at(-1)?.period ?? addMonths(startOfMonth(lease.startDate), -1);
    const candidate = addMonths(lastPeriod, 1);
    if (candidate <= lease.endDate) {
      nextDueDate = dueDateFor(candidate, lease.dueDay);
      nextDueAmount = Math.max(0, round(monthly - toNumber(lease.creditBalance) - Math.min(toNumber(lease.advanceMonthly), toNumber(lease.advanceBalance))));
    }
  }
  return {
    monthlyTotal: monthly,
    totalDue: round(totalDue),
    totalPaid: round(totalPaid),
    arrears: round(arrears),
    creditBalance: toNumber(lease.creditBalance),
    advanceBalance: toNumber(lease.advanceBalance),
    advanceMonthly: toNumber(lease.advanceMonthly),
    nextDueDate,
    nextDueAmount,
    paidUntil,
  };
}

export interface RecordPaymentInput {
  leaseId: string;
  type: "RENT" | "DEPOSIT";
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  reference?: string | null;
  notes?: string | null;
  recordedById?: string | null;
}

/**
 * Enregistre un encaissement et génère automatiquement le reçu.
 * - DEPOSIT : alimente la caution.
 * - RENT : solde les arriérés puis, s'il reste un montant, couvre les mois suivants
 *   (paiement anticipé). Le reliquat inférieur à un loyer devient « solde disponible ».
 */
export async function recordPayment(input: RecordPaymentInput) {
  return prisma.$transaction(
    async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: input.leaseId }, include: { deposit: true, tenant: true } });
      if (!lease) throw notFound("Bail introuvable");
      if (input.amount <= 0) throw badRequest("Montant invalide");

      if (input.type === "DEPOSIT") return recordDeposit(tx, lease, input);

      if (lease.status !== "ACTIVE") throw badRequest("Le bail n'est pas actif");
      await ensureRents(tx, lease.id, input.paidAt > todayFn() ? input.paidAt : todayFn());
      const currentCredit = toNumber((await tx.lease.findUniqueOrThrow({ where: { id: lease.id } })).creditBalance);

      const payment = await tx.payment.create({
        data: {
          leaseId: lease.id,
          type: "RENT",
          method: input.method,
          amount: input.amount,
          paidAt: input.paidAt,
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          recordedById: input.recordedById ?? null,
        },
      });

      let remaining = round(input.amount);
      // 1) échéances ouvertes (arriérés + mois en cours), de la plus ancienne à la plus récente
      const open = await tx.rent.findMany({ where: { leaseId: lease.id, status: { not: "PAID" } }, orderBy: { period: "asc" } });
      for (const r of open) {
        if (remaining <= 0) break;
        const due = round(toNumber(r.amount) - toNumber(r.amountPaid));
        const part = Math.min(due, remaining);
        remaining = round(remaining - part);
        await tx.rentAllocation.create({ data: { paymentId: payment.id, rentId: r.id, amount: part } });
        await updateRentPaid(tx, r, round(toNumber(r.amountPaid) + part), input.paidAt);
      }

      // 2) paiement anticipé : mois futurs entièrement couverts
      const monthly = rentTotal(lease);
      let monthsCovered = 0;
      let coveredFrom: Date | null = null;
      let coveredTo: Date | null = null;
      // le solde disponible antérieur s'ajoute au reliquat pour couvrir des mois complets
      const stillOpen = await tx.rent.count({ where: { leaseId: lease.id, status: { not: "PAID" } } });
      if (stillOpen === 0) {
        remaining = round(remaining + currentCredit);
      }
      if (remaining > 0 && stillOpen === 0) {
        const last = await tx.rent.findFirst({ where: { leaseId: lease.id }, orderBy: { period: "desc" } });
        let period = last ? addMonths(last.period, 1) : startOfMonth(lease.startDate);
        while (remaining >= monthly - 0.001 && period <= lease.endDate) {
          const rent = await tx.rent.create({
            data: {
              leaseId: lease.id,
              period,
              dueDate: dueDateFor(period, lease.dueDay),
              amount: monthly,
              amountPaid: monthly,
              status: "PAID",
              paidAt: input.paidAt,
            },
          });
          await tx.rentAllocation.create({ data: { paymentId: payment.id, rentId: rent.id, amount: monthly } });
          remaining = round(remaining - monthly);
          monthsCovered++;
          coveredFrom ??= period;
          coveredTo = period;
          period = addMonths(period, 1);
        }
      }

      // 3) reliquat → solde disponible
      const newCredit = stillOpen === 0 ? round(remaining) : round(currentCredit + remaining);
      await tx.lease.update({ where: { id: lease.id }, data: { creditBalance: newCredit } });

      let advance = null;
      if (monthsCovered > 0 || remaining > 0) {
        const balance = await leaseBalance(lease.id, tx);
        if (monthsCovered > 0) {
          await tx.payment.update({ where: { id: payment.id }, data: { type: "ADVANCE" } });
          advance = await tx.advancePayment.create({
            data: {
              leaseId: lease.id,
              paymentId: payment.id,
              monthsCovered,
              amount: input.amount,
              coveredFrom: coveredFrom!,
              coveredTo: coveredTo!,
              remainingBalance: newCredit,
              nextDueDate: balance.nextDueDate ?? lease.endDate,
            },
          });
        }
      }

      const receipt = await tx.receipt.create({
        data: {
          number: await nextReceiptNumber(tx),
          paymentId: payment.id,
          amount: input.amount,
          label: monthsCovered > 0 ? `Loyer + avance (${monthsCovered} mois)` : "Paiement de loyer",
        },
      });

      return { payment: { ...payment, type: monthsCovered > 0 ? "ADVANCE" : "RENT" }, receipt, advance, creditBalance: newCredit, monthsCovered };
    },
    { timeout: 20_000 },
  );
}

async function recordDeposit(
  tx: Tx,
  lease: Lease & { deposit: { id: string; amount: Prisma.Decimal; amountPaid: Prisma.Decimal; firstPaidAt: Date | null } | null },
  input: RecordPaymentInput,
) {
  if (!lease.deposit) throw badRequest("Aucune caution définie pour ce bail");
  const due = round(toNumber(lease.deposit.amount) - toNumber(lease.deposit.amountPaid));
  if (due <= 0) throw badRequest("La caution est déjà soldée");
  if (input.amount > due + 0.001) throw badRequest(`Le montant dépasse le restant à payer de la caution (${due})`);
  const payment = await tx.payment.create({
    data: {
      leaseId: lease.id,
      depositId: lease.deposit.id,
      type: "DEPOSIT",
      method: input.method,
      amount: input.amount,
      paidAt: input.paidAt,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
      recordedById: input.recordedById ?? null,
    },
  });
  const paid = round(toNumber(lease.deposit.amountPaid) + input.amount);
  await tx.deposit.update({
    where: { id: lease.deposit.id },
    data: {
      amountPaid: paid,
      status: paid >= toNumber(lease.deposit.amount) ? "PAID" : "PARTIAL",
      firstPaidAt: lease.deposit.firstPaidAt ?? input.paidAt,
    },
  });
  const receipt = await tx.receipt.create({
    data: { number: await nextReceiptNumber(tx), paymentId: payment.id, amount: input.amount, label: "Versement de caution" },
  });
  return { payment, receipt, advance: null, creditBalance: toNumber(lease.creditBalance), monthsCovered: 0 };
}
