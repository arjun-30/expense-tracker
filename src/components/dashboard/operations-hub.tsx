import { Truck, Wrench, Route, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  VehicleFuelItem,
  MachineCostItem,
  TransportSummaryItem,
  TopRouteSummaryItem,
  FuelTypeBreakdownItem,
} from "@/lib/services/dashboard";

const RANK_BAR_CLASSES = [
  "bg-blue-800 dark:bg-blue-400",     // 1. Corporate Navy
  "bg-teal-700 dark:bg-teal-400",     // 2. Deep Spruce Teal
  "bg-amber-700 dark:bg-amber-400",   // 3. Warm Cognac / Amber
  "bg-indigo-800 dark:bg-indigo-400", // 4. Deep Denim / Indigo
  "bg-rose-800 dark:bg-rose-400",     // 5. Deep Burgundy
  "bg-slate-600 dark:bg-slate-400",   // 6. Steel Slate
];

export function OperationsHub({
  vehicles,
  machines,
  transportSummary,
  totalVehicles,
  totalMachines,
  fuelBreakdown,
}: {
  vehicles: VehicleFuelItem[];
  machines: MachineCostItem[];
  transportSummary: {
    totalTrips: number;
    totalCost: number;
    trips?: TransportSummaryItem[];
    topRoutes?: TopRouteSummaryItem[];
  };
  totalVehicles: number;
  totalMachines: number;
  fuelBreakdown?: FuelTypeBreakdownItem[];
}) {
  const totalFuelSpend = vehicles.reduce((sum, v) => sum + v.value, 0);
  const maxVehicleSpend = Math.max(...vehicles.map((v) => v.value), 1);

  const totalMachineSpend = machines.reduce((sum, m) => sum + m.value, 0);
  const maxMachineSpend = Math.max(...machines.map((m) => m.value), 1);

  const routes = transportSummary.topRoutes && transportSummary.topRoutes.length > 0
    ? transportSummary.topRoutes
    : (transportSummary.trips || []).map((t) => ({
        source: t.source,
        destination: t.destination,
        tripCount: 1,
        totalCost: t.totalCost,
      }));

  const maxRouteSpend = Math.max(...routes.map((r) => r.totalCost), 1);
  const avgCostPerTrip = transportSummary.totalTrips > 0
    ? Math.round(transportSummary.totalCost / transportSummary.totalTrips)
    : 0;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* 1. Vehicle Fuel Consumption Analytics */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-400">
              <Truck className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Vehicle Fuel Consumption</CardTitle>
          </div>
          <CardDescription className="mt-1 text-xs">
            {totalVehicles} registered vehicles · {formatINR(totalFuelSpend)} total fuel spend
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 pt-1 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
            <div>
              <p className="text-muted-foreground text-[11px]">Logged Vehicles</p>
              <p className="font-semibold text-foreground text-sm">{vehicles.length} of {totalVehicles}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[11px]">Avg / Active Vehicle</p>
              <p className="font-semibold text-foreground text-sm">
                {vehicles.length > 0 ? formatINR(Math.round(totalFuelSpend / vehicles.length)) : "₹0"}
              </p>
            </div>
          </div>

          {/* Fuel Type Segregation Strip */}
          {fuelBreakdown && fuelBreakdown.length > 0 && (
            <div className="rounded-lg border bg-muted/20 p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Fuel Segregation
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {fuelBreakdown.length} active fuel {fuelBreakdown.length === 1 ? "type" : "types"}
                </span>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {fuelBreakdown.map((f) => {
                  const pct = totalFuelSpend > 0 ? Math.round((f.totalAmount / totalFuelSpend) * 100) : 0;
                  const barColor = f.fuelType === "DIESEL"
                    ? "bg-blue-800 dark:bg-blue-400"
                    : f.fuelType === "PETROL"
                    ? "bg-amber-700 dark:bg-amber-400"
                    : f.fuelType === "CNG"
                    ? "bg-teal-700 dark:bg-teal-400"
                    : "bg-slate-600 dark:bg-slate-400";
                  return (
                    <div
                      key={f.fuelType}
                      className={cn("h-full transition-all", barColor)}
                      style={{ width: `${pct}%` }}
                      title={`${f.fuelType}: ${pct}% (${formatINR(f.totalAmount)})`}
                    />
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-0.5">
                {fuelBreakdown.map((f) => {
                  const textColor = f.fuelType === "DIESEL"
                    ? "text-blue-800 dark:text-blue-300 font-semibold"
                    : f.fuelType === "PETROL"
                    ? "text-amber-800 dark:text-amber-300 font-semibold"
                    : f.fuelType === "CNG"
                    ? "text-teal-800 dark:text-teal-300 font-semibold"
                    : "text-slate-700 dark:text-slate-300 font-semibold";
                  return (
                    <div key={f.fuelType} className="flex items-center gap-1">
                      <span className={textColor}>{f.fuelType}:</span>
                      <span className="tabular-nums font-medium text-foreground">{formatINR(f.totalAmount)}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({f.litres.toFixed(0)}L)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {vehicles.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No vehicle fuel records logged yet.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {vehicles.map((v, idx) => {
                const pctOfMax = Math.min(100, Math.max(6, Math.round((v.value / maxVehicleSpend) * 100)));
                const pctOfTotal = totalFuelSpend > 0 ? Math.round((v.value / totalFuelSpend) * 100) : 0;
                const barColor = RANK_BAR_CLASSES[idx % RANK_BAR_CLASSES.length];

                return (
                  <div key={v.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-3.5 shrink-0 font-mono text-xs font-semibold text-muted-foreground/60">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground truncate">{v.name}</span>
                        {v.model && (
                          <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                            · {v.model}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground tabular-nums">({pctOfTotal}%)</span>
                        <span className="font-semibold tabular-nums text-foreground">{formatINR(v.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Machinery & Maintenance Analytics */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Machinery Maintenance Spend</CardTitle>
          </div>
          <CardDescription className="mt-1 text-xs">
            {totalMachines} plant units · {formatINR(totalMachineSpend)} total maintenance cost
          </CardDescription>
        </CardHeader>

        <CardContent className="flex-1 pt-1 space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
            <div>
              <p className="text-muted-foreground text-[11px]">Serviced Units</p>
              <p className="font-semibold text-foreground text-sm">{machines.length} of {totalMachines}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-[11px]">Avg / Serviced Unit</p>
              <p className="font-semibold text-foreground text-sm">
                {machines.length > 0 ? formatINR(Math.round(totalMachineSpend / machines.length)) : "₹0"}
              </p>
            </div>
          </div>

          {machines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No machinery maintenance records logged yet.
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {machines.map((m, idx) => {
                const pctOfMax = Math.min(100, Math.max(6, Math.round((m.value / maxMachineSpend) * 100)));
                const pctOfTotal = totalMachineSpend > 0 ? Math.round((m.value / totalMachineSpend) * 100) : 0;
                const barColor = RANK_BAR_CLASSES[idx % RANK_BAR_CLASSES.length];

                return (
                  <div key={m.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-3.5 shrink-0 font-mono text-xs font-semibold text-muted-foreground/60">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-foreground truncate">{m.name}</span>
                        {m.code && (
                          <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">
                            {m.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-muted-foreground tabular-nums">({pctOfTotal}%)</span>
                        <span className="font-semibold tabular-nums text-foreground">{formatINR(m.value)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Logistics & Route Analytics */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-700 dark:text-indigo-400">
              <Route className="h-4 w-4" />
            </span>
            <CardTitle className="text-base">Freight & Route Analytics</CardTitle>
          </div>
          <CardDescription className="mt-1 text-xs">
            {transportSummary.totalTrips} completed dispatches across top shipping routes
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-1 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Total Dispatches</p>
              <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                {transportSummary.totalTrips} <span className="text-xs font-normal text-muted-foreground">trips</span>
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Total Freight Expenditure</p>
              <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                {formatINR(transportSummary.totalCost)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Avg Cost / Dispatch</p>
              <p className="text-lg font-bold text-foreground mt-0.5 tabular-nums">
                {formatINR(avgCostPerTrip)}
              </p>
            </div>
          </div>

          {routes.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No transport trips recorded yet.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Top Routes by Freight Expenditure
              </p>
              {routes.map((r, idx) => {
                const pctOfMax = Math.min(100, Math.max(6, Math.round((r.totalCost / maxRouteSpend) * 100)));
                const pctOfTotal = transportSummary.totalCost > 0
                  ? Math.round((r.totalCost / transportSummary.totalCost) * 100)
                  : 0;
                const barColor = RANK_BAR_CLASSES[idx % RANK_BAR_CLASSES.length];

                return (
                  <div key={`${r.source}-${r.destination}-${idx}`} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-4 shrink-0 font-mono text-xs font-semibold text-muted-foreground/60">
                          {idx + 1}
                        </span>
                        <div className="flex items-center gap-1.5 truncate font-medium text-foreground">
                          <span className="truncate">{r.source}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{r.destination}</span>
                        </div>
                        <span className="text-[11px] text-muted-foreground hidden sm:inline tabular-nums">
                          · {r.tripCount} {r.tripCount === 1 ? "trip" : "trips"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground tabular-nums">({pctOfTotal}%)</span>
                        <span className="font-semibold tabular-nums text-foreground">{formatINR(r.totalCost)}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", barColor)}
                        style={{ width: `${pctOfMax}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
