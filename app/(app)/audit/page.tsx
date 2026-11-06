"use client";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useList } from "@/hooks/use-resource";
import { useDebounce } from "@/hooks/use-debounce";
import { formatDate } from "@/lib/utils";
import { AUDIT_ACTIONS, ENTITY_LABELS } from "@/lib/labels";

type Row = { id: string; action: keyof typeof AUDIT_ACTIONS; entity: string; entityId: string | null; userEmail: string | null; ip: string | null; createdAt: string; oldValue: Record<string, unknown> | null; newValue: Record<string, unknown> | null; user: { firstName: string; lastName: string } | null };
const tone = { CREATE: "success", UPDATE: "info", DELETE: "danger", LOGIN: "muted", LOGOUT: "muted", EXPORT: "default", PAYMENT: "warning" } as const;

export default function AuditPage() {
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Row | null>(null);
  const dq = useDebounce(q);
  const { data, isLoading } = useList<Row>("audit", { q: dq, entity, action, page, pageSize: 30 });

  return (
    <>
      <PageHeader title="Journal d'audit" description="Qui a créé, qui a modifié, quand, ancienne et nouvelle valeur" />
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        search={q}
        onSearch={(v) => { setQ(v); setPage(1); }}
        searchPlaceholder="Utilisateur, identifiant…"
        toolbar={
          <>
            <NativeSelect value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }} className="h-9 w-40">
              <option value="">Toutes entités</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
            <NativeSelect value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="h-9 w-40">
              <option value="">Toutes actions</option>
              {Object.entries(AUDIT_ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        onRowClick={setSel}
        columns={[
          { key: "date", header: "Quand", cell: (r) => <span className="whitespace-nowrap text-xs">{formatDate(r.createdAt, { hour: "2-digit", minute: "2-digit", timeZone: undefined })}</span> },
          { key: "who", header: "Qui", cell: (r) => <div><p className="text-sm">{r.user ? `${r.user.firstName} ${r.user.lastName}` : "Système"}</p><p className="text-xs text-muted-foreground">{r.userEmail}</p></div> },
          { key: "action", header: "Action", cell: (r) => <Badge variant={tone[r.action]}>{AUDIT_ACTIONS[r.action]}</Badge> },
          { key: "entity", header: "Entité", cell: (r) => ENTITY_LABELS[r.entity] ?? r.entity },
          { key: "id", header: "Identifiant", cell: (r) => <code className="text-xs text-muted-foreground">{r.entityId?.slice(0, 12) ?? "—"}</code>, hideOnMobile: true },
          { key: "ip", header: "IP", cell: (r) => <span className="text-xs text-muted-foreground">{r.ip ?? "—"}</span>, hideOnMobile: true },
        ]}
      />
      <Dialog open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{sel && `${AUDIT_ACTIONS[sel.action]} · ${ENTITY_LABELS[sel.entity] ?? sel.entity}`}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["oldValue", "newValue"] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{k === "oldValue" ? "Ancienne valeur" : "Nouvelle valeur"}</p>
                <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3 text-[11px] leading-relaxed">{sel?.[k] ? JSON.stringify(sel[k], null, 2) : "—"}</pre>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
