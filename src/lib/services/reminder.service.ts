import "server-only";
import { Prisma, type NotificationChannel } from "@prisma/client";
import { prisma } from "../prisma";
import { addDays, today as todayFn } from "../dates";
import { emailTemplate, sendEmail } from "../email";
import { sendSms } from "../sms";
import { formatDate, formatMoney, formatMonth, toNumber } from "../utils";
import { generateMonthlyRents } from "./rent.service";

export { REMINDER_OFFSETS, reminderLabel, matchingOffset } from "./reminder-offsets";
import { matchingOffset, reminderLabel } from "./reminder-offsets";

function buildMessage(offset: number, p: { tenant: string; amount: string; period: string; due: string; residence: string }) {
  if (offset < 0) {
    const days = Math.abs(offset);
    return {
      title: `Rappel : loyer de ${p.period} à régler dans ${days} jour${days > 1 ? "s" : ""}`,
      lines: [
        `Bonjour ${p.tenant},`,
        `Nous vous rappelons que votre loyer de ${p.period} (${p.residence}) d'un montant de ${p.amount} arrive à échéance le ${p.due}.`,
        "Merci de prévoir votre règlement. Si vous avez déjà payé, ne tenez pas compte de ce message.",
      ],
    };
  }
  return {
    title: `Loyer de ${p.period} en retard (${offset} jour${offset > 1 ? "s" : ""})`,
    lines: [
      `Bonjour ${p.tenant},`,
      `Sauf erreur de notre part, le loyer de ${p.period} (${p.residence}) d'un montant restant de ${p.amount}, échu le ${p.due}, n'a pas encore été réglé.`,
      offset >= 15
        ? "Sans régularisation rapide de votre part, nous serons contraints d'engager les démarches prévues au contrat de bail."
        : "Nous vous remercions de bien vouloir régulariser votre situation dans les meilleurs délais.",
    ],
  };
}

export interface ReminderRunResult {
  generated: { leases: number; late: number; expired: number };
  checked: number;
  created: number;
  sent: number;
  failed: number;
  skipped: number;
}

/**
 * Tâche quotidienne :
 * 1. génère les échéances du mois et met à jour les statuts (retards, baux expirés)
 * 2. envoie les relances J-7, J-3, J-1, J+1, J+7, J+15 (email + SMS + notification interne)
 * Idempotente : contrainte unique (rentId, offsetDays, channel).
 */
export async function runReminders(now: Date = todayFn(), opts: { managerId?: string | null } = {}): Promise<ReminderRunResult> {
  const generated = await generateMonthlyRents(now);
  const result: ReminderRunResult = { generated, checked: 0, created: 0, sent: 0, failed: 0, skipped: 0 };

  const setting = await prisma.setting.findUnique({ where: { key: "remindersEnabled" } });
  if (setting && setting.value === false) return result;

  const rents = await prisma.rent.findMany({
    where: {
      status: { not: "PAID" },
      dueDate: { gte: addDays(now, -15), lte: addDays(now, 7) },
      lease: { status: "ACTIVE", ...(opts.managerId ? { residence: { managerId: opts.managerId } } : {}) },
    },
    include: { lease: { include: { tenant: true, residence: { include: { manager: true } }, apartment: true } } },
  });

  for (const rent of rents) {
    result.checked++;
    const offset = matchingOffset(rent.dueDate, now);
    if (offset === null) continue;
    const { tenant, residence, apartment } = rent.lease;
    const remaining = toNumber(rent.amount) - toNumber(rent.amountPaid);
    const msg = buildMessage(offset, {
      tenant: `${tenant.firstName} ${tenant.lastName}`,
      amount: formatMoney(remaining),
      period: formatMonth(rent.period),
      due: formatDate(rent.dueDate, { month: "long" }),
      residence: `${residence.name}${apartment ? ` — Appt ${apartment.number}` : ""}`,
    });
    const kind = offset < 0 ? "RENT_REMINDER_BEFORE" : "RENT_REMINDER_AFTER";

    const channels: { channel: NotificationChannel; recipient: string | null }[] = [
      { channel: "EMAIL", recipient: tenant.email },
      { channel: "SMS", recipient: tenant.phone },
      { channel: "IN_APP", recipient: null },
    ];

    for (const { channel, recipient } of channels) {
      let notif;
      try {
        notif = await prisma.notification.create({
          data: {
            kind,
            channel,
            offsetDays: offset,
            title: channel === "IN_APP" ? `${reminderLabel(offset)} · ${tenant.firstName} ${tenant.lastName} — ${msg.title}` : msg.title,
            message: msg.lines.join("\n"),
            recipient,
            tenantId: tenant.id,
            leaseId: rent.leaseId,
            rentId: rent.id,
            userId: channel === "IN_APP" ? (residence.manager?.userId ?? null) : null,
            status: channel === "IN_APP" ? "SENT" : recipient ? "PENDING" : "SKIPPED",
            sentAt: channel === "IN_APP" ? new Date() : null,
            error: channel !== "IN_APP" && !recipient ? "Aucun destinataire" : null,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // déjà envoyée
        throw e;
      }
      result.created++;
      if (channel === "IN_APP") continue;
      if (!recipient) {
        result.skipped++;
        continue;
      }
      const res =
        channel === "EMAIL"
          ? await sendEmail({ to: recipient, subject: msg.title, html: emailTemplate(msg.title, msg.lines) })
          : await sendSms(recipient, `${msg.title}. ${msg.lines[1]}`);
      await prisma.notification.update({
        where: { id: notif.id },
        data: res.ok ? { status: "SENT", sentAt: new Date() } : { status: "FAILED", error: res.error?.slice(0, 500) },
      });
      if (res.ok) result.sent++;
      else result.failed++;
    }
  }
  return result;
}
