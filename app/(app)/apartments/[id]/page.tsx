"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bath, BedDouble, BriefcaseBusiness, CookingPot, DoorClosed, Pencil, Plus, Sofa, Sun, Trash2, Toilet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Info, Section } from "@/components/shared/info";
import { ApartmentStatusBadge, LeaseStatusBadge } from "@/components/shared/status-badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ApartmentFormDialog, type ApartmentRow } from "@/components/forms/apartment-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrud, useItem, onError } from "@/hooks/use-resource";
import { apiDelete, apiPost } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/utils";
import { ROOM_TYPES, type LEASE_STATUS } from "@/lib/labels";

const ROOM_ICON = { LIVING_ROOM: Sofa, BEDROOM: BedDouble, KITCHEN: CookingPot, TOILET: Toilet, SHOWER: Bath, BALCONY: Sun, OFFICE: BriefcaseBusiness } as const;

type Data = ApartmentRow & {
  residence: { id: string; name: string; commune: string; owner: { firstName: string; lastName: string } };
  rooms: { id: string; type: keyof typeof ROOM_TYPES; label: string | null; surface: string | null }[];
  tenants: { id: string; firstName: string; lastName: string; entryDate: string; exitDate: string | null }[];
  leases: { id: string; reference: string; startDate: string; endDate: string; monthlyRent: string; status: keyof typeof LEASE_STATUS; tenant: { firstName: string; lastName: string } }[];
};

export default function ApartmentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { data } = useItem<Data>("apartments", id);
  const { remove } = useCrud("apartments", ["residences"]);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const [room, setRoom] = useState<{ type: keyof typeof ROOM_TYPES; label: string; surface: string }>({ type: "BEDROOM", label: "", surface: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["apartments"] });
  const addRoom = useMutation({
    mutationFn: () => apiPost(`/api/apartments/${id}/rooms`, { ...room, surface: room.surface ? Number(room.surface) : null }),
    onSuccess: () => { toast.success("Pièce ajoutée"); setRoom({ type: "BEDROOM", label: "", surface: "" }); refresh(); },
    onError,
  });
  const delRoom = useMutation({ mutationFn: (rid: string) => apiDelete(`/api/rooms/${rid}`), onSuccess: refresh, onError });

  if (!data) return <Skeleton className="h-96 rounded-2xl" />;
  const totalSurface = data.rooms.reduce((a, r) => a + Number(r.surface ?? 0), 0);

  return (
    <>
      <PageHeader
        back={{ href: `/residences/${data.residence.id}`, label: data.residence.name }}
        title={<span className="flex items-center gap-3">Appartement {data.number} <ApartmentStatusBadge status={data.status} /></span>}
        description={`${data.residence.name} · ${data.residence.commune} · ${data.floor === 0 ? "Rez-de-chaussée" : `Étage ${data.floor}`}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setEdit(true)}><Pencil /> Modifier</Button>
            <Button variant="outline" onClick={() => setDel(true)}><Trash2 /> Supprimer</Button>
            {data.status === "AVAILABLE" && <Button asChild><Link href={`/leases/new?apartmentId=${data.id}&residenceId=${data.residence.id}`}><Plus /> Nouveau bail</Link></Button>}
          </>
        }
      />
      <div className="mb-4 grid gap-4 rounded-2xl border bg-card p-5 shadow-soft sm:grid-cols-5">
        <Info label="Surface">{Number(data.surface)} m²</Info>
        <Info label="Pièces">{data.roomsCount}</Info>
        <Info label="Loyer de référence">{formatMoney(data.baseRent)}</Info>
        <Info label="Propriétaire">{data.residence.owner.firstName} {data.residence.owner.lastName}</Info>
        <Info label="Occupant">{data.tenants.find((t) => !t.exitDate) ? (() => { const t = data.tenants.find((x) => !x.exitDate)!; return <Link href={`/tenants/${t.id}`} className="hover:text-brand">{t.firstName} {t.lastName}</Link>; })() : "—"}</Info>
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Section title="Détail des pièces" description={`${data.rooms.length} pièce(s) · ${totalSurface} m² détaillés`} className="lg:col-span-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {data.rooms.map((r) => {
              const Icon = ROOM_ICON[r.type] ?? DoorClosed;
              return (
                <div key={r.id} className="group flex items-center gap-3 rounded-xl border p-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.label || ROOM_TYPES[r.type]}</p>
                    <p className="text-xs text-muted-foreground">{ROOM_TYPES[r.type]}{r.surface ? ` · ${Number(r.surface)} m²` : ""}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="size-8 opacity-60 group-hover:opacity-100" onClick={() => delRoom.mutate(r.id)} aria-label="Supprimer la pièce"><Trash2 /></Button>
                </div>
              );
            })}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addRoom.mutate(); }} className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-[1fr_1fr_90px_auto]">
            <NativeSelect value={room.type} onChange={(e) => setRoom({ ...room, type: e.target.value as keyof typeof ROOM_TYPES })}>
              {Object.entries(ROOM_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <Input placeholder="Libellé (ex. Chambre 2)" value={room.label} onChange={(e) => setRoom({ ...room, label: e.target.value })} />
            <Input type="number" placeholder="m²" value={room.surface} onChange={(e) => setRoom({ ...room, surface: e.target.value })} />
            <Button type="submit" loading={addRoom.isPending}><Plus /> Ajouter</Button>
          </form>
        </Section>
        <Section title="Historique locatif" className="lg:col-span-2">
          <ul className="space-y-2">
            {data.leases.map((l) => (
              <li key={l.id}>
                <Link href={`/leases/${l.id}`} className="flex items-center justify-between gap-2 rounded-xl border p-3 transition hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{l.tenant.firstName} {l.tenant.lastName}</p>
                    <p className="text-xs text-muted-foreground">{l.reference} · {formatDate(l.startDate)} → {formatDate(l.endDate)}</p>
                  </div>
                  <LeaseStatusBadge status={l.status} />
                </Link>
              </li>
            ))}
            {!data.leases.length && <p className="text-sm text-muted-foreground">Aucun bail.</p>}
          </ul>
        </Section>
      </div>
      <ApartmentFormDialog open={edit} onOpenChange={setEdit} apartment={data} />
      <ConfirmDialog open={del} onOpenChange={setDel} title="Supprimer cet appartement ?" description="Impossible si un bail actif y est rattaché." loading={remove.isPending} onConfirm={() => remove.mutate(data.id, { onSuccess: () => router.push(`/residences/${data.residence.id}`) })} />
    </>
  );
}
