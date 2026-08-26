"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";
import { formatINR } from "@/lib/format";

const GRID = "var(--border)";
const AXIS_TEXT = "var(--muted-foreground)";
const SERIES_1 = "var(--chart-1)";
const SERIES_2 = "var(--chart-2)";

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-popover-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span className="font-medium text-popover-foreground">{formatINR(p.value)}</span>
          {payload.length > 1 ? ` — ${p.name}` : ""}
        </p>
      ))}
    </div>
  );
}

export function TrendChart({ data }: { data: { month: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.25} />
            <stop offset="100%" stopColor={SERIES_1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: AXIS_TEXT }}
          axisLine={false}
          tickLine={false}
          width={70}
          tickFormatter={(v) => formatINR(v)}
        />
        <Tooltip content={<CurrencyTooltip />} />
        <Area type="monotone" dataKey="total" name="Expenses" stroke={SERIES_1} strokeWidth={2} fill="url(#trendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RankingBarChart({ data, height = 260 }: { data: { name: string; value: number }[]; height?: number }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data yet</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: AXIS_TEXT }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v)} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: AXIS_TEXT }}
          axisLine={false}
          tickLine={false}
          width={140}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="value" name="Amount" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BudgetVsActualChart({ data }: { data: { name: string; budget: number; actual: number }[] }) {
  if (data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No budgets configured for this period</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={70} tickFormatter={(v) => formatINR(v)} />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--muted)" }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="budget" name="Budget" fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={40}>
          {data.map((_, i) => (
            <Cell key={i} />
          ))}
        </Bar>
        <Bar dataKey="actual" name="Actual" fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
