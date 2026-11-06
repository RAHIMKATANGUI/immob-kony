"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Building2, Mail, MapPin, Pencil, Phone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Info, Section } from "@/components/shared/info";
import { HistoryTimeline, type AuditEntry } from "@/components/shared/history-timeline";
import { OwnerFormDialog, type OwnerRow } from "@/components/forms/owner-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useItem } from "@/hooks/use-resource";
import { formatDate } from "@/lib/utils";

type Data = { owner: OwnerRow; residences: { id: string; name: string; commune: string; city: string; apartments: { status: string }[] }[]; history: AuditEntry[] };

export default function OwnerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data } = useItem<Data>("owners", id);
  const [open, setOpen] = useState(false);
  if (!data) return <Skeleton className="h-96 rounded-2xl" />;
  const { owner, residences, history } = data;
  return (
    <>
      <PageHeader
        back={{ href: "/owners", label: "Propriétaires" }}
        title={`${owner.firstName} ${owner.lastName}`}
        description={`${owner.code} · client depuis le ${formatDate(owner.createdAt, { month: "long" })}`}
        actions={<Button variant="outline" onClick={() => setOpen(true)}><Pencil /> Modifier</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Coordonnées">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Téléphone"><a href={`tel:${owner.phone}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Phone className="size-3.5" />{owner.phone}</a></Info>
              <Info label="Email">{owner.email ? <a href={`mailto:${owner.email}`} className="inline-flex items-center gap-1.5 hover:text-brand"><Mail className="size-3.5" />{owner.email}</a> : "—"}</Info>
              <Info label="Adresse"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{owner.address}</span></Info>
            </div>
            {owner.notes && <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">{owner.notes}</p>}
          </Section>
          <Section title="Résidences" description={`${residences.length} résidence(s) rattachée(s)`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {residences.map((r) => {
                const occ = r.apartments.filter((a) => a.status === "OCCUPIED").length;
                return (
                  <Link key={r.id} href={`/residences/${r.id}`} className="flex items-center gap-3 rounded-xl border p-3 transition hover:border-brand/50 hover:bg-muted/40">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Building2 className="size-5" /></span>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="text-xs text-muted-foreground">{r.commune} · {occ}/{r.apartments.length} occupés</p>
                    </div>
                  </Link>
                );
              })}
              {!residences.length && <p className="text-sm text-muted-foreground">Aucune résidence.</p>}
            </div>
          </Section>
        </div>
        <Section title="Historique" description="Modifications tracées">
          <HistoryTimeline entries={history} />
        </Section>
      </div>
      <OwnerFormDialog open={open} onOpenChange={setOpen} owner={owner} />
    </>
  );
}
