"use client";

/** Client HTTP du frontend : JSON + jeton CSRF (double-submit cookie) + erreurs typées. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)ik_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function api<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    credentials: "same-origin",
    ...rest,
    headers: {
      Accept: "application/json",
      ...(json !== undefined && { "Content-Type": "application/json" }),
      ...(rest.method && rest.method !== "GET" && { "x-csrf-token": csrfToken() }),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/api/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new HttpError(res.status, data?.error ?? `Erreur ${res.status}`, data?.details);
  return data as T;
}

export const apiGet = <T,>(url: string) => api<T>(url);
export const apiPost = <T,>(url: string, json?: unknown) => api<T>(url, { method: "POST", json: json ?? {} });
export const apiPatch = <T,>(url: string, json: unknown) => api<T>(url, { method: "PATCH", json });
export const apiPut = <T,>(url: string, json: unknown) => api<T>(url, { method: "PUT", json });
export const apiDelete = <T,>(url: string) => api<T>(url, { method: "DELETE" });

export async function uploadFile(file: File, folder: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  return api<{ url: string }>("/api/upload", { method: "POST", body: fd });
}

/** Extrait les erreurs de champs Zod renvoyées par l'API. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof HttpError)) return {};
  const d = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
  return Object.fromEntries(Object.entries(d?.fieldErrors ?? {}).map(([k, v]) => [k, v[0]]));
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
