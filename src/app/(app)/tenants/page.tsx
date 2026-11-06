"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useList } from "@/hooks/use-resource";
import { useOptions } from "@/hooks/use-options";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatMoney, initials } from "@/lib/utils";

type Row = {
  id: string; code: string; firstName: string; lastName: string; phone: string; email: string | null; photoUrl: string | null; profession: string | null; entryDate: string; exitDate: string | null; totalOccupants: number;
  residence: { name: string }; apartment: { number: string } | null; activeLease: { id: string; reference: string; monthlyRent: string; lateCount: number } | null;
};

export default function TenantsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [state, setState] = useState("active");
  const [residenceId, setResidenceId] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const residences = useOptions("residences");
  const { data, isLoading } = useList<Row>("tenants", { q: dq, state, residenceId, page });

  return (
    <>
      <PageHeader title="Locataires" description="Occupants, logements et situation de paiement" actions={<><ExportMenu entity="tenants" /><Button asChild><Link href="/tenants/new"><Plus /> Ajouter un locataire</Link></Button></>} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Nom, téléphone, code, pièce…"
        toolbar={
          <>
            <NativeSelect value={residenceId} onChange={(e) => { setResidenceId(e.target.value); setPage(1); }} className="h-9 w-48">
              <option value="">Toutes les résidences</option>
              {residences.data?.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </NativeSelect>
            <NativeSelect value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} className="h-9 w-36">
              <option value="active">En place</option>
              <option value="left">Sortis</option>
              <option value="">Tous</option>
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/tenants/${r.id}`)}
        columns={[
          {
            key: "name", header: "Locataire", cell: (r) => (
              <div className="flex items-center gap-3">
                <Avatar>{r.photoUrl && <AvatarImage src={r.photoUrl} alt="" />}<AvatarFallback>{initials(r.firstName, r.lastName)}</AvatarFallback></Avatar>
                <div className="min-w-0"><p className="truncate font-medium">{r.firstName} {r.lastName}</p><p className="truncate text-xs text-muted-foreground">{r.code} · {r.phone}</p></div>
              </div>
            ),
          },
          { key: "home", header: "Logement", cell: (r) => <div><p className="text-sm">{r.residence.name}</p><p className="text-xs text-muted-foreground">{r.apartment ? `Appt ${r.apartment.number}` : "Résidence"}</p></div>, hideOnMobile: true },
          { key: "occ", header: "Occupants", cell: (r) => r.totalOccupants, hideOnMobile: true },
          { key: "rent", header: "Loyer", cell: (r) => (r.activeLease ? formatMoney(r.activeLease.monthlyRent) : "—"), hideOnMobile: true },
          { key: "entry", header: "Entrée", cell: (r) => formatDate(r.entryDate), hideOnMobile: true },
          {
            key: "state", header: "Situation", cell: (r) =>
              r.exitDate ? <Badge variant="muted">Sorti</Badge>
              : !r.activeLease ? <Badge variant="warning">Sans bail</Badge>
              : r.activeLease.lateCount > 0 ? <Badge variant="danger"><AlertCircle className="size-3" /> {r.activeLease.lateCount} retard(s)</Badge>
              : <Badge variant="success" dot>À jour</Badge>,
          },
        ]}
      />
    </>
  );
}
