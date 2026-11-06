"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlarmClock, ArrowUpRight, Building2, CalendarRange, CircleDollarSign, DoorOpen, FileText, Gauge, HandCoins, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { OccupancyDonut, PaymentsChart, ResidenceOccupancy, RevenueChart } from "@/components/dashboard/charts";
import { PaymentTypeBadge } from "@/components/shared/status-badges";
import { apiGet } from "@/lib/api-client";
import { formatDate, formatMoney } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import type { DashboardData } from "@/lib/services/dashboard.service";

type D = Omit<DashboardData, "upcoming" | "recentPayments"> & {
  upcoming: (Omit<DashboardData["upcoming"][number], "dueDate"> & { dueDate: string })[];
  recentPayments: (Omit<DashboardData["recentPayments"][number], "paidAt"> & { paidAt: string })[];
};

export function DashboardView() {
  const { name } = useSession();
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<D>("/api/dashboard") });
  const k = data?.kpis;
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date());

  return (
    <>
      <PageHeader
        title={<>{greet}, <span className="text-gradient">{name.split(" ")[0]}</span></>}
        description={`Vue d'ensemble de votre activité — ${month}`}
        actions={
          <>
            <Button variant="outline" asChild><Link href="/rents?status=LATE"><AlarmClock /> Impayés</Link></Button>
            <Button variant="brand" asChild><Link href="/payments?new=1"><HandCoins /> Encaisser un loyer</Link></Button>
          </>
        }
      />

      {isLoading || !k ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[120px] rounded-2xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard index={0} label="Loyers encaissés" value={formatMoney(k.collected)} icon={CircleDollarSign} tone="brand" hint={`${k.collectionRate}% de ${formatMoney(k.expected)} attendus`} />
          <StatCard index={1} label="Loyers impayés (mois)" value={formatMoney(k.unpaid)} icon={FileText} tone="warning" hint="Échéances du mois non soldées" />
          <StatCard index={2} label="Loyers en retard" value={formatMoney(k.late)} icon={AlarmClock} tone="danger" hint={`${k.lateCount} échéance(s) en retard`} />
          <StatCard index={3} label="Taux d'occupation" value={`${k.occupancyRate}%`} icon={Gauge} tone="success" hint={`${k.activeLeases} bail(aux) actif(s)`} />
          <StatCard index={4} label="Résidences" value={k.residences} icon={Building2} />
          <StatCard index={5} label="Appartements" value={k.apartments} icon={DoorOpen} />
          <StatCard index={6} label="Locataires" value={k.tenants} icon={Users} />
          <StatCard index={7} label="Revenus annuels" value={formatMoney(k.annualRevenue)} icon={TrendingUp} hint={`Ce mois : ${formatMoney(k.monthlyRevenue)}`} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Évolution des revenus</CardTitle>
              <CardDescription>Encaissements de loyers sur 12 mois glissants</CardDescription>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground"><CalendarRange className="size-3.5" /> 12 mois</span>
          </CardHeader>
          <CardContent>{data ? <RevenueChart data={data.revenue} /> : <Skeleton className="h-[280px]" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Taux d'occupation</CardTitle>
            <CardDescription>Répartition des logements par statut</CardDescription>
          </CardHeader>
          <CardContent>{data ? <OccupancyDonut data={data.occupancy} rate={data.kpis.occupancyRate} /> : <Skeleton className="h-[260px]" />}</CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Paiements</CardTitle>
            <CardDescription>Statut des échéances (12 mois)</CardDescription>
          </CardHeader>
          <CardContent>{data ? <PaymentsChart data={data.payments} /> : <Skeleton className="h-[220px]" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Occupation par résidence</CardTitle>
            <CardDescription>Logements occupés / total</CardDescription>
          </CardHeader>
          <CardContent>{data ? <ResidenceOccupancy data={data.occupancyByResidence} /> : <Skeleton className="h-[220px]" />}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Prochaines échéances</CardTitle>
              <CardDescription>30 prochains jours</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link href="/rents">Tout voir <ArrowUpRight /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data?.upcoming.map((u) => (
              <Link key={u.id} href={`/leases/${u.leaseId}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-muted/60">
                <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-secondary text-[10px] font-semibold uppercase leading-tight">
                  <span className="text-sm">{new Date(u.dueDate).getUTCDate()}</span>
                  {new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(new Date(u.dueDate)).replace(".", "")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.tenant}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.place}</p>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(u.remaining)}</span>
              </Link>
            ))}
            {data && !data.upcoming.length && <p className="py-6 text-center text-sm text-muted-foreground">Aucune échéance à venir</p>}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Derniers encaissements</CardTitle>
            <CardDescription>Paiements récemment enregistrés</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild><Link href="/payments">Historique <ArrowUpRight /></Link></Button>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {data?.recentPayments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-xl border p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p.tenant}</p>
                <p className="truncate text-xs text-muted-foreground">{p.residence} · {formatDate(p.paidAt)}</p>
                <div className="mt-1.5"><PaymentTypeBadge type={p.type} /></div>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatMoney(p.amount)}</p>
                {p.receiptId && <a href={`/api/receipts/${p.receiptId}/pdf`} target="_blank" className="text-xs text-brand hover:underline">{p.receiptNumber}</a>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
