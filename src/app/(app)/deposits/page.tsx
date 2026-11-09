"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileDown, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { DepositRefundDialog } from "@/components/forms/deposit-refund-dialog";
import { DepositStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate, formatMoney } from "@/lib/utils";
import { DEPOSIT_STATUS } from "@/lib/labels";

type Row = { id: string; amount: string; amountPaid: string; status: keyof typeof DEPOSIT_STATUS; firstPaidAt: string | null; refundedAmount: string | null; deductedAmount: string | null; lease: { id: string; reference: string; tenant: { firstName: string; lastName: string }; residence: { name: string }; apartment: { number: string } | null }; payments: { id: string; amount: string; paidAt: string; receipt: { id: string; number: string } | null }[] };

export default function DepositsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [refund, setRefund] = useState<Row | null>(null);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("deposits", { q: dq, status, page });
  const totals = data?.totals as { amount: number; paid: number } | undefined;

  return (
    <>
      <PageHeader title="Cautions" description="Dépôts de garantie : montant, versements, restant et historique" actions={<ExportMenu entity="deposits" />} />
      {totals && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          {[["Total cautions", totals.amount, ""], ["Versé", totals.paid, "text-success"], ["Restant à percevoir", totals.amount - totals.paid, "text-destructive"]].map(([l, v, c]) => (
            <div key={l as string} className="rounded-2xl border bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">{l}</p><p className={`mt-1 font-display text-lg font-bold sm:text-xl ${c}`}>{formatMoney(v)}</p></div>
          ))}
        </div>
      )}
      <DepositRefundDialog open={!!refund} onOpenChange={(o) => !o && setRefund(null)} deposit={refund} title={refund ? `${refund.lease.tenant.firstName} ${refund.lease.tenant.lastName}` : undefined} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        toolbar={
          <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-40">
            <option value="">Tous statuts</option>
            {Object.entries(DEPOSIT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r) => router.push(`/leases/${r.lease.id}`)}
        columns={[
          { key: "tenant", header: "Locataire", cell: (r) => <div><p className="font-medium">{r.lease.tenant.firstName} {r.lease.tenant.lastName}</p><p className="text-xs text-muted-foreground">{r.lease.reference}</p></div> },
          { key: "home", header: "Logement", cell: (r) => `${r.lease.residence.name}${r.lease.apartment ? ` · ${r.lease.apartment.number}` : ""}`, hideOnMobile: true },
          { key: "amount", header: "Montant", cell: (r) => formatMoney(r.amount) },
          { key: "paid", header: "Versé", cell: (r) => formatMoney(r.amountPaid), hideOnMobile: true },
          { key: "rest", header: "Restant", cell: (r) => { const v = Number(r.amount) - Number(r.amountPaid); return <span className={v > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{formatMoney(v)}</span>; } },
          { key: "date", header: "1er versement", cell: (r) => formatDate(r.firstPaidAt), hideOnMobile: true },
          { key: "hist", header: "Versements", cell: (r) => r.payments.length, hideOnMobile: true },
          { key: "deducted", header: "Retenues", cell: (r) => (Number(r.deductedAmount ?? 0) > 0 ? <span className="text-destructive">{formatMoney(r.deductedAmount)}</span> : "—"), hideOnMobile: true },
          { key: "refunded", header: "Rendu", cell: (r) => (r.status === "REFUNDED" ? formatMoney(r.refundedAmount ?? 0) : "—"), hideOnMobile: true },
          { key: "status", header: "Statut", cell: (r) => <DepositStatusBadge status={r.status} /> },
          { key: "pdf", header: "", cell: (r) => <div className="flex justify-end gap-1">{r.status !== "REFUNDED" && Number(r.amountPaid) > 0 && <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); setRefund(r); }} aria-label="Restituer la caution" title="Restituer la caution"><Undo2 /></Button>}<Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); window.open(`/api/deposits/${r.id}/pdf`, "_blank"); }} aria-label="Relevé PDF" title="Relevé PDF"><FileDown /></Button></div> },
        ]}
      />
    </>
  );
}
