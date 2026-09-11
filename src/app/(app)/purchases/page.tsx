import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PurchaseOrderFormDialog } from "@/components/purchases/po-form-dialog";
import { ReceiveGoodsButton } from "@/components/purchases/receive-goods-button";
import { PoItemsPopover } from "@/components/purchases/po-items-popover";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function PurchasesPage() {
  const { session, allowed } = await guardModule("purchases");
  if (!allowed) return <AccessRestricted />;

  const [purchaseOrders, vendors] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { companyId: session.companyId }, include: { vendor: true, items: { include: { consumable: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  const canManagePO = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER);

  return (
    <div>
      <PageHeader title="Purchases" description="Purchase requests, orders and goods receipt" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Purchase Orders</CardTitle>
          {canManagePO && <PurchaseOrderFormDialog vendors={vendors} />}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Expected Delivery</TableHead>
                <TableHead>Status</TableHead>
                {canManagePO && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">{po.poNumber}</TableCell>
                  <TableCell>{po.vendor.name}</TableCell>
                  <TableCell>
                    <PoItemsPopover
                      items={po.items.map((it) => ({
                        id: it.id,
                        itemType: it.itemType,
                        description: it.description,
                        quantity: Number(it.quantity),
                        unitPrice: Number(it.unitPrice),
                        consumableName: it.consumable?.name ?? null,
                        consumableCategory: it.consumable?.category ?? null,
                      }))}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(po.totalAmount))}</TableCell>
                  <TableCell>{po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}</TableCell>
                  <TableCell><Badge variant={po.status === "RECEIVED" ? "success" : "secondary"}>{po.status.replace("_", " ")}</Badge></TableCell>
                  {canManagePO && (
                    <TableCell>
                      {po.status === "ORDERED" || po.status === "PARTIALLY_RECEIVED" ? (
                        <ReceiveGoodsButton purchaseOrderId={po.id} />
                      ) : null}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {purchaseOrders.length === 0 && (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No purchase orders yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
