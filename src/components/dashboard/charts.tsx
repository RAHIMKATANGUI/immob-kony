"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/utils";

const C = {
  brand: "hsl(var(--chart-1))",
  night: "hsl(var(--chart-2))",
  amber: "hsl(var(--chart-3))",
  red: "hsl(var(--chart-4))",
  muted: "hsl(var(--muted-foreground))",
  grid: "hsl(var(--border))",
};

function TooltipBox({ active, payload, label, money }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; payload?: { label?: string } }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-xl">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.payload?.label ?? p.name} : <span className="font-semibold text-foreground">{money ? formatMoney(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

const compact = (v: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v);

export function RevenueChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.brand} stopOpacity={0.35} />
            <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="4 4" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} tickFormatter={compact} width={48} />
        <Tooltip content={<TooltipBox money />} cursor={{ stroke: C.brand, strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="revenue" name="Encaissé" stroke={C.brand} strokeWidth={2.5} fill="url(#rev)" activeDot={{ r: 5, strokeWidth: 0 }} animationDuration={900} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function OccupancyDonut({ data, rate }: { data: { label: string; value: number; status: string }[]; rate: number }) {
  const colors: Record<string, string> = { OCCUPIED: C.brand, AVAILABLE: C.night, RESERVED: C.amber, MAINTENANCE: C.red };
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={68} outerRadius={92} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>
            {data.map((d) => <Cell key={d.status} fill={colors[d.status]} />)}
          </Pie>
          <Tooltip content={<TooltipBox />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold">{rate}%</span>
        <span className="text-xs text-muted-foreground">occupation</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: colors[d.status] }} />
            <span className="text-muted-foreground">{d.label}</span>
            <span className="ml-auto font-semibold tabular-nums">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PaymentsChart({ data }: { data: { label: string; value: number; status: string }[] }) {
  const colors: Record<string, string> = { PAID: C.brand, PARTIAL: C.amber, LATE: C.red, UNPAID: C.night };
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 4, left: -24, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="4 4" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} />
        <YAxis tickLine={false} axisLine={false} tick={{ fill: C.muted, fontSize: 11 }} allowDecimals={false} />
        <Tooltip content={<TooltipBox />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
        <Bar dataKey="value" name="Échéances" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={900}>
          {data.map((d) => <Cell key={d.status} fill={colors[d.status]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ResidenceOccupancy({ data }: { data: { name: string; total: number; occupied: number; rate: number }[] }) {
  return (
    <div className="space-y-4">
      {data.map((r) => (
        <div key={r.name}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="truncate font-medium">{r.name}</span>
            <span className="tabular-nums text-muted-foreground">{r.occupied}/{r.total} · <span className="font-semibold text-foreground">{r.rate}%</span></span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-gradient-to-r from-turquoise-500 to-turquoise-300 transition-all duration-700" style={{ width: `${r.rate}%` }} />
          </div>
        </div>
      ))}
      {!data.length && <p className="text-sm text-muted-foreground">Aucune résidence</p>}
    </div>
  );
}
