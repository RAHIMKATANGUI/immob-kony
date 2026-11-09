"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api-client";
import { onError } from "@/hooks/use-resource";
import { cn, formatMoney } from "@/lib/utils";

type Line = { label: string; amount: string };
export type RefundableDeposit = { id: string; amount: string; amountPaid: string };

/**
 * Restitution de la caution à la sortie : on liste les dégâts constatés (état des lieux),
 * leur coût est retenu sur la caution versée et le reliquat est rendu au locataire.
 */
export function DepositRefundDialog({ open, onOpenChange, deposit, title }: { open: boolean; onOpenChange: (o: boolean) => void; deposit: RefundableDeposit | null; title?: string }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<Line[]>([]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setDate(new Date().toISOString().slice(0, 10));
      setLines([]);
      setNotes("");
    }
  }, [open]);

  const paid = Number(deposit?.amountPaid ?? 0);
  const valid = lines.filter((l) => l.label.trim() && Number(l.amount) > 0);
  const deducted = valid.reduce((s, l) => s + Number(l.amount), 0);
  const refunded = Math.max(0, paid - deducted);
  const owed = Math.max(0, deducted - paid);
  const incomplete = lines.some((l) => (l.label.trim() || l.amount) && !(l.label.trim() && Number(l.amount) > 0));

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`/api/deposits/${deposit!.id}/refund`, {
        date,
        deductions: valid.map((l) => ({ label: l.label.trim(), amount: Number(l.amount) })),
        notes,
      }),
    onSuccess: () => {
      toast.success(owed > 0 ? `Caution soldée — le locataire doit encore ${formatMoney(owed)}` : `Caution restituée : ${formatMoney(refunded)} rendus au locataire`);
      ["deposits", "leases", "tenants", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onOpenChange(false);
    },
    onError,
  });

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Restituer la caution{title ? ` — ${title}` : ""}</DialogTitle>
          <DialogDescription>Indiquez les dégâts constatés à la sortie. Leur coût est retenu sur la caution et le reliquat est rendu au locataire.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <FormField label="Date de restitution" required>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </FormField>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Dégâts / retenues</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setLines((ls) => [...ls, { label: "", amount: "" }])}>
                <Plus /> Ajouter un dégât
              </Button>
            </div>
            {lines.length === 0 ? (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">Aucun dégât : la caution versée sera rendue en totalité.</p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Input className="flex-1" placeholder="Ex. vitre cassée, peinture, serrure…" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} />
                    <Input className="w-32" type="number" min={0} step="500" placeholder="Coût" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} />
                    <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label="Supprimer la ligne" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <dl className="space-y-2 rounded-xl border p-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Caution versée</dt><dd className="font-semibold tabular-nums">{formatMoney(paid)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Total des réparations retenues</dt><dd className={cn("font-semibold tabular-nums", deducted > 0 && "text-destructive")}>− {formatMoney(deducted)}</dd></div>
            <div className="flex justify-between border-t pt-2"><dt className="font-medium">Montant à rendre au locataire</dt><dd className="font-display text-lg font-bold tabular-nums text-success">{formatMoney(refunded)}</dd></div>
            {owed > 0 && (
              <div className="flex justify-between rounded-lg bg-destructive/10 px-2 py-1.5 text-destructive"><dt className="font-medium">Reste dû par le locataire</dt><dd className="font-bold tabular-nums">{formatMoney(owed)}</dd></div>
            )}
          </dl>

          <FormField label="Notes (état des lieux, observations)">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          {incomplete && <p className="text-sm text-destructive">Chaque dégât doit avoir un motif et un coût.</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button variant="brand" disabled={!deposit || incomplete} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Valider la restitution
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
