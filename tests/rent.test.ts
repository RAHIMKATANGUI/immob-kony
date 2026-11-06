import { describe, expect, it } from "vitest";
import { computeRentStatus, leasePeriods } from "@/lib/services/rent.service";
import { addMonths, diffDays, dueDateFor } from "@/lib/dates";
import { matchingOffset } from "@/lib/services/reminder-offsets";

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("statut des loyers", () => {
  it("payé lorsque le montant est atteint", () => expect(computeRentStatus(100, 100, d("2026-01-05"), d("2026-03-01"))).toBe("PAID"));
  it("en retard après l'échéance", () => expect(computeRentStatus(100, 40, d("2026-01-05"), d("2026-01-06"))).toBe("LATE"));
  it("partiellement payé avant l'échéance", () => expect(computeRentStatus(100, 40, d("2026-01-05"), d("2026-01-04"))).toBe("PARTIAL"));
  it("non payé avant l'échéance", () => expect(computeRentStatus(100, 0, d("2026-01-05"), d("2026-01-05"))).toBe("UNPAID"));
});

describe("dates", () => {
  it("addMonths gère les fins de mois", () => expect(addMonths(d("2026-01-31"), 1).toISOString().slice(0, 10)).toBe("2026-02-28"));
  it("échéance plafonnée au 28", () => expect(dueDateFor(d("2026-02-01"), 31).toISOString().slice(0, 10)).toBe("2026-02-28"));
  it("diffDays", () => expect(diffDays(d("2026-01-01"), d("2026-01-08"))).toBe(7));
  it("périodes d'un bail de 12 mois", () => expect(leasePeriods(d("2026-01-15"), d("2027-01-14"))).toHaveLength(13));
  it("périodes limitées à une date", () => expect(leasePeriods(d("2026-01-01"), d("2026-12-31"), d("2026-03-10"))).toHaveLength(3));
});

describe("calendrier des relances", () => {
  const due = d("2026-05-05");
  it.each([
    ["2026-04-28", -7], ["2026-05-02", -3], ["2026-05-04", -1], ["2026-05-06", 1], ["2026-05-12", 7], ["2026-05-20", 15],
  ])("%s → J%i", (now, off) => expect(matchingOffset(due, d(now))).toBe(off));
  it("aucune relance hors calendrier", () => expect(matchingOffset(due, d("2026-05-05"))).toBeNull());
});
