"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { LeaseStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatMoney } from "@/lib/utils";
import { LEASE_STATUS } from "@/lib/labels";

type Row = { id: string; reference: string; status: keyof typeof LEASE_STATUS; startDate: string; endDate: string; monthlyRent: string; charges: string; creditBalance: string; arrears: number; tenant: { firstName: string; lastName: string }; residence: { name: string }; apartment: { number: string } | null };

export default function LeasesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("leases", { q: dq, status, page });
  return (
    <>
      <PageHeader title="Contrats de bail" description="Baux, échéances et situation financière" actions={<><ExportMenu entity="leases" /><Button asChild><Link href="/leases/new"><Plus /> Nouveau bail</Link></Button></>} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Référence, locataire, résidence…"
        toolbar={
          <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-40">
            <option value="">Tous statuts</option>
            {Object.entries(LEASE_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/leases/${r.id}`)}
        columns={[
          { key: "ref", header: "Bail", cell: (r) => <div><p className="font-semibold">{r.reference}</p><p className="text-xs text-muted-foreground">{r.tenant.firstName} {r.tenant.lastName}</p></div> },
          { key: "home", header: "Logement", cell: (r) => `${r.residence.name}${r.apartment ? ` · ${r.apartment.number}` : ""}`, hideOnMobile: true },
          { key: "period", header: "Période", cell: (r) => `${formatDate(r.startDate)} → ${formatDate(r.endDate)}`, hideOnMobile: true },
          { key: "rent", header: "Mensualité", cell: (r) => formatMoney(Number(r.monthlyRent) + Number(r.charges)), hideOnMobile: true },
          { key: "arrears", header: "Arriéré", cell: (r) => <span className={r.arrears > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{formatMoney(r.arrears)}</span> },
          { key: "credit", header: "Solde dispo.", cell: (r) => formatMoney(r.creditBalance), hideOnMobile: true },
          { key: "status", header: "Statut", cell: (r) => <LeaseStatusBadge status={r.status} /> },
        ]}
      />
    </>
  );
}
