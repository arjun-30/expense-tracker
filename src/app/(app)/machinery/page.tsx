import { Cog, CheckCircle2, AlertTriangle, Wrench } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MachineFormDialog } from "@/components/maintenance/machine-form-dialog";
import { formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline"> = {
  RUNNING: "success",
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
  const totalMaintenanceCost = maintenanceCosts.reduce((s, m) => s + Number(m._sum?.totalCost ?? 0), 0);
  const runningCount = machines.filter((m) => m.status === "RUNNING").length;
  const attentionCount = machines.filter((m) => m.status === "UNDER_MAINTENANCE" || m.status === "BREAKDOWN").length;

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER);

  return (
    <div>
      <PageHeader
        title="Machinery"
        description="Machine asset register"
        action={canManage ? <MachineFormDialog departments={departments} /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Total Machines" value={machines.length} icon={Cog} formatAsCurrency={false} subtext="Factory equipment units" />
        <KpiCard label="Operational" value={runningCount} icon={CheckCircle2} formatAsCurrency={false} subtext="Currently running" />
        <KpiCard
          label="Attention Needed"
          value={attentionCount}
          icon={AlertTriangle}
          formatAsCurrency={false}
          subtext={attentionCount > 0 ? "Maintenance or breakdown" : "All operational"}
        />
        <KpiCard label="Total Maintenance" value={totalMaintenanceCost} icon={Wrench} subtext="All time repair spend" />
      </div>
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
              {canManage && <TableHead />}
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
                {canManage && (
                  <TableCell>
                    <MachineFormDialog
                      machineId={m.id}
                      departments={departments}
                      trigger="icon"
                      defaultValues={{
                        machineCode: m.machineCode,
                        name: m.name,
                        manufacturer: m.manufacturer ?? undefined,
                        model: m.model ?? undefined,
                        location: m.location ?? undefined,
                        departmentId: m.departmentId ?? undefined,
                        purchaseCost: m.purchaseCost ? Number(m.purchaseCost) : undefined,
                        status: m.status,
                      }}
                    />
                  </TableCell>
                )}
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
