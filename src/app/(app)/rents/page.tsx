"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { RentStatusBadge } from "@/components/shared/status-badges";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatMoney, formatMonth } from "@/lib/utils";
import { RENT_STATUS } from "@/lib/labels";

type Row = { id: string; period: string; dueDate: string; amount: string; amountPaid: string; status: keyof typeof RENT_STATUS; lease: { id: string; reference: string; tenant: { firstName: string; lastName: string; phone: string }; residence: { name: string }; apartment: { number: string } | null } };

function RentsView() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(sp.get("status") ?? "");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("rents", { q: dq, status, month, page });
  const totals = data?.totals as { amount: number; paid: number } | undefined;

  return (
    <>
      <PageHeader title="Loyers" description="Échéancier global : montants, dates, avances et arriérés" actions={<ExportMenu entity="rents" />} />
      {totals && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[["Montant dû", totals.amount, ""], ["Encaissé", totals.paid, "text-success"], ["Reste à percevoir", totals.amount - totals.paid, "text-destructive"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-2xl border bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">{l}</p><p className={`mt-1 font-display text-lg font-bold sm:text-xl ${c}`}>{formatMoney(v)}</p></div>
          ))}
        </div>
      )}
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Locataire ou bail…"
        toolbar={
          <>
            <Input type="month" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} className="h-9 w-40" />
            <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-44">
              <option value="">Tous statuts</option>
              {Object.entries(RENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/leases/${r.lease.id}`)}
        columns={[
          { key: "period", header: "Période", cell: (r) => <span className="font-medium capitalize">{formatMonth(r.period)}</span> },
          { key: "tenant", header: "Locataire", cell: (r) => <div><p>{r.lease.tenant.firstName} {r.lease.tenant.lastName}</p><p className="text-xs text-muted-foreground">{r.lease.residence.name}{r.lease.apartment ? ` · ${r.lease.apartment.number}` : ""}</p></div> },
          { key: "due", header: "Échéance", cell: (r) => formatDate(r.dueDate), hideOnMobile: true },
          { key: "amount", header: "Montant", cell: (r) => formatMoney(r.amount), hideOnMobile: true },
          { key: "paid", header: "Payé", cell: (r) => formatMoney(r.amountPaid), hideOnMobile: true },
          { key: "rest", header: "Reste", cell: (r) => { const v = Number(r.amount) - Number(r.amountPaid); return <span className={v > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{formatMoney(v)}</span>; } },
          { key: "status", header: "Statut", cell: (r) => <RentStatusBadge status={r.status} /> },
        ]}
      />
    </>
  );
}

export default function RentsPage() {
  return <Suspense><RentsView /></Suspense>;
}
