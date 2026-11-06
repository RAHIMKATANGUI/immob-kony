"use client";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, MapPin, Plus, Search, UserRound, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ExportMenu } from "@/components/shared/export-menu";
import { ResidenceFormDialog } from "@/components/forms/residence-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";

type Row = {
  id: string; code: string; name: string; city: string; commune: string; address: string; description: string | null;
  owner: { firstName: string; lastName: string }; manager: { firstName: string; lastName: string } | null;
  apartmentsCount: number; occupiedCount: number; _count: { tenants: number };
};

export default function ResidencesPage() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("residences", { q: dq, pageSize: 100 });

  return (
    <>
      <PageHeader title="Résidences" description="Immeubles et ensembles gérés" actions={<><ExportMenu entity="residences" /><Button onClick={() => setOpen(true)}><Plus /> Nouvelle résidence</Button></>} />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, ville, commune…" className="pl-9" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        {data?.items.map((r, i) => {
          const rate = r.apartmentsCount ? Math.round((r.occupiedCount / r.apartmentsCount) * 100) : 0;
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} whileHover={{ y: -3 }}>
              <Link href={`/residences/${r.id}`} className="group block overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:border-brand/40 hover:shadow-glow">
                <div className="relative h-24 overflow-hidden bg-gradient-to-br from-night-800 via-night-900 to-night-950">
                  <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#ffffff1a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff1a_1px,transparent_1px)] [background-size:22px_22px]" />
                  <div className="absolute -right-6 -top-10 size-32 rounded-full bg-turquoise-500/30 blur-2xl transition group-hover:bg-turquoise-400/40" />
                  <Building2 className="absolute bottom-3 left-4 size-8 text-turquoise-300" />
                  <span className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">{r.code}</span>
                </div>
                <div className="p-4">
                  <h3 className="truncate font-semibold">{r.name}</h3>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground"><MapPin className="size-3.5" /> {r.commune}, {r.city}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-muted/60 py-2"><p className="font-display text-lg font-bold">{r.apartmentsCount}</p><p className="text-[11px] text-muted-foreground">Appts</p></div>
                    <div className="rounded-xl bg-muted/60 py-2"><p className="font-display text-lg font-bold">{r._count.tenants}</p><p className="text-[11px] text-muted-foreground">Locataires</p></div>
                    <div className="rounded-xl bg-accent py-2 text-accent-foreground"><p className="font-display text-lg font-bold">{rate}%</p><p className="text-[11px]">Occupation</p></div>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${rate}%` }} /></div>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><UserRound className="size-3.5" /> {r.owner.firstName} {r.owner.lastName}</span>
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {r.manager ? `${r.manager.firstName} ${r.manager.lastName}` : "Non attribuée"}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
      {data && !data.items.length && <p className="py-16 text-center text-sm text-muted-foreground">Aucune résidence. Créez la première !</p>}
      <ResidenceFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
