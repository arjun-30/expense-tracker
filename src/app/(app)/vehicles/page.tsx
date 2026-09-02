import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VehicleFormDialog } from "@/components/fleet/vehicle-form-dialog";
import { formatNumber } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

function daysUntil(date: Date): number {
  return Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function ExpiryBadge({ label, date }: { label: string; date: Date | null }) {
  if (!date) return <span className="text-xs text-muted-foreground">{label}: —</span>;
  const daysLeft = daysUntil(date);
  const variant = daysLeft < 0 ? "destructive" : daysLeft <= 30 ? "secondary" : "outline";
  return (
    <Badge variant={variant} className="text-[10px]">
      {label}: {daysLeft < 0 ? "expired" : `${daysLeft}d`}
    </Badge>
  );
}

export default async function VehiclesPage() {
  const { session, allowed } = await guardModule("vehicles");
  if (!allowed) return <AccessRestricted />;

  const [vehicles, departments] = await Promise.all([
    prisma.vehicle.findMany({ where: { companyId: session.companyId }, include: { documents: true, department: true }, orderBy: { registrationNumber: "asc" } }),
    prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
  ]);

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER);

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Vehicle registry, documents and operating status"
        action={canManage ? <VehicleFormDialog departments={departments} /> : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registration #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Odometer (km)</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((v) => {
              const insurance = v.documents.find((d) => d.documentType === "INSURANCE")?.validUntil ?? null;
              const pollution = v.documents.find((d) => d.documentType === "POLLUTION")?.validUntil ?? null;
              const fitness = v.documents.find((d) => d.documentType === "FITNESS")?.validUntil ?? null;
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.registrationNumber}</TableCell>
                  <TableCell>{v.vehicleType}{v.manufacturer ? ` — ${v.manufacturer} ${v.model ?? ""}` : ""}</TableCell>
                  <TableCell>{v.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(Number(v.currentOdometer))}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <ExpiryBadge label="Ins" date={insurance} />
                      <ExpiryBadge label="Poll" date={pollution} />
                      <ExpiryBadge label="Fit" date={fitness} />
                    </div>
                  </TableCell>
                  <TableCell><Badge variant={v.status === "ACTIVE" ? "default" : "outline"}>{v.status.replace("_", " ")}</Badge></TableCell>
                </TableRow>
              );
            })}
            {vehicles.length === 0 && (
              <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No vehicles yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
