"use client";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Mail, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { ExportMenu } from "@/components/shared/export-menu";
import { PaymentTypeBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { useList, onError } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { apiPost } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/utils";
import type { PAYMENT_TYPES } from "@/lib/labels";

type Row = { id: string; number: string; amount: string; label: string; issuedAt: string; emailedAt: string | null; payment: { type: keyof typeof PAYMENT_TYPES; paidAt: string; lease: { reference: string; tenant: { firstName: string; lastName: string; email: string | null }; residence: { name: string } } } };

export default function ReceiptsPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const dq = useDebounce(q);
  const { data, isLoading, refetch } = useList<Row>("receipts", { q: dq, page });
  const email = useMutation({ mutationFn: (id: string) => apiPost(`/api/receipts/${id}/email`), onSuccess: () => { toast.success("Reçu envoyé par email"); refetch(); }, onError });

  return (
    <>
      <PageHeader title="Reçus" description="Reçus PDF numérotés avec QR code de vérification" actions={<ExportMenu entity="receipts" />} />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="N° de reçu ou locataire…"
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        columns={[
          { key: "num", header: "Reçu", cell: (r) => <div><p className="font-semibold">{r.number}</p><p className="text-xs text-muted-foreground">{formatDate(r.issuedAt)}</p></div> },
          { key: "tenant", header: "Locataire", cell: (r) => <div><p>{r.payment.lease.tenant.firstName} {r.payment.lease.tenant.lastName}</p><p className="text-xs text-muted-foreground">{r.payment.lease.residence.name}</p></div> },
          { key: "type", header: "Objet", cell: (r) => <PaymentTypeBadge type={r.payment.type} />, hideOnMobile: true },
          { key: "amount", header: "Montant", cell: (r) => <span className="font-semibold tabular-nums">{formatMoney(r.amount)}</span> },
          { key: "mail", header: "Email", cell: (r) => (r.emailedAt ? <span className="text-xs text-success">Envoyé {formatDate(r.emailedAt)}</span> : <span className="text-xs text-muted-foreground">—</span>), hideOnMobile: true },
          {
            key: "actions", header: "", className: "text-right", cell: (r) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => window.open(`/api/receipts/${r.id}/pdf`, "_blank")} aria-label="Imprimer"><Printer /></Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => (window.location.href = `/api/receipts/${r.id}/pdf?download=1`)} aria-label="Télécharger"><Download /></Button>
                <Button variant="ghost" size="icon" className="size-8" disabled={!r.payment.lease.tenant.email || email.isPending} onClick={() => email.mutate(r.id)} aria-label="Envoyer par email"><Mail /></Button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
