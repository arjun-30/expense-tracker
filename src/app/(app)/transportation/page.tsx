import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TripFormDialog } from "@/components/fleet/trip-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function TransportationPage() {
  const { session, allowed } = await guardModule("transportation");
  if (!allowed) return <AccessRestricted />;

  const [trips, vehicles, drivers, transporters] = await Promise.all([
    prisma.transportTrip.findMany({ where: { companyId: session.companyId }, include: { vehicle: true, driver: true, transporter: true }, orderBy: { date: "desc" }, take: 100 }),
    prisma.vehicle.findMany({ where: { companyId: session.companyId }, orderBy: { registrationNumber: "asc" } }),
    prisma.driver.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.transporter.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER);

  return (
    <div>
      <PageHeader
        title="Transportation"
        description="Trip records and cost per trip"
        action={canManage ? (
          <TripFormDialog
            vehicles={vehicles.map((v) => ({ id: v.id, registrationNumber: v.registrationNumber }))}
            drivers={drivers}
            transporters={transporters}
          />
        ) : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Route</TableHead>
              <TableHead>Material</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead>Payment</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trips.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.tripNumber}</TableCell>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell>{t.vehicle.registrationNumber}</TableCell>
                <TableCell>{t.source} → {t.destination}</TableCell>
                <TableCell>{t.material ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{t.quantity ? `${Number(t.quantity)} ${t.unit ?? ""}` : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(t.totalCost))}</TableCell>
                <TableCell><Badge variant={t.paymentStatus === "PAID" ? "default" : "secondary"}>{t.paymentStatus.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
            {trips.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No trips recorded yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
