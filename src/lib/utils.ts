import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "XOF";

/** Convertit un Decimal Prisma / string / number en number arrondi à 2 décimales. */
export function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(String(v));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function formatMoney(v: unknown, currency = CURRENCY) {
  const n = toNumber(v);
  const label = currency === "XOF" ? "FCFA" : currency;
  // espace fine insécable (U+202F) → espace insécable classique, mieux supportée par les polices
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: currency === "XOF" ? 0 : 2 }).format(n).replace(/\u202F/g, "\u00A0")}\u00A0${label}`;
}

/** Version compatible polices PDF standards (pas d'espaces insécables fines). */
export function formatMoneyPdf(v: unknown, currency = CURRENCY) {
  return formatMoney(v, currency).replace(/[  ]/g, " ");
}

export function formatDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = {}) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC", ...opts }).format(date);
}

export function formatMonth(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function initials(first?: string | null, last?: string | null) {
  return `${(first ?? "").charAt(0)}${(last ?? "").charAt(0)}`.toUpperCase() || "?";
}

export function fullName(p: { firstName: string; lastName: string } | null | undefined) {
  return p ? `${p.firstName} ${p.lastName}` : "—";
}
