"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Building2, DoorOpen, FileSignature, Loader2, Receipt, User } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { apiGet } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { formatMoney } from "@/lib/utils";
import { APARTMENT_STATUS, LEASE_STATUS } from "@/lib/labels";

type Results = {
  tenants: { id: string; firstName: string; lastName: string; code: string; phone: string; residence: { name: string } }[];
  apartments: { id: string; number: string; status: keyof typeof APARTMENT_STATUS; residence: { name: string } }[];
  residences: { id: string; name: string; commune: string; city: string }[];
  leases: { id: string; reference: string; status: keyof typeof LEASE_STATUS; tenant: { firstName: string; lastName: string } }[];
  receipts: { id: string; number: string; amount: string; payment: { lease: { tenant: { firstName: string; lastName: string } } } }[];
};

/** Recherche globale (⌘K / Ctrl+K). */
export function CommandSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const dq = useDebounce(q, 250);
  const { data, isFetching } = useQuery({ queryKey: ["search", dq], queryFn: () => apiGet<Results>(`/api/search?q=${encodeURIComponent(dq)}`), enabled: dq.length >= 2 });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    setQ("");
    router.push(href);
  };
  const empty = data && Object.values(data).every((v) => v.length === 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl overflow-hidden p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput placeholder="Rechercher un locataire, appartement, résidence, bail, reçu…" value={q} onValueChange={setQ} />
          <CommandList>
            {dq.length < 2 && <p className="py-8 text-center text-sm text-muted-foreground">Saisissez au moins 2 caractères</p>}
            {isFetching && <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>}
            {empty && !isFetching && <CommandEmpty>Aucun résultat pour « {dq} »</CommandEmpty>}
            {data && dq.length >= 2 && (
              <>
                {data.tenants.length > 0 && (
                  <CommandGroup heading="Locataires">
                    {data.tenants.map((t) => (
                      <CommandItem key={t.id} value={`t-${t.id}`} onSelect={() => go(`/tenants/${t.id}`)}>
                        <User /> <span className="font-medium">{t.firstName} {t.lastName}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{t.code} · {t.residence.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {data.apartments.length > 0 && (
                  <CommandGroup heading="Appartements">
                    {data.apartments.map((a) => (
                      <CommandItem key={a.id} value={`a-${a.id}`} onSelect={() => go(`/apartments/${a.id}`)}>
                        <DoorOpen /> <span className="font-medium">Appt {a.number}</span>
                        <span className="ml-auto truncate text-xs text-muted-foreground">{a.residence.name} · {APARTMENT_STATUS[a.status]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {data.residences.length > 0 && (
                  <CommandGroup heading="Résidences">
                    {data.residences.map((r) => (
                      <CommandItem key={r.id} value={`r-${r.id}`} onSelect={() => go(`/residences/${r.id}`)}>
                        <Building2 /> <span className="font-medium">{r.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{r.commune}, {r.city}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {data.leases.length > 0 && (
                  <CommandGroup heading="Baux">
                    {data.leases.map((l) => (
                      <CommandItem key={l.id} value={`l-${l.id}`} onSelect={() => go(`/leases/${l.id}`)}>
                        <FileSignature /> <span className="font-medium">{l.reference}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{l.tenant.firstName} {l.tenant.lastName} · {LEASE_STATUS[l.status]}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {data.receipts.length > 0 && (
                  <CommandGroup heading="Reçus">
                    {data.receipts.map((r) => (
                      <CommandItem key={r.id} value={`rc-${r.id}`} onSelect={() => { onOpenChange(false); window.open(`/api/receipts/${r.id}/pdf`, "_blank"); }}>
                        <Receipt /> <span className="font-medium">{r.number}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{r.payment.lease.tenant.firstName} {r.payment.lease.tenant.lastName} · {formatMoney(r.amount)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
