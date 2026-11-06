/** Utilitaires de dates en UTC (toutes les échéances sont des dates "jour", sans heure). */

export function toDateOnly(d: Date | string): Date {
  const x = typeof d === "string" ? new Date(d) : d;
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export function today(): Date {
  return toDateOnly(new Date());
}

export function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export function endOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export function addMonths(d: Date, n: number): Date {
  const day = d.getUTCDate();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = endOfMonth(r).getUTCDate();
  r.setUTCDate(Math.min(day, last));
  return r;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

/** Nombre de jours entiers entre a et b (b - a). */
export function diffDays(a: Date, b: Date): number {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / 86_400_000);
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

/** Date d'échéance d'une période (1er du mois) pour un jour d'échéance donné (1-28). */
export function dueDateFor(period: Date, dueDay: number): Date {
  return new Date(Date.UTC(period.getUTCFullYear(), period.getUTCMonth(), Math.min(Math.max(dueDay, 1), 28)));
}
