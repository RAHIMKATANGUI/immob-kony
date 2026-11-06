"use client";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRing, Mail, MessageSquare, Play } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { NotificationStatusBadge } from "@/components/shared/status-badges";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { useList, onError } from "@/hooks/use-resource";
import { apiPost } from "@/lib/api-client";
import { cn, formatDate } from "@/lib/utils";
import { NOTIFICATION_STATUS, type NOTIFICATION_CHANNELS } from "@/lib/labels";

type Row = { id: string; title: string; channel: keyof typeof NOTIFICATION_CHANNELS; status: keyof typeof NOTIFICATION_STATUS; offsetDays: number; recipient: string | null; createdAt: string; error: string | null; tenant: { firstName: string; lastName: string } | null; lease: { reference: string } | null };
const SCHEDULE = [-7, -3, -1, 1, 7, 15];

export default function RemindersPage() {
  const qc = useQueryClient();
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useList<Row>("reminders", { channel, status, page });
  const run = useMutation({
    mutationFn: () => apiPost<{ checked: number; created: number; sent: number; failed: number }>("/api/reminders"),
    onSuccess: (r) => { toast.success(`Relances : ${r.sent} envoyée(s), ${r.failed} échec(s) — ${r.checked} échéance(s) analysée(s)`); qc.invalidateQueries({ queryKey: ["reminders"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError,
  });
  const stats = (data?.stats ?? {}) as Record<string, number>;

  return (
    <>
      <PageHeader title="Relances automatiques" description="Rappels avant échéance et relances d'impayés par email et SMS" actions={<Button variant="brand" loading={run.isPending} onClick={() => run.mutate()}><Play /> Lancer maintenant</Button>} />
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-card p-5 shadow-soft lg:col-span-2">
          <p className="text-sm font-semibold">Calendrier des relances</p>
          <p className="text-xs text-muted-foreground">Exécuté chaque jour par la tâche planifiée (Render Cron Job)</p>
          <div className="mt-5 flex items-center">
            {SCHEDULE.map((d, i) => (
              <div key={d} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <span className={cn("flex size-11 items-center justify-center rounded-full text-xs font-bold", d < 0 ? "bg-accent text-accent-foreground" : "bg-destructive/10 text-destructive")}>{d < 0 ? `J${d}` : `J+${d}`}</span>
                  <span className="text-[10px] text-muted-foreground">{d < 0 ? "Rappel" : "Relance"}</span>
                </div>
                {i < SCHEDULE.length - 1 && <span className={cn("mx-1 mb-4 h-0.5 flex-1", i === 2 ? "bg-gradient-to-r from-brand to-destructive" : d < 0 ? "bg-brand/40" : "bg-destructive/30")} />}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge variant="info"><Mail className="size-3" /> Email (Resend)</Badge>
            <Badge variant="muted"><MessageSquare className="size-3" /> SMS (passerelle prête : Twilio / HTTP)</Badge>
            <Badge variant="default"><BellRing className="size-3" /> Notification interne au gestionnaire</Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(NOTIFICATION_STATUS).map(([k, v]) => (
            <div key={k} className="rounded-2xl border bg-card p-4 shadow-soft"><p className="text-xs text-muted-foreground">{v}</p><p className="mt-1 font-display text-2xl font-bold">{stats[k] ?? 0}</p></div>
          ))}
        </div>
      </div>
      <DataTable
        rows={data?.items}
        loading={isLoading}
        rowKey={(r) => r.id}
        toolbar={
          <>
            <NativeSelect value={channel} onChange={(e) => { setChannel(e.target.value); setPage(1); }} className="h-9 w-36">
              <option value="">Email + SMS</option><option value="EMAIL">Email</option><option value="SMS">SMS</option>
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 w-36">
              <option value="">Tous statuts</option>
              {Object.entries(NOTIFICATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </NativeSelect>
          </>
        }
        page={data?.page}
        pages={data?.pages}
        total={data?.total}
        onPage={setPage}
        empty="Aucune relance envoyée pour le moment"
        columns={[
          { key: "date", header: "Date", cell: (r) => formatDate(r.createdAt) },
          { key: "offset", header: "Étape", cell: (r) => <Badge variant={r.offsetDays < 0 ? "info" : "danger"}>{r.offsetDays < 0 ? `J${r.offsetDays}` : `J+${r.offsetDays}`}</Badge> },
          { key: "tenant", header: "Locataire", cell: (r) => <div><p>{r.tenant ? `${r.tenant.firstName} ${r.tenant.lastName}` : "—"}</p><p className="text-xs text-muted-foreground">{r.lease?.reference}</p></div> },
          { key: "channel", header: "Canal", cell: (r) => (r.channel === "EMAIL" ? <span className="flex items-center gap-1"><Mail className="size-3.5" />Email</span> : <span className="flex items-center gap-1"><MessageSquare className="size-3.5" />SMS</span>), hideOnMobile: true },
          { key: "to", header: "Destinataire", cell: (r) => <span className="text-xs">{r.recipient ?? "—"}</span>, hideOnMobile: true },
          { key: "title", header: "Objet", cell: (r) => <span className="line-clamp-1 text-xs" title={r.error ?? r.title}>{r.title}</span>, hideOnMobile: true },
          { key: "status", header: "Statut", cell: (r) => <NotificationStatusBadge status={r.status} /> },
        ]}
      />
    </>
  );
}
