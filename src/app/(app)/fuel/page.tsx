import Link from "next/link";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FuelFormDialog } from "@/components/fleet/fuel-form-dialog";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { cn } from "@/lib/utils";
import { AlertTriangle, IndianRupee, Fuel, Gauge, Droplet } from "lucide-react";
import type { FuelType } from "@/generated/prisma/client";

const FUEL_STYLE_MAP: Record<string, { label: string; badge: string; bar: string; text: string }> = {
  DIESEL: {
    label: "Diesel",
    badge: "bg-blue-800/10 text-blue-800 dark:text-blue-300 border-blue-800/20",
    bar: "bg-blue-800 dark:bg-blue-400",
    text: "text-blue-800 dark:text-blue-300",
  },
  PETROL: {
    label: "Petrol",
    badge: "bg-amber-800/10 text-amber-800 dark:text-amber-300 border-amber-800/20",
    bar: "bg-amber-700 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-300",
  },
  CNG: {
    label: "CNG",
    badge: "bg-teal-800/10 text-teal-800 dark:text-teal-300 border-teal-800/20",
    bar: "bg-teal-700 dark:bg-teal-400",
    text: "text-teal-800 dark:text-teal-300",
  },
  OTHER: {
    label: "Other",
    badge: "bg-slate-600/10 text-slate-700 dark:text-slate-300 border-slate-600/20",
    bar: "bg-slate-600 dark:bg-slate-400",
    text: "text-slate-700 dark:text-slate-300",
  },
};

export default async function FuelPage(props: {
  searchParams?: Promise<{ fuelType?: string }>;
}) {
  const { session, allowed } = await guardModule("fuel");
  if (!allowed) return <AccessRestricted />;

  const searchParams = props.searchParams ? await props.searchParams : {};
  const rawFuelType = searchParams.fuelType?.toUpperCase();
  const selectedFuelType = rawFuelType && ["DIESEL", "PETROL", "CNG", "OTHER"].includes(rawFuelType)
    ? (rawFuelType as FuelType)
    : undefined;

  const [transactions, vehicles, drivers, agg, fuelByTypeAgg] = await Promise.all([
    prisma.fuelTransaction.findMany({
      where: {
        vehicle: { companyId: session.companyId },
        ...(selectedFuelType ? { fuelType: selectedFuelType } : {}),
      },
      include: { vehicle: true, driver: true },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.vehicle.findMany({
      where: { companyId: session.companyId },
      orderBy: { registrationNumber: "asc" },
    }),
    prisma.driver.findMany({
      where: { companyId: session.companyId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.fuelTransaction.aggregate({
      where: { vehicle: { companyId: session.companyId } },
      _sum: { totalAmount: true, litres: true },
      _avg: { efficiencyKmpl: true },
      _count: { id: true },
    }),
    prisma.fuelTransaction.groupBy({
      by: ["fuelType"],
      where: { vehicle: { companyId: session.companyId } },
      _sum: { totalAmount: true, litres: true },
      _count: { id: true },
      _avg: { efficiencyKmpl: true, ratePerLitre: true },
    }),
  ]);

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER);

  const totalSpend = Number(agg._sum.totalAmount ?? 0);
  const totalLitres = Number(agg._sum.litres ?? 0);
  const totalTransactionsCount = agg._count.id;

  // Format grouped fuel segregation data
  const fuelBreakdown = fuelByTypeAgg
    .map((item) => {
      const typeKey = item.fuelType as string;
      const meta = FUEL_STYLE_MAP[typeKey] ?? FUEL_STYLE_MAP.OTHER;
      const spend = Number(item._sum.totalAmount ?? 0);
      const litres = Number(item._sum.litres ?? 0);
      const count = item._count.id;
      const avgEfficiency = item._avg.efficiencyKmpl !== null ? Number(item._avg.efficiencyKmpl) : null;
      const avgRate = item._avg.ratePerLitre !== null ? Number(item._avg.ratePerLitre) : null;
      const spendPct = totalSpend > 0 ? Math.round((spend / totalSpend) * 100) : 0;
      const litresPct = totalLitres > 0 ? Math.round((litres / totalLitres) * 100) : 0;

      return {
        fuelType: item.fuelType,
        label: meta.label,
        badgeClass: meta.badge,
        barClass: meta.bar,
        textClass: meta.text,
        spend,
        spendPct,
        litres,
        litresPct,
        count,
        avgEfficiency,
        avgRate,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fuel"
        description="Fuel transactions, fuel type segregation, efficiency and anomaly detection"
        action={canManage ? (
          <FuelFormDialog
            vehicles={vehicles.map((v) => ({
              id: v.id,
              registrationNumber: v.registrationNumber,
              currentOdometer: Number(v.currentOdometer),
            }))}
            drivers={drivers}
          />
        ) : undefined}
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total Fuel Cost"
          value={totalSpend}
          icon={IndianRupee}
          subtext="Tracked across all fuel types"
        />
        <KpiCard
          label="Total Volume"
          value={totalLitres}
          formattedValue={`${totalLitres.toFixed(0)} L`}
          icon={Fuel}
          subtext="Cumulative volume dispensed"
        />
        <KpiCard
          label="Average Efficiency"
          value={Number(agg._avg.efficiencyKmpl ?? 0)}
          formattedValue={`${Number(agg._avg.efficiencyKmpl ?? 0).toFixed(2)} km/L`}
          icon={Gauge}
          subtext="Vehicle operating average"
        />
        <KpiCard
          label="Active Fuel Types"
          value={fuelBreakdown.length}
          formattedValue={`${fuelBreakdown.length} Types`}
          icon={Droplet}
          formatAsCurrency={false}
          subtext={fuelBreakdown.map((f) => f.label).join(", ") || "No fuel logged"}
        />
      </div>

      {/* Dedicated Fuel Segregation Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Droplet className="h-4 w-4 text-primary" />
                Fuel Type Segregation & Expenditure Share
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Breakdown of volume, expenditure, and average consumption by fuel type
              </CardDescription>
            </div>
            <span className="text-xs text-muted-foreground">
              {totalTransactionsCount} total fill records
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {/* Multi-segment distribution progress bar */}
          {totalSpend > 0 && (
            <div className="space-y-1.5">
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {fuelBreakdown.map((f) => (
                  <div
                    key={f.fuelType}
                    className={cn("h-full transition-all duration-500", f.barClass)}
                    style={{ width: `${f.spendPct}%` }}
                    title={`${f.label}: ${f.spendPct}% (${formatINR(f.spend)})`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
                {fuelBreakdown.map((f) => (
                  <div key={f.fuelType} className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", f.barClass)} />
                    <span className="font-medium text-foreground">{f.label}</span>
                    <span className="tabular-nums font-mono text-[11px]">({f.spendPct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards for each segregated fuel type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {fuelBreakdown.map((f) => {
              const isSelected = selectedFuelType === f.fuelType;
              return (
                <Link
                  key={f.fuelType}
                  href={isSelected ? "/fuel" : `/fuel?fuelType=${f.fuelType}`}
                  className={cn(
                    "rounded-xl border p-3.5 transition-all block cursor-pointer group hover:border-foreground/30",
                    isSelected ? "border-primary ring-1 ring-primary/30 bg-primary/5" : "bg-card hover:bg-muted/20"
                  )}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/50">
                    <Badge variant="outline" className={cn("text-xs font-semibold px-2 py-0.5", f.badgeClass)}>
                      {f.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {f.count} {f.count === 1 ? "fill" : "fills"}
                    </span>
                  </div>

                  <div className="pt-2.5 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">Total Spend:</span>
                      <div className="text-right">
                        <span className="text-base font-bold tabular-nums text-foreground">
                          {formatINR(f.spend)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-1.5 tabular-nums">
                          ({f.spendPct}%)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Volume Dispensed:</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {f.litres.toFixed(1)} L <span className="text-muted-foreground text-[10px]">({f.litresPct}%)</span>
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Avg Rate:</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {f.avgRate !== null ? `₹${f.avgRate.toFixed(2)} / L` : "—"}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Avg Efficiency:</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {f.avgEfficiency !== null ? `${f.avgEfficiency.toFixed(2)} km/L` : "—"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transactions Section with Fuel Filter Tabs */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Fuel Transactions Log
            </h2>
            <p className="text-xs text-muted-foreground">
              {selectedFuelType ? `Showing ${selectedFuelType} transactions only` : "Complete chronological log of vehicle fuel fill-ups"}
            </p>
          </div>

          {/* Filter tabs */}
          <div className="inline-flex rounded-lg border bg-muted/50 p-0.5 text-xs">
            <Link
              href="/fuel"
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-all",
                !selectedFuelType
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All Fuels ({totalTransactionsCount})
            </Link>
            {fuelBreakdown.map((f) => (
              <Link
                key={f.fuelType}
                href={`/fuel?fuelType=${f.fuelType}`}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-all",
                  selectedFuelType === f.fuelType
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label} ({f.count})
              </Link>
            ))}
          </div>
        </div>

        {/* Transactions Table with Fuel Type Column */}
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Fuel Type</TableHead>
                <TableHead>Fuel Station</TableHead>
                <TableHead>Driver</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Rate / L</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead className="text-right">Efficiency</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => {
                const meta = FUEL_STYLE_MAP[t.fuelType as string] ?? FUEL_STYLE_MAP.OTHER;
                return (
                  <TableRow key={t.id} className={t.isAnomaly ? "bg-status-warning/10" : "hover:bg-muted/40"}>
                    <TableCell className="text-xs">{formatDate(t.date)}</TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      {t.vehicle.registrationNumber}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[11px] font-medium px-2 py-0.5", meta.badge)}>
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.fuelStation ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {t.driver?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {Number(t.litres).toFixed(1)} L
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {t.ratePerLitre ? `₹${Number(t.ratePerLitre).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-xs text-foreground">
                      {formatINR(Number(t.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {t.distanceTravelled ? `${Number(t.distanceTravelled).toFixed(0)} km` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-xs text-foreground">
                      {t.efficiencyKmpl ? `${Number(t.efficiencyKmpl).toFixed(2)} km/L` : "—"}
                    </TableCell>
                    <TableCell>
                      {t.isAnomaly && (
                        <Badge variant="secondary" className="gap-1 text-status-warning" title={t.anomalyNote ?? undefined}>
                          <AlertTriangle className="h-3 w-3" /> Anomaly
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {transactions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-muted-foreground text-xs">
                    No {selectedFuelType ? `${selectedFuelType} ` : ""}fuel transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
