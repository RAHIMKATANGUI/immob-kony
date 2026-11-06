import { AUDIT_ACTIONS } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

export type AuditEntry = {
  id: string;
  action: keyof typeof AUDIT_ACTIONS;
  createdAt: string;
  userEmail: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  user?: { firstName: string; lastName: string } | null;
};

const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "∅" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** Historique (audit) : qui, quand, ancienne → nouvelle valeur. */
export function HistoryTimeline({ entries }: { entries: AuditEntry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">Aucun historique.</p>;
  return (
    <ol className="relative space-y-5 border-l pl-5">
      {entries.map((e) => {
        const changes = e.action === "UPDATE" && e.newValue ? Object.keys(e.newValue).filter((k) => k !== "updatedById") : [];
        return (
          <li key={e.id} className="relative">
            <span className="absolute -left-[26px] top-1 size-3 rounded-full border-2 border-card bg-brand ring-2 ring-brand/20" />
            <p className="text-sm">
              <span className="font-medium">{AUDIT_ACTIONS[e.action]}</span>{" "}
              <span className="text-muted-foreground">par {e.user ? `${e.user.firstName} ${e.user.lastName}` : e.userEmail ?? "système"}</span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDate(e.createdAt, { hour: "2-digit", minute: "2-digit", timeZone: undefined })}</p>
            {changes.length > 0 && (
              <div className="mt-2 space-y-1 rounded-xl bg-muted/50 p-2.5 text-xs">
                {changes.map((k) => (
                  <p key={k} className="break-all">
                    <span className="font-medium">{k}</span> : <span className="text-destructive line-through">{fmt(e.oldValue?.[k])}</span> → <span className="text-success">{fmt(e.newValue?.[k])}</span>
                  </p>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
