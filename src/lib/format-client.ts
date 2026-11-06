import { formatDate, formatMoney } from "./utils";

export { formatMoney };

/** Date de fin d'un bail (début + n mois − 1 jour), pour affichage. */
export function addMonthsLabel(start: string, months: number) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(start) || !months) return "—";
  const d = new Date(`${start.slice(0, 10)}T00:00:00Z`);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate() - 1));
  return formatDate(end, { month: "long" });
}
