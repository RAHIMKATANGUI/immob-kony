"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, LogOut, Menu, Monitor, Moon, Search, Settings, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarContent } from "./sidebar";
import { CommandSearch } from "./command-search";
import { useSession } from "@/hooks/use-session";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { ROLES } from "@/lib/labels";

type Notif = { id: string; title: string; message: string; createdAt: string; readAt: string | null; leaseId: string | null };

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Changer de thème">
          <Sun className="rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {[
          { v: "light", l: "Clair", I: Sun },
          { v: "dark", l: "Sombre", I: Moon },
          { v: "system", l: "Système", I: Monitor },
        ].map(({ v, l, I }) => (
          <DropdownMenuItem key={v} onClick={() => setTheme(v)} className={cn(theme === v && "font-medium")}>
            <I /> {l}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Notifications() {
  const qc = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({ queryKey: ["notifications"], queryFn: () => apiGet<{ items: Notif[]; unread: number }>("/api/notifications"), refetchInterval: 60_000 });
  const markAll = useMutation({ mutationFn: () => apiPatch("/api/notifications", { all: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell />
          {!!data?.unread && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-brand-foreground">{data.unread > 9 ? "9+" : data.unread}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          <Button variant="ghost" size="sm" onClick={() => markAll.mutate()} disabled={!data?.unread}>
            <CheckCheck /> Tout lire
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {!data?.items.length && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucune notification</p>}
          {data?.items.map((n) => (
            <DropdownMenuItem key={n.id} className="items-start rounded-none border-b px-4 py-3 last:border-0" onClick={() => n.leaseId && router.push(`/leases/${n.leaseId}`)}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand")} />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const session = useSession();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const initials = session.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const logout = async () => {
    await apiPost("/api/auth/logout");
    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 border-b bg-background/75 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMenu(true)} aria-label="Ouvrir le menu">
          <Menu />
        </Button>
        <button
          onClick={() => setSearch(true)}
          className="group flex h-10 flex-1 items-center gap-2 rounded-xl border bg-card px-3 text-sm text-muted-foreground shadow-sm transition hover:border-brand/40 sm:max-w-md"
        >
          <Search className="size-4" />
          <span className="truncate">Rechercher…</span>
          <kbd className="ml-auto hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
        </button>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <Notifications />
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 flex items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar className="size-8">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight md:block">
                <p className="text-sm font-medium">{session.name}</p>
                <p className="text-[11px] text-muted-foreground">{ROLES[session.role]}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{session.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}><User /> Mon profil</DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}><Settings /> Paramètres</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={logout}><LogOut /> Déconnexion</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <Dialog open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="p-0">
          <DialogTitle className="sr-only">Menu</DialogTitle>
          <SidebarContent onNavigate={() => setMenu(false)} />
        </SheetContent>
      </Dialog>
      <CommandSearch open={search} onOpenChange={setSearch} />
    </header>
  );
}
