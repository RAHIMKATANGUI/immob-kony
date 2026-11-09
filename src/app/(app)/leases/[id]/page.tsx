"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, FileDown, HandCoins, Printer, ShieldCheck, PiggyBank, Sparkles, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Info, Section } from "@/components/shared/info";
import { DepositStatusBadge, LeaseStatusBadge, PaymentTypeBadge, RentStatusBadge } from "@/components/shared/status-badges";
import { PaymentDialog } from "@/components/forms/payment-dialog";
import { DepositRefundDialog } from "@/components/forms/deposit-refund-dialog";
import { RentAdvanceDialog } from "@/components/forms/rent-advance-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useItem, onError } from "@/hooks/use-resource";
import { apiPost } from "@/lib/api-client";
import { cn, formatDate, formatMoney, formatMonth } from "@/lib/utils";
import { PAYMENT_METHODS, type DEPOSIT_STATUS, type LEASE_STATUS, type PAYMENT_TYPES, type RENT_STATUS } from "@/lib/labels";

type Data = {
  lease: {
    id: string; reference: string; status: keyof typeof LEASE_STATUS; startDate: string; endDate: string; durationMonths: number; monthlyRent: string; charges: string; dueDay: number; creditBalance: string; signedAt: string | null; terminatedAt: string | null;
    tenant: { id: string; firstName: string; lastName: string; phone: string; email: string | null };
    residence: { id: string; name: string; owner: { firstName: string; lastName: string }; manager: { firstName: string; lastName: string } | null };
    apartment: { id: string; number: string } | null;
    deposit: { id: string; amount: string; amountPaid: string; status: keyof typeof DEPOSIT_STATUS; refundedAmount: string | null; refundedAt: string | null; deductedAmount: string | null; deductions: { label: string; amount: number }[] | null; payments: { id: string; paidAt: string; amount: string; receipt: { id: string; number: string } | null }[] } | null;
    rents: { id: string; period: string; dueDate: string; amount: string; amountPaid: string; status: keyof typeof RENT_STATUS; paidAt: string | null; advanceApplied: string }[];
    payments: { id: string; paidAt: string; amount: string; type: keyof typeof PAYMENT_TYPES; method: keyof typeof PAYMENT_METHODS; reference: string | null; receipt: { id: string; number: string } | null; recordedBy: { firstName: string; lastName: string } | null }[];
    advancePayments: { id: string; monthsCovered: number; amount: string; coveredFrom: string; coveredTo: string; remainingBalance: string; nextDueDate: string; createdAt: string }[];
  };
  balance: { advanceBalance: number; advanceMonthly: number; monthlyTotal: number; totalDue: number; totalPaid: number; arrears: number; creditBalance: number; nextDueDate: string | null; nextDueAmount: number; paidUntil: string | null };
};

export default function LeaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data } = useItem<Data>("leases", id);
  const [pay, setPay] = useState<"RENT" | "DEPOSIT" | null>(null);
  const [term, setTerm] = useState(false);
  const [refund, setRefund] = useState(false);
  const [adv, setAdv] = useState(false);
  const [termForm, setTermForm] = useState({ date: new Date().toISOString().slice(0, 10), reason: "", refundDeposit: "" });
  const terminate = useMutation({
    mutationFn: () => apiPost(`/api/leases/${id}/terminate`, { date: termForm.date, reason: termForm.reason, refundDeposit: termForm.refundDeposit === "" ? undefined : Number(termForm.refundDeposit) }),
    onSuccess: () => { toast.success("Bail résilié — logement libéré"); setTerm(false); qc.invalidateQueries(); },
    onError,
  });
  if (!data) return <Skeleton className="h-[480px] rounded-2xl" />;
  const { lease: l, balance: b } = data;
  const progress = Math.min(100, Math.max(0, ((Date.now() - +new Date(l.startDate)) / (+new Date(l.endDate) - +new Date(l.startDate))) * 100));
  const depositDue = l.deposit ? Number(l.deposit.amount) - Number(l.deposit.amountPaid) : 0;

  return (
    <>
      <PageHeader
        back={{ href: "/leases", label: "Baux" }}
        title={<span className="flex flex-wrap items-center gap-3">{l.reference} <LeaseStatusBadge status={l.status} /></span>}
        description={<><Link href={`/tenants/${l.tenant.id}`} className="font-medium text-foreground hover:text-brand">{l.tenant.firstName} {l.tenant.lastName}</Link> · {l.residence.name}{l.apartment && <> · <Link href={`/apartments/${l.apartment.id}`} className="hover:text-brand">Appt {l.apartment.number}</Link></>}</>}
        actions={
          <>
            <Button variant="outline" onClick={() => window.open(`/api/leases/${l.id}/contract`, "_blank")}><Printer /> Contrat</Button>
            <Button variant="outline" onClick={() => (window.location.href = `/api/leases/${l.id}/contract?download=1`)}><FileDown /> PDF</Button>
            {l.status === "ACTIVE" && <Button variant="outline" onClick={() => setTerm(true)}><Ban /> Résilier</Button>}
            {l.status === "ACTIVE" && <Button variant="outline" onClick={() => setAdv(true)}><PiggyBank /> Avance sur loyer</Button>}
            {l.status === "ACTIVE" && <Button variant="brand" onClick={() => setPay("RENT")}><HandCoins /> Encaisser</Button>}
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Arriéré", v: formatMoney(b.arrears), tone: b.arrears > 0 ? "text-destructive" : "" },
          { l: "Solde disponible", v: formatMoney(b.creditBalance), tone: b.creditBalance > 0 ? "text-brand" : "" },
          { l: "Payé jusqu'à", v: b.paidUntil ? formatMonth(b.paidUntil) : "—", tone: "capitalize" },
          { l: "Prochaine échéance", v: b.nextDueDate ? formatDate(b.nextDueDate) : "—", sub: b.nextDueDate ? formatMoney(b.nextDueAmount) : undefined },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="text-xs text-muted-foreground">{k.l}</p>
            <p className={cn("mt-1 font-display text-xl font-bold", k.tone)}>{k.v}</p>
            {k.sub && <p className="text-xs text-muted-foreground">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Section title="Échéancier des loyers" description={`${l.rents.length} échéance(s) · total réglé ${formatMoney(b.totalPaid)} sur ${formatMoney(b.totalDue)}`}>
            <div className="-mx-5 max-h-[460px] overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Période</TableHead><TableHead className="hidden sm:table-cell">Échéance</TableHead><TableHead>Montant</TableHead><TableHead className="hidden sm:table-cell">Réglé</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...l.rents].reverse().map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="capitalize">{formatMonth(r.period)}</TableCell>
                      <TableCell className="hidden sm:table-cell">{formatDate(r.dueDate)}</TableCell>
                      <TableCell className="tabular-nums">{formatMoney(r.amount)}</TableCell>
                      <TableCell className="hidden tabular-nums sm:table-cell">{formatMoney(r.amountPaid)}{Number(r.advanceApplied) > 0 && <span className="block text-xs text-muted-foreground">dont avance {formatMoney(r.advanceApplied)}</span>}</TableCell>
                      <TableCell><RentStatusBadge status={r.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>
          <Section title="Paiements & reçus">
            <div className="-mx-5">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reçu</TableHead><TableHead className="hidden md:table-cell">Nature</TableHead><TableHead className="hidden md:table-cell">Mode</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
                <TableBody>
                  {l.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paidAt)}</TableCell>
                      <TableCell>{p.receipt ? <a className="font-medium text-brand hover:underline" href={`/api/receipts/${p.receipt.id}/pdf`} target="_blank">{p.receipt.number}</a> : "—"}</TableCell>
                      <TableCell className="hidden md:table-cell"><PaymentTypeBadge type={p.type} /></TableCell>
                      <TableCell className="hidden md:table-cell">{PAYMENT_METHODS[p.method]}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatMoney(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {!l.payments.length && <p className="p-6 text-center text-sm text-muted-foreground">Aucun paiement.</p>}
            </div>
          </Section>
        </div>
        <div className="space-y-4">
          <Section title="Contrat">
            <div className="grid grid-cols-2 gap-4">
              <Info label="Début">{formatDate(l.startDate)}</Info>
              <Info label="Fin">{formatDate(l.endDate)}</Info>
              <Info label="Durée">{l.durationMonths} mois</Info>
              <Info label="Échéance">Le {l.dueDay} du mois</Info>
              <Info label="Loyer">{formatMoney(l.monthlyRent)}</Info>
              <Info label="Charges">{formatMoney(l.charges)}</Info>
              <Info label="Propriétaire">{l.residence.owner.firstName} {l.residence.owner.lastName}</Info>
              <Info label="Gestionnaire">{l.residence.manager ? `${l.residence.manager.firstName} ${l.residence.manager.lastName}` : "—"}</Info>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Avancement du bail</span><span>{Math.round(progress)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-night-400 to-turquoise-400" style={{ width: `${progress}%` }} /></div>
            </div>
          </Section>
          {l.deposit && Number(l.deposit.amount) > 0 && (
            <Section title="Caution" actions={<DepositStatusBadge status={l.deposit.status} />}>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Montant</dt><dd className="font-semibold tabular-nums">{formatMoney(l.deposit.amount)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Versé</dt><dd className="font-semibold tabular-nums">{formatMoney(l.deposit.amountPaid)}</dd></div>
                <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground">Restant à payer</dt><dd className={cn("font-semibold tabular-nums", depositDue > 0 && "text-destructive")}>{formatMoney(depositDue)}</dd></div>
                {l.deposit.deductions && l.deposit.deductions.length > 0 && (
                <div className="border-t pt-2">
                  <dt className="mb-1 text-muted-foreground">Retenues pour dégâts</dt>
                  {l.deposit.deductions.map((x, i) => <dd key={i} className="flex justify-between text-xs"><span>{x.label}</span><span className="tabular-nums text-destructive">− {formatMoney(x.amount)}</span></dd>)}
                </div>
              )}
              {Number(l.deposit.deductedAmount ?? 0) > Number(l.deposit.amountPaid) && <div className="flex justify-between text-destructive"><dt>Reste dû par le locataire</dt><dd className="font-semibold tabular-nums">{formatMoney(Number(l.deposit.deductedAmount) - Number(l.deposit.amountPaid))}</dd></div>}
              {l.deposit.refundedAt && <div className="flex justify-between"><dt className="text-muted-foreground">Rendu au locataire le {formatDate(l.deposit.refundedAt)}</dt><dd className="font-semibold tabular-nums">{formatMoney(l.deposit.refundedAmount)}</dd></div>}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {depositDue > 0 && l.status === "ACTIVE" && <Button size="sm" variant="secondary" onClick={() => setPay("DEPOSIT")}><ShieldCheck /> Verser</Button>}
                {l.deposit.status !== "REFUNDED" && Number(l.deposit.amountPaid) > 0 && <Button size="sm" variant="brand" onClick={() => setRefund(true)}><Undo2 /> Restituer</Button>}
                <Button size="sm" variant="outline" onClick={() => window.open(`/api/deposits/${l.deposit!.id}/pdf`, "_blank")}><FileDown /> Relevé PDF</Button>
              </div>
            </Section>
          )}
          {(b.advanceBalance > 0 || l.payments.some((p) => p.type === "RENT_ADVANCE")) && (
            <Section title="Avance sur loyer">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Avance restante</dt><dd className="font-semibold tabular-nums text-brand">{formatMoney(b.advanceBalance)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Déduite chaque mois</dt><dd className="font-semibold tabular-nums">{formatMoney(b.advanceMonthly)}</dd></div>
                {b.advanceBalance > 0 && b.advanceMonthly > 0 && <div className="flex justify-between border-t pt-2"><dt className="text-muted-foreground">Le locataire paie par mois</dt><dd className="font-semibold tabular-nums">{formatMoney(Math.max(0, b.monthlyTotal - b.advanceMonthly))}</dd></div>}
              </dl>
            </Section>
          )}
          {l.advancePayments.length > 0 && (
            <Section title="Paiements anticipés">
              <ul className="space-y-2">
                {l.advancePayments.map((a) => (
                  <li key={a.id} className="rounded-xl bg-accent p-3 text-sm text-accent-foreground">
                    <p className="flex items-center gap-1.5 font-semibold"><Sparkles className="size-4" />{a.monthsCovered} mois d&apos;avance · {formatMoney(a.amount)}</p>
                    <p className="mt-0.5 text-xs capitalize">{formatMonth(a.coveredFrom)} → {formatMonth(a.coveredTo)} · prochaine échéance {formatDate(a.nextDueDate)}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>

      <PaymentDialog open={!!pay} onOpenChange={(o) => !o && setPay(null)} leaseId={l.id} defaultType={pay ?? "RENT"} />
      <RentAdvanceDialog open={adv} onOpenChange={setAdv} leaseId={l.id} monthlyTotal={b.monthlyTotal} currentMonthly={b.advanceMonthly} />
      {l.deposit && <DepositRefundDialog open={refund} onOpenChange={setRefund} deposit={l.deposit} title={`${l.tenant.firstName} ${l.tenant.lastName}`} />}
      <Dialog open={term} onOpenChange={setTerm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Résilier le bail {l.reference}</DialogTitle>
            <DialogDescription>Les échéances futures non réglées seront supprimées, le locataire sorti et le logement libéré.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField label="Date de fin effective"><Input type="date" value={termForm.date} onChange={(e) => setTermForm({ ...termForm, date: e.target.value })} /></FormField>
            <FormField label="Motif"><Input value={termForm.reason} onChange={(e) => setTermForm({ ...termForm, reason: e.target.value })} placeholder="Départ volontaire, fin de contrat…" /></FormField>
            {l.deposit && Number(l.deposit.amountPaid) > 0 && (
              <FormField label="Caution restituée" hint={`Versée : ${formatMoney(l.deposit.amountPaid)} — laisser vide pour faire ensuite le décompte des dégâts (bouton « Restituer »)`}>
                <Input type="number" value={termForm.refundDeposit} onChange={(e) => setTermForm({ ...termForm, refundDeposit: e.target.value })} />
              </FormField>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerm(false)}>Annuler</Button>
            <Button variant="destructive" loading={terminate.isPending} onClick={() => terminate.mutate()}>Résilier</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
