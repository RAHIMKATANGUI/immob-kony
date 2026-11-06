"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { NAV } from "./nav";
import { Logo } from "./logo";
import { useSession } from "@/hooks/use-session";

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useSession();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-5">
        <Link href="/dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scrollbar-thin">
        {NAV.map((group) => {
          const items = group.items.filter((i) => !("adminOnly" in i && i.adminOnly) || isAdmin);
          if (!items.length) return null;
          return (
            <div key={group.label}>
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">{group.label}</p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="relative">
                      {active && (
                        <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-white/[0.07] ring-1 ring-inset ring-white/10" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                      )}
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                          active ? "font-medium text-white" : "text-sidebar-muted hover:text-white",
                        )}
                      >
                        <Icon className={cn("size-[18px]", active && "text-turquoise-400")} />
                        {item.label}
                        {active && <span className="ml-auto size-1.5 rounded-full bg-turquoise-400 shadow-[0_0_8px_2px] shadow-turquoise-400/50" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="m-3 rounded-2xl border border-sidebar-border bg-gradient-to-br from-turquoise-500/15 via-transparent to-transparent p-4">
        <p className="text-xs font-semibold text-white">Relances automatiques</p>
        <p className="mt-1 text-[11px] leading-relaxed text-sidebar-muted">J-7, J-3, J-1 avant échéance puis J+1, J+7, J+15 par email et SMS.</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
      <SidebarContent />
    </aside>
  );
}
