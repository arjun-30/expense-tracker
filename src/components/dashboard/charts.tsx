"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  Cell,
} from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR, formatINRCompact } from "@/lib/format";

const GRID = "var(--border)";
const AXIS_TEXT = "var(--muted-foreground)";
const COLOR_PRIMARY = "#1e40af"; // Executive corporate navy (Blue-800)
const COLOR_SECONDARY = "#0f766e"; // Deep refined teal (Teal-700)
const COLOR_MUTED_BAR = "#94a3b8"; // Slate-400
const COLOR_SUCCESS = "#059669"; // Emerald-600
const COLOR_OVER_BUDGET = "#dc2626"; // Red-600

function SpotTooltip({
  active,
  payload,
  label,
  period,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { fullDate?: string; label?: string; total: number } }[];
  label?: string;
  period: "daily" | "monthly";
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const raw = item?.payload;
  const dateTitle = raw?.fullDate || raw?.label || label || "";
  const spend = item?.value ?? 0;

  return (
    <div className="rounded-xl border bg-popover/95 backdrop-blur-md px-4 py-3 text-xs shadow-xl ring-1 ring-black/5 dark:ring-white/10 min-w-[200px]">
      <div className="flex items-center gap-2 text-muted-foreground pb-2 border-b border-border/60">
        <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="font-semibold text-foreground truncate">{dateTitle}</span>
      </div>
      <div className="pt-2 flex items-baseline justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          {period === "daily" ? "Date Spend" : "Month Spend"}:
        </span>
        <span className="text-base font-bold tabular-nums text-foreground">
          {formatINR(spend)}
        </span>
      </div>
    </div>
  );
}

export function TrendChart({
  data,
  dailyData,
}: {
  data: { month: string; total: number; fullDate?: string }[];
  dailyData?: { date: string; total: number; fullDate?: string }[];
}) {
  const [period, setPeriod] = useState<"daily" | "monthly">(
    dailyData && dailyData.length > 0 ? "daily" : "monthly"
  );

  const activeData: { label: string; fullDate?: string; total: number }[] = (
    period === "daily" && dailyData && dailyData.length > 0
      ? dailyData.map((d) => ({ label: d.date, fullDate: d.fullDate, total: d.total }))
      : data.map((d) => ({ label: d.month, fullDate: d.fullDate, total: d.total }))
  );

  if (!activeData || activeData.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data recorded yet</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            Expense Trend
          </h3>
          <p className="text-xs text-muted-foreground">
            {period === "daily"
              ? "Hover on any spot along the line to view that date's spend"
              : "Hover on any spot along the line to view that month's spend"}
          </p>
        </div>
        {dailyData && dailyData.length > 0 && (
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriod("daily")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                period === "daily"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Daily (30 Days)
            </button>
            <button
              type="button"
              onClick={() => setPeriod("monthly")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer",
                period === "monthly"
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly (12 Months)
            </button>
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={activeData} margin={{ top: 14, right: 14, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLOR_PRIMARY} stopOpacity={0.14} />
              <stop offset="95%" stopColor={COLOR_PRIMARY} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
            dy={4}
            minTickGap={period === "daily" ? 18 : 8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: AXIS_TEXT }}
            axisLine={false}
            tickLine={false}
            width={54}
            tickFormatter={(v) => formatINRCompact(v)}
          />
          <Tooltip
            content={<SpotTooltip period={period} />}
            cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1.5, strokeDasharray: "3 3" }}
          />
          <Area
            type="monotone"
            dataKey="total"
            name="Expenses"
            stroke={COLOR_PRIMARY}
            strokeWidth={2}
            fill="url(#trendGradient)"
            dot={false}
            activeDot={{
              r: 5.5,
              fill: COLOR_PRIMARY,
              stroke: "#ffffff",
              strokeWidth: 2,
            }}
            isAnimationActive={true}
            animationDuration={350}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
const RANK_BAR_CLASSES = [
  "bg-blue-800 dark:bg-blue-400",     // 1. Corporate Navy
  "bg-teal-700 dark:bg-teal-400",     // 2. Deep Spruce Teal
  "bg-amber-700 dark:bg-amber-400",   // 3. Warm Cognac / Amber
  "bg-indigo-800 dark:bg-indigo-400", // 4. Deep Denim / Indigo
  "bg-rose-800 dark:bg-rose-400",     // 5. Deep Burgundy
  "bg-slate-600 dark:bg-slate-400",   // 6. Steel Slate
];

export function RankingBarChart({
  data,
  maxItems = 6,
}: {
  data: { name: string; value: number }[];
  maxItems?: number;
}) {
  if (!data || data.length === 0) {
    return <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">No data recorded yet</p>;
  }

  const items = data.slice(0, maxItems);
  const maxValue = Math.max(...items.map((d) => d.value), 1);
  const totalValue = items.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="space-y-3.5 py-1">
      {items.map((item, idx) => {
        const pctOfMax = Math.min(100, Math.max(5, Math.round((item.value / maxValue) * 100)));
        const pctOfTotal = totalValue > 0 ? Math.round((item.value / totalValue) * 100) : 0;
        const barColorClass = RANK_BAR_CLASSES[idx % RANK_BAR_CLASSES.length];

        return (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="w-4 shrink-0 font-mono text-xs font-semibold text-muted-foreground/60 text-left">
                  {idx + 1}
                </span>
                <span className="truncate font-medium text-foreground" title={item.name}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">({pctOfTotal}%)</span>
                <span className="font-semibold tabular-nums text-foreground">{formatINR(item.value)}</span>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className={cn("h-full rounded-full transition-all duration-500", barColorClass)}
                style={{
                  width: `${pctOfMax}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function YoyTrendChart({ data }: { data: { month: string; thisYear: number; lastYear: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No comparison data yet</p>;
  }

  function YoyTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { name: string; value: number; dataKey: string }[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    const thisYearVal = payload.find((p) => p.dataKey === "thisYear")?.value ?? 0;
    const lastYearVal = payload.find((p) => p.dataKey === "lastYear")?.value ?? 0;
    const diff = thisYearVal - lastYearVal;
    const pctDiff = lastYearVal > 0 ? Math.round((diff / lastYearVal) * 100) : null;

    return (
      <div className="rounded-lg border bg-popover px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        <p className="mb-2 font-semibold text-popover-foreground">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_PRIMARY }} /> This Year
            </span>
            <span className="font-semibold tabular-nums text-popover-foreground">{formatINR(thisYearVal)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLOR_MUTED_BAR }} /> Last Year
            </span>
            <span className="font-semibold tabular-nums text-popover-foreground">{formatINR(lastYearVal)}</span>
          </div>
          {pctDiff !== null && (
            <div className="mt-2 border-t pt-1.5 text-right">
              <span className={pctDiff > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                {pctDiff > 0 ? `+${pctDiff}% higher` : `${pctDiff}% lower`} vs last year
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 14, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} dy={4} />
        <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => formatINRCompact(v)} />
        <Tooltip content={<YoyTooltip />} cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1.5, strokeDasharray: "3 3" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
          formatter={(val) => <span className="text-foreground text-xs font-medium">{val}</span>}
        />
        <Line
          type="monotone"
          dataKey="lastYear"
          name="Last Year"
          stroke={COLOR_MUTED_BAR}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          activeDot={{ r: 4.5, stroke: COLOR_MUTED_BAR, strokeWidth: 1.5, fill: "#ffffff" }}
        />
        <Line
          type="monotone"
          dataKey="thisYear"
          name="This Year"
          stroke={COLOR_PRIMARY}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 5.5, stroke: COLOR_PRIMARY, strokeWidth: 2, fill: "#ffffff" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function BudgetVsActualChart({ data }: { data: { name: string; budget: number; actual: number }[] }) {
  if (!data || data.length === 0) {
    return <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No budgets configured for this period</p>;
  }

  function BudgetTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: { name: string; value: number; payload: { budget: number; actual: number } }[];
    label?: string;
  }) {
    if (!active || !payload?.length) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    const isOver = item.actual > item.budget;
    const utilPct = item.budget > 0 ? Math.round((item.actual / item.budget) * 100) : 100;

    return (
      <div className="rounded-lg border bg-popover px-3.5 py-2.5 text-xs shadow-lg ring-1 ring-black/5 dark:ring-white/10">
        <p className="mb-2 font-semibold text-popover-foreground">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-[#64748b]" /> Budget
            </span>
            <span className="font-semibold tabular-nums text-popover-foreground">{formatINR(item.budget)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: isOver ? COLOR_OVER_BUDGET : COLOR_SUCCESS }} /> Actual
            </span>
            <span className="font-semibold tabular-nums text-popover-foreground">{formatINR(item.actual)}</span>
          </div>
          <div className="mt-2 border-t pt-1.5 text-right">
            <span className={isOver ? "text-destructive font-semibold" : "text-emerald-600 dark:text-emerald-400 font-semibold"}>
              {isOver ? `Over Budget (${utilPct}%)` : `Within Budget (${utilPct}%)`}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={{ stroke: GRID }} tickLine={false} dy={4} />
        <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} axisLine={false} tickLine={false} width={54} tickFormatter={(v) => formatINRCompact(v)} />
        <Tooltip content={<BudgetTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
          formatter={(val) => <span className="text-foreground text-xs font-medium">{val}</span>}
        />
        <Bar dataKey="budget" name="Allocated Budget" fill="#64748b" radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar dataKey="actual" name="Actual Spent" radius={[4, 4, 0, 0]} maxBarSize={32}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.actual > entry.budget ? COLOR_OVER_BUDGET : COLOR_SUCCESS}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
