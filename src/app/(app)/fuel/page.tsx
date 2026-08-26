import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FuelFormDialog } from "@/components/fleet/fuel-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";
import { AlertTriangle } from "lucide-react";

export default async function FuelPage() {
  const { session, allowed } = await guardModule("fuel");
  if (!allowed) return <AccessRestricted />;

  const [transactions, vehicles, drivers, agg] = await Promise.all([
    prisma.fuelTransaction.findMany({ include: { vehicle: true, driver: true }, orderBy: { date: "desc" }, take: 100 }),
    prisma.vehicle.findMany({ orderBy: { registrationNumber: "asc" } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.fuelTransaction.aggregate({ _sum: { totalAmount: true, litres: true }, _avg: { efficiencyKmpl: true, costPerKm: true } }),
  ]);

  const canManage: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER];

  return (
    <div>
      <PageHeader
        title="Fuel"
        description="Fuel transactions, efficiency and anomaly detection"
        action={canManage.includes(session.role) ? (
          <FuelFormDialog
            vehicles={vehicles.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber, currentOdometer: Number(v.currentOdometer) }))}
            drivers={drivers}
          />
        ) : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Fuel Cost</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{formatINR(Number(agg._sum.totalAmount ?? 0))}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Litres</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{Number(agg._sum.litres ?? 0).toFixed(0)} L</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg. Efficiency</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{Number(agg._avg.efficiencyKmpl ?? 0).toFixed(2)} km/L</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Avg. Cost/km</CardTitle></CardHeader><CardContent className="text-xl font-semibold">{formatINR(Number(agg._avg.costPerKm ?? 0), true)}</CardContent></Card>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="text-right">Litres</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Distance</TableHead>
              <TableHead className="text-right">Efficiency</TableHead>
              <TableHead className="text-right">Cost/km</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id} className={t.isAnomaly ? "bg-status-warning/10" : undefined}>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell className="font-medium">{t.vehicle.registrationNumber}</TableCell>
                <TableCell>{t.driver?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(t.litres).toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(t.totalAmount))}</TableCell>
                <TableCell className="text-right tabular-nums">{Number(t.distanceTravelled).toFixed(0)} km</TableCell>
                <TableCell className="text-right tabular-nums">{t.efficiencyKmpl ? `${Number(t.efficiencyKmpl).toFixed(2)} km/L` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{t.costPerKm ? formatINR(Number(t.costPerKm), true) : "—"}</TableCell>
                <TableCell>
                  {t.isAnomaly && (
                    <Badge variant="secondary" className="gap-1 text-status-warning" title={t.anomalyNote ?? undefined}>
                      <AlertTriangle className="h-3 w-3" /> Anomaly
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {transactions.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No fuel transactions yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
