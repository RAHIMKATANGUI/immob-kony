"use client";
import { SessionContext } from "@/hooks/use-session";
import type { SessionPayload } from "@/lib/auth/jwt";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppShell({ session, children }: { session: SessionPayload; children: React.ReactNode }) {
  return (
    <SessionContext.Provider value={session}>
      <div className="min-h-dvh">
        <Sidebar />
        <div className="lg:pl-64">
          <Header />
          <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
