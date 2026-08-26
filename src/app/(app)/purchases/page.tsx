import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PurchaseOrderFormDialog } from "@/components/purchases/po-form-dialog";
import { InvoiceFormDialog } from "@/components/purchases/invoice-form-dialog";
import { ReceiveGoodsButton } from "@/components/purchases/receive-goods-button";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";

export default async function PurchasesPage() {
  const { session, allowed } = await guardModule("purchases");
  if (!allowed) return <AccessRestricted />;

  const [purchaseOrders, invoices, vendors, spareParts] = await Promise.all([
    prisma.purchaseOrder.findMany({ include: { vendor: true, items: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.invoice.findMany({ include: { vendor: true }, orderBy: { invoiceDate: "desc" }, take: 50 }),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.sparePart.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  const canManage: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.PURCHASE_MANAGER];
  const canManagePO = canManage.includes(session.role);
  const canRecordInvoice = [...canManage, Role.ACCOUNTS].includes(session.role);

  return (
    <div>
      <PageHeader title="Purchases" description="Purchase requests, orders, goods receipt and invoices" />

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Purchase Orders</CardTitle>
          {canManagePO && (
            <PurchaseOrderFormDialog
              vendors={vendors}
              spareParts={spareParts.map((s) => ({ id: s.id, name: s.name, purchasePrice: Number(s.purchasePrice) }))}
            />
          )}
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
                  <TableCell>{po.items.length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(po.totalAmount))}</TableCell>
                  <TableCell>{po.expectedDelivery ? formatDate(po.expectedDelivery) : "—"}</TableCell>
                  <TableCell><Badge variant={po.status === "RECEIVED" ? "default" : "secondary"}>{po.status.replace("_", " ")}</Badge></TableCell>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Invoices</CardTitle>
          {canRecordInvoice && (
            <InvoiceFormDialog vendors={vendors} purchaseOrders={purchaseOrders.map((p) => ({ id: p.id, poNumber: p.poNumber }))} />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.vendor.name}</TableCell>
                  <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(inv.totalAmount))}</TableCell>
                  <TableCell><Badge variant={inv.status === "PAID" ? "default" : "secondary"}>{inv.status.replace("_", " ")}</Badge></TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No invoices recorded yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
