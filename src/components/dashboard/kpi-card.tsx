import { ArrowDown, ArrowUp, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";

export function KpiCard({
  label,
  value,
  icon: Icon,
  deltaPct,
  deltaGoodDirection = "down",
  deltaLabel = "vs previous month",
  formatAsCurrency = true,
  precise = false,
  subtext,
  formattedValue,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  deltaPct?: number | null;
  /** whether a positive delta is "good" (e.g. lower spend is good -> 'down') */
  deltaGoodDirection?: "up" | "down";
  /** trailing text after the delta percentage, e.g. "vs last month" */
  deltaLabel?: string;
  formatAsCurrency?: boolean;
  /** show currency with paise instead of rounding to whole rupees, for small per-unit values */
  precise?: boolean;
  subtext?: string;
  /** pre-formatted display string (e.g. "1,234 L", "12.34 km/L") that overrides the default currency/number formatting */
  formattedValue?: string;
}) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const isPositive = hasDelta && deltaPct! > 0;
  const isGood = hasDelta && (deltaGoodDirection === "up" ? isPositive : !isPositive);

  return (
    <Card className="transition-all hover:shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5">
        <CardTitle className="text-xs font-medium text-muted-foreground tracking-wide truncate">{label}</CardTitle>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-2xl font-bold tracking-tight tabular-nums text-foreground">
          {formattedValue ?? (formatAsCurrency ? formatINR(value, precise) : value.toLocaleString("en-IN"))}
        </div>
        {(hasDelta || subtext) ? (
          <div className="mt-1">
            {hasDelta ? (
              <p className={cn("flex items-center gap-1 text-[11px] font-medium", isGood ? "text-status-good" : "text-status-critical")}>
                {isPositive ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />}
                <span>{Math.abs(deltaPct!).toFixed(1)}% {deltaLabel}</span>
              </p>
            ) : subtext ? (
              <p className="text-[11px] text-muted-foreground truncate">{subtext}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
