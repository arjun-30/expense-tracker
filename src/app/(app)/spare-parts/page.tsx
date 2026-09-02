import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SparePartFormDialog } from "@/components/maintenance/spare-part-form-dialog";
import { InventoryAdjustDialog } from "@/components/maintenance/inventory-adjust-dialog";
import { getSpareReliability } from "@/lib/services/spare-intelligence";
import { formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { AlertTriangle } from "lucide-react";

const RELIABILITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  Good: "default",
  Fair: "secondary",
  Poor: "destructive",
};

export default async function SparePartsPage() {
  const { session, allowed } = await guardModule("spareParts");
  if (!allowed) return <AccessRestricted />;

  const [spares, reliability] = await Promise.all([
    prisma.consumable.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    getSpareReliability(session.companyId),
  ]);

  const canManage = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER, ROLES.PURCHASE_MANAGER);
  const lowStockCount = spares.filter((s) => Number(s.currentStock) < Number(s.minimumStock)).length;

  return (
    <div>
      <PageHeader
        title="Spare Parts"
        description="Inventory, issue workflow and reliability analytics"
        action={canManage ? <SparePartFormDialog /> : undefined}
      />

      {lowStockCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
          <AlertTriangle className="h-4 w-4" /> {lowStockCount} spare part(s) below minimum stock level.
        </div>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-base">Inventory</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Part #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Min</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {spares.map((s) => {
                const low = Number(s.currentStock) < Number(s.minimumStock);
                return (
                  <TableRow key={s.id} className={low ? "bg-status-warning/10" : undefined}>
                    <TableCell className="font-medium">{s.partNumber}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(s.currentStock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(s.minimumStock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatINR(Number(s.unitCost))}</TableCell>
                    <TableCell>
                      {low ? <Badge variant="secondary" className="gap-1 text-status-warning"><AlertTriangle className="h-3 w-3" /> Low Stock</Badge> : <Badge variant="outline">OK</Badge>}
                    </TableCell>
                    {canManage && (
                      <TableCell><InventoryAdjustDialog sparePartId={s.id} sparePartName={s.name} /></TableCell>
                    )}
                  </TableRow>
                );
              })}
              {spares.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No spare parts yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Reliability Analytics</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Spare</TableHead>
                <TableHead className="text-right">Replacements</TableHead>
                <TableHead className="text-right">Avg. Lifespan</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Cost / Month</TableHead>
                <TableHead>Reliability</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reliability.map((r) => (
                <TableRow key={r.consumableId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.replacements}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.averageLifespanDays ? `${r.averageLifespanDays.toFixed(0)} days` : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.totalCost)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(r.costPerMonth)}</TableCell>
                  <TableCell><Badge variant={RELIABILITY_VARIANT[r.reliability]}>{r.reliability}</Badge></TableCell>
                </TableRow>
              ))}
              {reliability.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No replacement history yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
