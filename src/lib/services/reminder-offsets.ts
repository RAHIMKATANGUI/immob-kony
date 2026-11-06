import { diffDays } from "../dates";

/** Calendrier des relances : négatif = avant l'échéance, positif = après. */
export const REMINDER_OFFSETS = [-7, -3, -1, 1, 7, 15] as const;

export function reminderLabel(offset: number) {
  return offset < 0 ? `J${offset}` : `J+${offset}`;
}

/** Décalage (en jours) entre aujourd'hui et l'échéance, s'il correspond au calendrier. */
export function matchingOffset(dueDate: Date, now: Date): number | null {
  const d = diffDays(dueDate, now); // >0 : après l'échéance
  return (REMINDER_OFFSETS as readonly number[]).includes(d) ? d : null;
}

