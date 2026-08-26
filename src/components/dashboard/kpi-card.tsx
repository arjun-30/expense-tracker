import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";

export function KpiCard({
  label,
  value,
  icon: Icon,
  deltaPct,
  deltaGoodDirection = "down",
  formatAsCurrency = true,
  subtext,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  deltaPct?: number | null;
  /** whether a positive delta is "good" (e.g. lower spend is good -> 'down') */
  deltaGoodDirection?: "up" | "down";
  formatAsCurrency?: boolean;
  subtext?: string;
}) {
  const hasDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct);
  const isPositive = hasDelta && deltaPct! > 0;
  const isGood = hasDelta && (deltaGoodDirection === "up" ? isPositive : !isPositive);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-2xl font-semibold tabular-nums">
          {formatAsCurrency ? formatINR(value) : value.toLocaleString("en-IN")}
        </div>
        {hasDelta ? (
          <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", isGood ? "text-status-good" : "text-status-critical")}>
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(deltaPct!).toFixed(1)}% vs previous month
          </p>
        ) : subtext ? (
          <p className="mt-1 text-xs text-muted-foreground">{subtext}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
