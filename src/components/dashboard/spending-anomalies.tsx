import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/format";
import type { SpendAnomaly } from "@/lib/services/dashboard";

export function SpendingAnomalies({ data }: { data: SpendAnomaly[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-[120px] items-center justify-center text-center text-sm text-muted-foreground">
        No unusual spending vs the last 3 months
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.map((a) => {
        const isSpike = a.changePct > 0;
        return (
          <li key={`${a.type}-${a.name}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2">
              {isSpike ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-status-critical" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 text-status-good" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.type} · {formatINR(a.currentAmount)} vs {formatINR(a.trailingAvgAmount)} avg
                </p>
              </div>
            </div>
            <Badge variant={isSpike ? "destructive" : "success"} className="shrink-0">
              {isSpike ? "+" : ""}
              {a.changePct.toFixed(0)}%
            </Badge>
          </li>
        );
      })}
    </ul>
  );
}
