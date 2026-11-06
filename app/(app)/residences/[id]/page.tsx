"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BedDouble, Layers, Pencil, Plus, Ruler, Trash2, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Info, Section } from "@/components/shared/info";
import { ApartmentStatusBadge } from "@/components/shared/status-badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ResidenceFormDialog, type ResidenceRow } from "@/components/forms/residence-form";
import { ApartmentFormDialog } from "@/components/forms/apartment-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrud, useItem } from "@/hooks/use-resource";
import { useSession } from "@/hooks/use-session";
import { formatMoney } from "@/lib/utils";
import type { APARTMENT_STATUS } from "@/lib/labels";

type Data = ResidenceRow & {
  owner: { id: string; firstName: string; lastName: string; phone: string };
  manager: { firstName: string; lastName: string; phone: string } | null;
  apartments: { id: string; number: string; floor: number; surface: string; roomsCount: number; baseRent: string; status: keyof typeof APARTMENT_STATUS; _count: { rooms: number }; tenants: { id: string; firstName: string; lastName: string }[] }[];
  tenants: { id: string; firstName: string; lastName: string; phone: string }[];
};

export default function ResidenceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isAdmin } = useSession();
  const { data } = useItem<Data>("residences", id);
  const { remove } = useCrud("residences");
  const [edit, setEdit] = useState(false);
  const [addApt, setAddApt] = useState(false);
  const [del, setDel] = useState(false);
  if (!data) return <Skeleton className="h-96 rounded-2xl" />;

  const floors = [...new Set(data.apartments.map((a) => a.floor))].sort((a, b) => a - b);
  return (
    <>
      <PageHeader
        back={{ href: "/residences", label: "Résidences" }}
        title={data.name}
        description={`${data.code} · ${data.address}, ${data.commune}, ${data.city}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Modifier</Button>
            {isAdmin && <Button variant="outline" onClick={() => setDel(true)}><Trash2 /> Supprimer</Button>}
            <Button onClick={() => setAddApt(true)}><Plus /> Appartement</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-4">
        <Info label="Propriétaire"><Link href={`/owners/${data.owner.id}`} className="hover:text-brand">{data.owner.firstName} {data.owner.lastName}</Link></Info>
        <Info label="Gestionnaire">{data.manager ? `${data.manager.firstName} ${data.manager.lastName}` : "Non attribuée"}</Info>
        <Info label="Appartements">{data.apartments.length}</Info>
        <Info label="Occupés">{data.apartments.filter((a) => a.status === "OCCUPIED").length}</Info>
        {data.description && <p className="text-sm text-muted-foreground sm:col-span-4">{data.description}</p>}
      </div>

      {floors.map((f) => (
        <Section key={f} title={f === 0 ? "Rez-de-chaussée" : `Étage ${f}`} className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.apartments.filter((a) => a.floor === f).map((a) => (
              <button key={a.id} onClick={() => router.push(`/apartments/${a.id}`)} className="rounded-xl border p-4 text-left transition hover:border-brand/50 hover:bg-muted/40">
                <div className="flex items-start justify-between">
                  <p className="font-display text-lg font-bold">{a.number}</p>
                  <ApartmentStatusBadge status={a.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Ruler className="size-3.5" />{Number(a.surface)} m²</span>
                  <span className="flex items-center gap-1"><BedDouble className="size-3.5" />{a.roomsCount} pièces</span>
                  <span className="flex items-center gap-1"><Layers className="size-3.5" />{a._count.rooms} détaillées</span>
                </div>
                <p className="mt-3 text-sm font-semibold">{formatMoney(a.baseRent)}<span className="font-normal text-muted-foreground"> /mois</span></p>
                {a.tenants[0] && <p className="mt-1 flex items-center gap-1 truncate text-xs"><UserRound className="size-3.5 text-brand" />{a.tenants[0].firstName} {a.tenants[0].lastName}</p>}
              </button>
            ))}
          </div>
        </Section>
      ))}
      {!data.apartments.length && <Section title="Appartements"><p className="text-sm text-muted-foreground">Aucun appartement. Ajoutez-en un pour commencer.</p></Section>}
      {data.tenants.length > 0 && (
        <Section title="Locataires rattachés à la résidence" description="Sans appartement précis">
          <ul className="divide-y">{data.tenants.map((t) => <li key={t.id} className="py-2 text-sm"><Link href={`/tenants/${t.id}`} className="font-medium hover:text-brand">{t.firstName} {t.lastName}</Link> <span className="text-muted-foreground">· {t.phone}</span></li>)}</ul>
        </Section>
      )}
      <ResidenceFormDialog open={edit} onOpenChange={setEdit} residence={data} />
      <ApartmentFormDialog open={addApt} onOpenChange={setAddApt} residenceId={data.id} />
      <ConfirmDialog open={del} onOpenChange={setDel} title="Supprimer cette résidence ?" description="La résidence et ses appartements seront archivés. Impossible si un bail est actif." loading={remove.isPending} onConfirm={() => remove.mutate(data.id, { onSuccess: () => router.push("/residences") })} />
    </>
  );
}
