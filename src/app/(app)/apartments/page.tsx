"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { ApartmentStatusBadge } from "@/components/shared/status-badges";
import { ApartmentFormDialog } from "@/components/forms/apartment-form";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useList } from "@/hooks/use-resource";
import { useOptions } from "@/hooks/use-options";
import { useDebounce } from "@/hooks/use-debounce";
import { formatMoney } from "@/lib/utils";
import { APARTMENT_STATUS } from "@/lib/labels";

type Row = { id: string; number: string; floor: number; surface: string; roomsCount: number; baseRent: string; status: keyof typeof APARTMENT_STATUS; residence: { name: string; commune: string }; tenants: { firstName: string; lastName: string }[]; _count: { rooms: number } };

export default function ApartmentsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [residenceId, setResidenceId] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const dq = useDebounce(q);
  const residences = useOptions("residences");
  const { data, isLoading } = useList<Row>("apartments", { q: dq, status, residenceId, page });

  return (
    <>
      <PageHeader title="Appartements" description="Logements, statuts et composition" actions={<><ExportMenu entity="apartments" /><Button onClick={() => setOpen(true)}><Plus /> Nouvel appartement</Button></>} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Numéro ou résidence…"
        toolbar={
          <>
            <NativeSelect value={residenceId} onChange={(e) => { setResidenceId(e.target.value); setPage(1); }} className="h-9 w-48">
              <option value="">Toutes les résidences</option>
              {residences.data?.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-40">
              <option value="">Tous statuts</option>
              {Object.entries(APARTMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/apartments/${r.id}`)}
        columns={[
          { key: "num", header: "Appartement", cell: (r) => <div><p className="font-semibold">{r.number}</p><p className="text-xs text-muted-foreground">{r.residence.name}</p></div> },
          { key: "floor", header: "Étage", cell: (r) => (r.floor === 0 ? "RDC" : r.floor), hideOnMobile: true },
          { key: "surface", header: "Surface", cell: (r) => `${Number(r.surface)} m²`, hideOnMobile: true },
          { key: "rooms", header: "Pièces", cell: (r) => r.roomsCount, hideOnMobile: true },
          { key: "rent", header: "Loyer réf.", cell: (r) => formatMoney(r.baseRent), hideOnMobile: true },
          { key: "tenant", header: "Occupant", cell: (r) => (r.tenants[0] ? `${r.tenants[0].firstName} ${r.tenants[0].lastName}` : <span className="text-muted-foreground">—</span>), hideOnMobile: true },
          { key: "status", header: "Statut", cell: (r) => <ApartmentStatusBadge status={r.status} /> },
        ]}
      />
      <ApartmentFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
