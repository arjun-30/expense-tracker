import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentFormDialog } from "@/components/purchases/payment-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";

export default async function PaymentsPage() {
  const { session, allowed } = await guardModule("payments");
  if (!allowed) return <AccessRestricted />;

  const [payments, vendors, invoices] = await Promise.all([
    prisma.payment.findMany({ include: { vendor: true, invoice: true }, orderBy: { paymentDate: "desc" }, take: 100 }),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({ include: { payments: true } }),
  ]);

  const canRecord: Role[] = [Role.SUPER_ADMIN, Role.ACCOUNTS];

  const invoiceOptions = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    vendorId: i.vendorId,
    totalAmount: Number(i.totalAmount),
    paidAmount: i.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0),
  }));

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Vendor payments and settlement status"
        action={canRecord.includes(session.role) ? <PaymentFormDialog vendors={vendors} invoices={invoiceOptions} /> : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.paymentNumber}</TableCell>
                <TableCell>{p.vendor.name}</TableCell>
                <TableCell>{p.invoice?.invoiceNumber ?? "—"}</TableCell>
                <TableCell>{formatDate(p.paymentDate)}</TableCell>
                <TableCell>{p.method.replace("_", " ")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(p.amount))}</TableCell>
                <TableCell><Badge variant={p.status === "PAID" ? "default" : "secondary"}>{p.status.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No payments recorded yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
