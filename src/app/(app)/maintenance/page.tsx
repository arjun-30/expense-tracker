import { Wrench, ClipboardList, Clock, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MaintenanceFormDialog } from "@/components/maintenance/maintenance-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function MaintenancePage() {
  const { session, allowed } = await guardModule("maintenance");
  if (!allowed) return <AccessRestricted />;

  const [records, machines, consumables, stats, breakdownCount] = await Promise.all([
    prisma.maintenanceRecord.findMany({ where: { machine: { companyId: session.companyId } }, include: { machine: true, spares: { include: { consumable: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.machine.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    prisma.consumable.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.maintenanceRecord.aggregate({
      where: { machine: { companyId: session.companyId } },
      _sum: { totalCost: true, downtimeMinutes: true },
      _count: true,
    }),
    prisma.maintenanceRecord.count({
      where: { machine: { companyId: session.companyId }, maintenanceType: "CORRECTIVE" },
    }),
  ]);

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER);
  const totalDowntimeMinutes = Number(stats._sum?.downtimeMinutes ?? 0);
  const downtimeFormatted = totalDowntimeMinutes >= 60
    ? `${(totalDowntimeMinutes / 60).toFixed(1)} hrs`
    : `${totalDowntimeMinutes} min`;

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Maintenance records, breakdowns and downtime"
        action={canManage ? (
          <MaintenanceFormDialog
            machines={machines.map((m) => ({ id: m.id, name: m.name }))}
            spareParts={consumables.map((s) => ({ id: s.id, name: s.name, currentStock: Number(s.currentStock) }))}
          />
        ) : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Maintenance Spend" value={Number(stats._sum?.totalCost ?? 0)} icon={Wrench} subtext="Labour and spares total" />
        <KpiCard
          label="Service Records"
          value={stats._count}
          icon={ClipboardList}
          formatAsCurrency={false}
          subtext="Total service tickets"
        />
        <KpiCard
          label="Total Downtime"
          value={totalDowntimeMinutes}
          icon={Clock}
          formatAsCurrency={false}
          formattedValue={downtimeFormatted}
          subtext="Equipment offline time"
        />
        <KpiCard
          label="Breakdown Fixes"
          value={breakdownCount}
          icon={AlertTriangle}
          formatAsCurrency={false}
          subtext="Emergency repairs"
        />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Machine</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Spares used</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Downtime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.ticketNumber}</TableCell>
                <TableCell>{formatDate(r.startTime ?? r.createdAt)}</TableCell>
                <TableCell>{r.machine.name}</TableCell>
                <TableCell><Badge variant="secondary">{r.maintenanceType.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.spares.length ? r.spares.map((s) => `${s.consumable.name} ×${s.quantity}`).join(", ") : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(r.totalCost))}</TableCell>
                <TableCell className="text-right tabular-nums">{r.downtimeMinutes ? `${r.downtimeMinutes} min` : "—"}</TableCell>
              </TableRow>
            ))}
            {records.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No maintenance records yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
