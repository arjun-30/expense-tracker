import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MaintenanceFormDialog } from "@/components/maintenance/maintenance-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";

export default async function MaintenancePage() {
  const { session, allowed } = await guardModule("maintenance");
  if (!allowed) return <AccessRestricted />;

  const [records, machines, spareParts] = await Promise.all([
    prisma.maintenanceRecord.findMany({ include: { machine: true, spares: { include: { sparePart: true } } }, orderBy: { date: "desc" }, take: 100 }),
    prisma.machine.findMany({ orderBy: { name: "asc" } }),
    prisma.sparePart.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const canManage: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.MAINTENANCE_MANAGER];

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Maintenance records, breakdowns and downtime"
        action={canManage.includes(session.role) ? (
          <MaintenanceFormDialog
            machines={machines}
            spareParts={spareParts.map((s) => ({ id: s.id, name: s.name, currentStock: Number(s.currentStock) }))}
          />
        ) : undefined}
      />
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
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.machine.name}</TableCell>
                <TableCell><Badge variant="secondary">{r.maintenanceType.replace("_", " ")}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.spares.length ? r.spares.map((s) => `${s.sparePart.name} ×${s.quantity}`).join(", ") : "—"}
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
