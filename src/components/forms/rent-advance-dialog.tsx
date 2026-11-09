"use client";
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiPost } from "@/lib/api-client";
import { onError } from "@/hooks/use-resource";
import { formatMoney } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/labels";

type Result = { receipt: { id: string; number: string } };

/**
 * Avance sur loyer : montant libre versé par le locataire, déduit automatiquement
 * chaque mois du loyer dû (montant fixe choisi) jusqu'à épuisement.
 */
export function RentAdvanceDialog({ open, onOpenChange, leaseId, monthlyTotal, currentMonthly }: { open: boolean; onOpenChange: (o: boolean) => void; leaseId: string; monthlyTotal: number; currentMonthly?: number }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ amount: "", monthlyDeduction: "", method: "CASH", paidAt: "", reference: "", notes: "" });
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setForm({ amount: "", monthlyDeduction: String(currentMonthly && currentMonthly > 0 ? currentMonthly : monthlyTotal || ""), method: "CASH", paidAt: new Date().toISOString().slice(0, 10), reference: "", notes: "" });
    }
  }, [open, currentMonthly, monthlyTotal]);

  const amount = Number(form.amount) || 0;
  const per = Number(form.monthlyDeduction) || 0;
  const months = per > 0 ? Math.ceil(amount / per) : 0;
  const tenantPays = Math.max(0, monthlyTotal - per);

  const mutation = useMutation({
    mutationFn: () => apiPost<Result>(`/api/leases/${leaseId}/advance`, { ...form, amount, monthlyDeduction: per }),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Avance enregistrée — reçu ${r.receipt.number}`);
      ["payments", "leases", "tenants", "rents", "receipts", "dashboard"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError,
  });

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {result ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="size-14 text-success" />
            <h2 className="mt-3 font-display text-xl font-bold">Avance enregistrée</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reçu n° <span className="font-semibold text-foreground">{result.receipt.number}</span></p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => window.open(`/api/receipts/${result.receipt.id}/pdf`, "_blank")}><Printer /> Imprimer le reçu</Button>
              <Button onClick={() => onOpenChange(false)}>Terminer</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Avance sur loyer</DialogTitle>
              <DialogDescription>Le montant de l&apos;avance est déduit automatiquement du loyer, chaque mois, jusqu&apos;à épuisement.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Montant de l'avance" required><Input type="number" min={0} step="1000" value={form.amount} onChange={set("amount")} autoFocus /></FormField>
              <FormField label="Déduction par mois" required hint={`Loyer mensuel : ${formatMoney(monthlyTotal)}`}><Input type="number" min={0} step="1000" value={form.monthlyDeduction} onChange={set("monthlyDeduction")} /></FormField>
              <FormField label="Mode de paiement">
                <NativeSelect value={form.method} onChange={set("method")}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
              </FormField>
              <FormField label="Date du versement" required><Input type="date" value={form.paidAt} onChange={set("paidAt")} /></FormField>
              <FormField label="Référence (transaction, chèque…)" className="sm:col-span-2"><Input value={form.reference} onChange={set("reference")} /></FormField>
              {amount > 0 && per > 0 && (
                <dl className="space-y-1.5 rounded-xl bg-accent p-3 text-sm text-accent-foreground sm:col-span-2">
                  <div className="flex justify-between"><dt>Déduit du loyer chaque mois</dt><dd className="font-semibold tabular-nums">{formatMoney(Math.min(per, monthlyTotal))}</dd></div>
                  <div className="flex justify-between"><dt>Le locataire paie chaque mois</dt><dd className="font-semibold tabular-nums">{formatMoney(tenantPays)}</dd></div>
                  <div className="flex justify-between"><dt>Durée de l&apos;avance</dt><dd className="font-semibold">{months} mois</dd></div>
                </dl>
              )}
              <FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} value={form.notes} onChange={set("notes")} /></FormField>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button variant="brand" disabled={amount <= 0 || per <= 0 || !form.paidAt} loading={mutation.isPending} onClick={() => mutation.mutate()}>Encaisser l&apos;avance</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
