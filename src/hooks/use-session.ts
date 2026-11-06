"use client";
import { createContext, useContext } from "react";
import type { SessionPayload } from "@/lib/auth/jwt";

export const SessionContext = createContext<SessionPayload | null>(null);

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession doit être utilisé dans l'espace connecté");
  return { ...s, isAdmin: s.role === "SUPER_ADMIN" };
}
