"use client";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { CheckCircle2, Download, Printer, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { paymentSchema } from "@/lib/validations";
import { apiGet, apiPost, type Paged } from "@/lib/api-client";
import { onError } from "@/hooks/use-resource";
import { formatDate, formatMoney, formatMonth } from "@/lib/utils";
import { PAYMENT_METHODS } from "@/lib/labels";

type In = z.input<typeof paymentSchema>;
type Out = z.output<typeof paymentSchema>;
type LeaseOpt = { id: string; reference: string; monthlyRent: string; charges: string; tenant: { firstName: string; lastName: string }; residence: { name: string }; apartment: { number: string } | null; deposit: { amount: string; amountPaid: string } | null };
type Balance = { monthlyTotal: number; arrears: number; creditBalance: number; nextDueDate: string | null; nextDueAmount: number; paidUntil: string | null };
type Result = { receipt: { id: string; number: string }; monthsCovered: number; creditBalance: number };

/** Encaissement : loyer (avec gestion automatique des avances) ou caution → reçu PDF immédiat. */
export function PaymentDialog({ open, onOpenChange, leaseId, defaultType = "RENT" }: { open: boolean; onOpenChange: (o: boolean) => void; leaseId?: string; defaultType?: "RENT" | "DEPOSIT" }) {
  const qc = useQueryClient();
  const [result, setResult] = useState<Result | null>(null);
  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<In, unknown, Out>({ resolver: zodResolver(paymentSchema) });
  const [selLease, type, amount] = useWatch({ control, name: ["leaseId", "type", "amount"] });

  const leases = useQuery({ queryKey: ["leases", "active-options"], queryFn: () => apiGet<Paged<LeaseOpt>>("/api/leases?status=ACTIVE&pageSize=200"), enabled: open });
  const detail = useQuery({ queryKey: ["leases", selLease], queryFn: () => apiGet<{ balance: Balance; lease: LeaseOpt }>(`/api/leases/${selLease}`), enabled: open && !!selLease });

  useEffect(() => {
    if (open) {
      setResult(null);
      reset({ leaseId: leaseId ?? "", type: defaultType, amount: 0, method: "MOBILE_MONEY", paidAt: new Date().toISOString().slice(0, 10), reference: "", notes: "", sendEmail: true });
    }
  }, [open, leaseId, defaultType, reset]);

  // l'option du bail n'existe qu'après chargement : on ré-applique la valeur
  useEffect(() => {
    if (open && leaseId && leases.data) setValue("leaseId", leaseId);
  }, [open, leaseId, leases.data, setValue]);

  const b = detail.data?.balance;
  const dep = detail.data?.lease.deposit;
  const depositDue = dep ? Number(dep.amount) - Number(dep.amountPaid) : 0;
  const preview = useMemo(() => {
    const a = Number(amount) || 0;
    if (!b || type !== "RENT" || a <= 0) return null;
    // mois couverts au-delà des arriérés (le solde disponible s'ajoute)
    return { months: Math.floor((a - b.arrears + b.creditBalance) / b.monthlyTotal) };
  }, [amount, b, type]);

  const mutation = useMutation({
    mutationFn: (data: Out) => apiPost<Result>("/api/payments", data),
    onSuccess: (r) => {
      setResult(r);
      toast.success(`Paiement enregistré — reçu ${r.receipt.number}`);
      ["payments", "leases", "tenants", "rents", "deposits", "receipts", "dashboard", "notifications"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {result ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 className="size-14 text-success" />
            <h2 className="mt-3 font-display text-xl font-bold">Paiement enregistré</h2>
            <p className="mt-1 text-sm text-muted-foreground">Reçu n° <span className="font-semibold text-foreground">{result.receipt.number}</span> généré avec QR code.</p>
            {result.monthsCovered > 0 && <p className="mt-3 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground"><Sparkles className="mr-1 inline size-4" />Paiement anticipé : {result.monthsCovered} mois couverts d&apos;avance.</p>}
            {result.creditBalance > 0 && <p className="mt-2 text-sm text-muted-foreground">Solde disponible : {formatMoney(result.creditBalance)}</p>}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => window.open(`/api/receipts/${result.receipt.id}/pdf`, "_blank")}><Printer /> Imprimer</Button>
              <Button variant="outline" onClick={() => (window.location.href = `/api/receipts/${result.receipt.id}/pdf?download=1`)}><Download /> PDF</Button>
              <Button onClick={() => onOpenChange(false)}>Terminer</Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
              <DialogDescription>Un reçu PDF numéroté avec QR code sera généré automatiquement.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="grid gap-4 sm:grid-cols-2" noValidate>
              <FormField label="Bail" required error={errors.leaseId?.message} className="sm:col-span-2">
                <NativeSelect {...register("leaseId")} className={leaseId ? "pointer-events-none bg-muted/60" : undefined} tabIndex={leaseId ? -1 : undefined} aria-readonly={!!leaseId}>
                  <option value="">Sélectionner un bail actif…</option>
                  {leases.data?.items.map((l) => <option key={l.id} value={l.id}>{l.tenant.firstName} {l.tenant.lastName} — {l.residence.name}{l.apartment ? ` · ${l.apartment.number}` : ""} ({l.reference})</option>)}
                </NativeSelect>
              </FormField>
              {b && (
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-3 text-sm sm:col-span-2 sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">Mensualité</p><p className="font-semibold">{formatMoney(b.monthlyTotal)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Arriéré</p><p className={b.arrears > 0 ? "font-semibold text-destructive" : "font-semibold"}>{formatMoney(b.arrears)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Solde dispo.</p><p className="font-semibold">{formatMoney(b.creditBalance)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Prochaine échéance</p><p className="font-semibold">{b.nextDueDate ? formatDate(b.nextDueDate) : "—"}</p></div>
                </div>
              )}
              <FormField label="Nature">
                <NativeSelect {...register("type")}>
                  <option value="RENT">Loyer (avance gérée automatiquement)</option>
                  <option value="DEPOSIT">Caution</option>
                </NativeSelect>
              </FormField>
              <FormField label="Montant" required error={errors.amount?.message} hint={type === "DEPOSIT" && dep ? `Restant caution : ${formatMoney(depositDue)}` : undefined}>
                <Input type="number" step="500" {...register("amount")} />
              </FormField>
              {b && (
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  {type === "RENT" ? (
                    <>
                      {b.arrears > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setValue("amount", b.arrears)}>Arriéré · {formatMoney(b.arrears)}</Button>}
                      {[1, 3, 6, 12].map((m) => <Button key={m} type="button" size="sm" variant="secondary" onClick={() => setValue("amount", b.arrears + b.monthlyTotal * m - b.creditBalance)}>{m} mois</Button>)}
                    </>
                  ) : depositDue > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setValue("amount", depositDue)}>Solder la caution</Button>}
                </div>
              )}
              {preview && preview.months > 1 && (
                <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground sm:col-span-2"><Sparkles className="mr-1 inline size-4" />Ce montant couvre environ {preview.months} mois{b?.paidUntil ? ` (payé jusqu'à ${formatMonth(b.paidUntil)} actuellement)` : ""}.</p>
              )}
              <FormField label="Mode de paiement">
                <NativeSelect {...register("method")}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect>
              </FormField>
              <FormField label="Date du paiement" required error={errors.paidAt?.message}><Input type="date" {...register("paidAt")} /></FormField>
              <FormField label="Référence (transaction, chèque…)" className="sm:col-span-2"><Input {...register("reference")} /></FormField>
              <FormField label="Notes" className="sm:col-span-2"><Textarea rows={2} {...register("notes")} /></FormField>
              <label className="flex items-center gap-3 text-sm sm:col-span-2">
                <Switch defaultChecked onCheckedChange={(v) => setValue("sendEmail", v)} /> Envoyer le reçu par email au locataire
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
                <Button type="submit" variant="brand" loading={mutation.isPending}>Encaisser</Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
