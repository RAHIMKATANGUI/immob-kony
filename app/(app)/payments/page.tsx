"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HandCoins } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { PaymentTypeBadge } from "@/components/shared/status-badges";
import { PaymentDialog } from "@/components/forms/payment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatMoney } from "@/lib/utils";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/labels";

type Row = { id: string; paidAt: string; amount: string; type: keyof typeof PAYMENT_TYPES; method: keyof typeof PAYMENT_METHODS; reference: string | null; receipt: { id: string; number: string } | null; recordedBy: { firstName: string; lastName: string } | null; lease: { id: string; reference: string; tenant: { firstName: string; lastName: string }; residence: { name: string }; apartment: { number: string } | null } };

function PaymentsView() {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  useEffect(() => { if (sp.get("new") === "1") setOpen(true); }, [sp]);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("payments", { q: dq, type, from, to, page });

  return (
    <>
      <PageHeader title="Paiements" description={data ? `Total filtré : ${formatMoney(data.totalAmount as number)}` : "Historique des encaissements"} actions={<><ExportMenu entity="payments" /><Button variant="brand" onClick={() => setOpen(true)}><HandCoins /> Encaisser</Button></>} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Locataire, reçu, référence…"
        toolbar={
          <>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="Du" />
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-36" aria-label="Au" />
            <NativeSelect value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="h-9 w-40">
              <option value="">Toutes natures</option>
              {Object.entries(PAYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/leases/${r.lease.id}`)}
        columns={[
          { key: "date", header: "Date", cell: (r) => formatDate(r.paidAt) },
          { key: "tenant", header: "Locataire", cell: (r) => <div><p className="font-medium">{r.lease.tenant.firstName} {r.lease.tenant.lastName}</p><p className="text-xs text-muted-foreground">{r.lease.residence.name}{r.lease.apartment ? ` · ${r.lease.apartment.number}` : ""}</p></div> },
          { key: "type", header: "Nature", cell: (r) => <PaymentTypeBadge type={r.type} />, hideOnMobile: true },
          { key: "method", header: "Mode", cell: (r) => PAYMENT_METHODS[r.method], hideOnMobile: true },
          { key: "receipt", header: "Reçu", cell: (r) => r.receipt ? <a onClick={(e) => e.stopPropagation()} href={`/api/receipts/${r.receipt.id}/pdf`} target="_blank" className="font-medium text-brand hover:underline">{r.receipt.number}</a> : "—", hideOnMobile: true },
          { key: "by", header: "Saisi par", cell: (r) => (r.recordedBy ? `${r.recordedBy.firstName} ${r.recordedBy.lastName}` : "—"), hideOnMobile: true },
          { key: "amount", header: "Montant", className: "text-right", cell: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span> },
        ]}
      />
      <PaymentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export default function PaymentsPage() {
  return <Suspense><PaymentsView /></Suspense>;
}
