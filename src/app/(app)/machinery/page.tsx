import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MachineFormDialog } from "@/components/maintenance/machine-form-dialog";
import { formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  RUNNING: "default",
  IDLE: "secondary",
  UNDER_MAINTENANCE: "secondary",
  BREAKDOWN: "destructive",
  RETIRED: "outline",
};

export default async function MachineryPage() {
  const { session, allowed } = await guardModule("machinery");
  if (!allowed) return <AccessRestricted />;

  const [machines, departments, maintenanceCosts] = await Promise.all([
    prisma.machine.findMany({ where: { companyId: session.companyId }, include: { department: true }, orderBy: { machineCode: "asc" } }),
    prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    prisma.maintenanceRecord.groupBy({ by: ["machineId"], where: { machine: { companyId: session.companyId } }, _sum: { totalCost: true } }),
  ]);
  const costMap = new Map(maintenanceCosts.map((m) => [m.machineId, Number(m._sum?.totalCost ?? 0)]));

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER);

  return (
    <div>
      <PageHeader
        title="Machinery"
        description="Machine asset register"
        action={canManage ? <MachineFormDialog departments={departments} /> : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Purchase Price</TableHead>
              <TableHead className="text-right">Maintenance Cost (all time)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.machineCode}</TableCell>
                <TableCell>{m.name}</TableCell>
                <TableCell>{m.department?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.purchaseCost ? formatINR(Number(m.purchaseCost)) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(costMap.get(m.id) ?? 0)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANT[m.status]}>{m.status.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
            {machines.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No machines yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
