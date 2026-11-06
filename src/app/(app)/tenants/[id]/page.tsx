"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Baby, Briefcase, CalendarCheck, FileDown, FileSignature, HandCoins, IdCard, Mail, Pencil, Phone, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Info, Section } from "@/components/shared/info";
import { DepositStatusBadge, LeaseStatusBadge, PaymentTypeBadge, RentStatusBadge } from "@/components/shared/status-badges";
import { HistoryTimeline, type AuditEntry } from "@/components/shared/history-timeline";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PaymentDialog } from "@/components/forms/payment-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCrud, useItem } from "@/hooks/use-resource";
import { formatDate, formatMoney, formatMonth, initials } from "@/lib/utils";
import { ID_TYPES, PAYMENT_METHODS, type DEPOSIT_STATUS, type LEASE_STATUS, type PAYMENT_TYPES, type RENT_STATUS } from "@/lib/labels";

type Data = {
  tenant: {
    id: string; code: string; firstName: string; lastName: string; phone: string; email: string | null; profession: string | null; photoUrl: string | null; idType: keyof typeof ID_TYPES; idNumber: string; idDocumentUrl: string | null;
    entryDate: string; exitDate: string | null; adults: number; children: number; totalOccupants: number;
    residence: { id: string; name: string; commune: string; owner: { firstName: string; lastName: string } }; apartment: { id: string; number: string; floor: number } | null;
    leases: {
      id: string; reference: string; status: keyof typeof LEASE_STATUS; startDate: string; endDate: string; monthlyRent: string; charges: string; apartment: { number: string } | null;
      deposit: { id: string; amount: string; amountPaid: string; status: keyof typeof DEPOSIT_STATUS } | null;
      rents: { id: string; period: string; dueDate: string; amount: string; amountPaid: string; status: keyof typeof RENT_STATUS }[];
      payments: { id: string; paidAt: string; amount: string; type: keyof typeof PAYMENT_TYPES; method: keyof typeof PAYMENT_METHODS; receipt: { id: string; number: string } | null }[];
    }[];
  };
  balance: { monthlyTotal: number; arrears: number; creditBalance: number; nextDueDate: string | null; nextDueAmount: number; paidUntil: string | null; totalPaid: number } | null;
  history: AuditEntry[];
};

export default function TenantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data } = useItem<Data>("tenants", id);
  const { remove } = useCrud("tenants");
  const [pay, setPay] = useState(false);
  const [del, setDel] = useState(false);
  if (!data) return <Skeleton className="h-[480px] rounded-2xl" />;
  const { tenant: t, balance } = data;
  const lease = t.leases.find((l) => l.status === "ACTIVE");
  const payments = t.leases.flatMap((l) => l.payments.map((p) => ({ ...p, ref: l.reference }))).sort((a, b) => +new Date(b.paidAt) - +new Date(a.paidAt));

  return (
    <>
      <PageHeader
        back={{ href: "/tenants", label: "Locataires" }}
        title="Fiche locataire"
        actions={
          <>
            <Button variant="outline" onClick={() => window.open(`/api/tenants/${t.id}/pdf`, "_blank")}><FileDown /> Fiche PDF</Button>
            <Button variant="outline" asChild><Link href={`/tenants/${t.id}/edit`}><Pencil /> Modifier</Link></Button>
            <Button variant="outline" size="icon" onClick={() => setDel(true)} aria-label="Supprimer"><Trash2 /></Button>
            {lease ? <Button variant="brand" onClick={() => setPay(true)}><HandCoins /> Encaisser</Button> : !t.exitDate && <Button asChild><Link href={`/leases/new?tenantId=${t.id}&residenceId=${t.residence.id}${t.apartment ? `&apartmentId=${t.apartment.id}` : ""}`}><FileSignature /> Créer le bail</Link></Button>}
          </>
        }
      />
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="relative mb-4 overflow-hidden rounded-2xl border bg-card shadow-soft">
        <div className="h-24 bg-gradient-to-r from-night-900 via-night-800 to-turquoise-600/70" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
          <Avatar className="-mt-12 size-24 border-4 border-card shadow-lg">
            {t.photoUrl && <AvatarImage src={t.photoUrl} alt="" />}
            <AvatarFallback className="text-2xl">{initials(t.firstName, t.lastName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-2xl font-bold">{t.firstName} {t.lastName}</h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{t.code}</span>
              {t.profession && <span className="flex items-center gap-1"><Briefcase className="size-3.5" />{t.profession}</span>}
              <a href={`tel:${t.phone}`} className="flex items-center gap-1 hover:text-brand"><Phone className="size-3.5" />{t.phone}</a>
              {t.email && <a href={`mailto:${t.email}`} className="flex items-center gap-1 hover:text-brand"><Mail className="size-3.5" />{t.email}</a>}
            </p>
          </div>
          {lease && <LeaseStatusBadge status={lease.status} />}
        </div>
      </motion.div>

      {balance && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { l: "Mensualité", v: formatMoney(balance.monthlyTotal) },
            { l: "Arriéré", v: formatMoney(balance.arrears), danger: balance.arrears > 0 },
            { l: "Solde disponible", v: formatMoney(balance.creditBalance) },
            { l: "Payé jusqu'à", v: balance.paidUntil ? formatMonth(balance.paidUntil) : "—" },
            { l: "Prochaine échéance", v: balance.nextDueDate ? `${formatDate(balance.nextDueDate)} · ${formatMoney(balance.nextDueAmount)}` : "—" },
          ].map((k) => (
            <div key={k.l} className="rounded-2xl border bg-card p-4 shadow-soft">
              <p className="text-xs text-muted-foreground">{k.l}</p>
              <p className={`mt-1 font-display text-lg font-bold ${k.danger ? "text-destructive" : ""}`}>{k.v}</p>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="payments">Paiements ({payments.length})</TabsTrigger>
          <TabsTrigger value="rents">Échéancier</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="grid gap-4 lg:grid-cols-3">
          <Section title="Logement occupé" className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-3">
              <Info label="Résidence"><Link href={`/residences/${t.residence.id}`} className="hover:text-brand">{t.residence.name}</Link></Info>
              <Info label="Appartement">{t.apartment ? <Link href={`/apartments/${t.apartment.id}`} className="hover:text-brand">N° {t.apartment.number} (étage {t.apartment.floor})</Link> : "Rattaché à la résidence"}</Info>
              <Info label="Propriétaire">{t.residence.owner.firstName} {t.residence.owner.lastName}</Info>
              <Info label="Date d'entrée"><span className="flex items-center gap-1"><CalendarCheck className="size-3.5" />{formatDate(t.entryDate, { month: "long" })}</span></Info>
              <Info label="Date de sortie">{t.exitDate ? formatDate(t.exitDate, { month: "long" }) : "En cours"}</Info>
              <Info label="Pièce d'identité"><span className="flex items-center gap-1"><IdCard className="size-3.5" />{ID_TYPES[t.idType]} {t.idNumber}</span>{t.idDocumentUrl && <a href={t.idDocumentUrl} target="_blank" className="ml-1 text-xs text-brand hover:underline">voir</a>}</Info>
              <Info label="Adultes"><span className="flex items-center gap-1"><Users className="size-3.5" />{t.adults}</span></Info>
              <Info label="Enfants"><span className="flex items-center gap-1"><Baby className="size-3.5" />{t.children}</span></Info>
              <Info label="Total occupants">{t.totalOccupants}</Info>
            </div>
          </Section>
          <Section title="Bail & caution">
            {t.leases.map((l) => (
              <Link key={l.id} href={`/leases/${l.id}`} className="mb-2 block rounded-xl border p-3 transition hover:bg-muted/40">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">{l.reference}</span><LeaseStatusBadge status={l.status} /></div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(l.startDate)} → {formatDate(l.endDate)} · {formatMoney(Number(l.monthlyRent) + Number(l.charges))}/mois</p>
                {l.deposit && Number(l.deposit.amount) > 0 && (
                  <div className="mt-2 flex items-center justify-between text-xs"><span>Caution {formatMoney(l.deposit.amountPaid)} / {formatMoney(l.deposit.amount)}</span><DepositStatusBadge status={l.deposit.status} /></div>
                )}
              </Link>
            ))}
            {!t.leases.length && <p className="text-sm text-muted-foreground">Aucun bail.</p>}
          </Section>
        </TabsContent>
        <TabsContent value="payments">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reçu</TableHead><TableHead className="hidden md:table-cell">Nature</TableHead><TableHead className="hidden md:table-cell">Mode</TableHead><TableHead className="text-right">Montant</TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.map((p) => (
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
            {!payments.length && <p className="p-8 text-center text-sm text-muted-foreground">Aucun paiement.</p>}
          </div>
        </TabsContent>
        <TabsContent value="rents">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <Table>
              <TableHeader><TableRow><TableHead>Période</TableHead><TableHead className="hidden sm:table-cell">Échéance</TableHead><TableHead>Montant</TableHead><TableHead className="hidden sm:table-cell">Payé</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
              <TableBody>
                {(lease ?? t.leases[0])?.rents.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{formatMonth(r.period)}</TableCell>
                    <TableCell className="hidden sm:table-cell">{formatDate(r.dueDate)}</TableCell>
                    <TableCell className="tabular-nums">{formatMoney(r.amount)}</TableCell>
                    <TableCell className="hidden tabular-nums sm:table-cell">{formatMoney(r.amountPaid)}</TableCell>
                    <TableCell><RentStatusBadge status={r.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="history"><Section title="Historique des modifications"><HistoryTimeline entries={data.history} /></Section></TabsContent>
      </Tabs>
      <PaymentDialog open={pay} onOpenChange={setPay} leaseId={lease?.id} />
      <ConfirmDialog open={del} onOpenChange={setDel} title="Supprimer ce locataire ?" description="Le locataire sera archivé (impossible si un bail est actif)." loading={remove.isPending} onConfirm={() => remove.mutate(t.id, { onSuccess: () => router.push("/tenants") })} />
    </>
  );
}
