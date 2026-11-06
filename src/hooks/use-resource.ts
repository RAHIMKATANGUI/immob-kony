"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost, HttpError, type Paged } from "@/lib/api-client";

export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Liste paginée d'une ressource REST. */
export function useList<T>(resource: string, params: Record<string, string | number | undefined | null> = {}, extra?: { enabled?: boolean }) {
  const qs = buildQuery(params);
  return useQuery({
    queryKey: [resource, params],
    queryFn: () => apiGet<Paged<T> & Record<string, unknown>>(`/api/${resource}${qs}`),
    placeholderData: keepPreviousData,
    enabled: extra?.enabled,
  });
}

export function useItem<T>(resource: string, id: string | undefined) {
  return useQuery({ queryKey: [resource, id], queryFn: () => apiGet<T>(`/api/${resource}/${id}`), enabled: !!id });
}

export function onError(err: unknown) {
  toast.error(err instanceof HttpError ? err.message : "Une erreur est survenue");
}

/** Mutations CRUD avec invalidation du cache et toasts. */
export function useCrud<TInput = unknown>(resource: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([resource, ...invalidate, "dashboard", "search"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  return {
    create: useMutation({
      mutationFn: (data: TInput) => apiPost<{ id: string }>(`/api/${resource}`, data),
      onSuccess: () => { toast.success("Enregistrement créé"); return refresh(); },
      onError,
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<TInput> }) => apiPatch<{ id: string }>(`/api/${resource}/${id}`, data),
      onSuccess: () => { toast.success("Modifications enregistrées"); return refresh(); },
      onError,
    }),
    remove: useMutation({
      mutationFn: (id: string) => apiDelete(`/api/${resource}/${id}`),
      onSuccess: () => { toast.success("Suppression effectuée"); return refresh(); },
      onError,
    }),
  };
}
