import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TripFormDialog } from "@/components/fleet/trip-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";

export default async function TransportationPage() {
  const { session, allowed } = await guardModule("transportation");
  if (!allowed) return <AccessRestricted />;

  const [trips, vehicles, drivers, transporters] = await Promise.all([
    prisma.transportTrip.findMany({ include: { vehicle: true, driver: true, transporter: true }, orderBy: { date: "desc" }, take: 100 }),
    prisma.vehicle.findMany({ orderBy: { registrationNumber: "asc" } }),
    prisma.driver.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { category: "Transportation" }, orderBy: { name: "asc" } }),
  ]);

  const canManage: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER];

  return (
    <div>
      <PageHeader
        title="Transportation"
        description="Trip records, cost per kg and cost per trip"
        action={canManage.includes(session.role) ? (
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
              <TableHead className="text-right">Cost/kg</TableHead>
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
                <TableCell className="text-right tabular-nums">{t.costPerKg ? formatINR(Number(t.costPerKg), true) : "—"}</TableCell>
                <TableCell><Badge variant={t.paymentStatus === "PAID" ? "default" : "secondary"}>{t.paymentStatus.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
            {trips.length === 0 && (
              <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No trips recorded yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
