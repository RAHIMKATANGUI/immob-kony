"use client";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type Paged } from "@/lib/api-client";

type Opt = { id: string; label: string };

/** Listes de choix pour les sélecteurs (résidences, propriétaires, gestionnaires…). */
export function useOptions(resource: "owners" | "residences" | "managers" | "tenants" | "apartments", params = "", enabled = true) {
  return useQuery({
    queryKey: [resource, "options", params],
    enabled,
    queryFn: async (): Promise<Opt[]> => {
      if (resource === "managers") {
        const d = await apiGet<{ items: { id: string; firstName: string; lastName: string }[] }>("/api/managers");
        return d.items.map((m) => ({ id: m.id, label: `${m.firstName} ${m.lastName}` }));
      }
      const d = await apiGet<Paged<Record<string, unknown>>>(`/api/${resource}?pageSize=200${params}`);
      return d.items.map((r) => ({
        id: r.id as string,
        label:
          resource === "residences" ? (r.name as string)
          : resource === "apartments" ? `Appt ${r.number as string}${r.status !== "AVAILABLE" ? ` (${r.status === "OCCUPIED" ? "occupé" : r.status === "RESERVED" ? "réservé" : "maintenance"})` : ""}`
          : `${r.firstName as string} ${r.lastName as string}${r.code ? ` — ${r.code as string}` : ""}`,
        ...r,
      }));
    },
  });
}
