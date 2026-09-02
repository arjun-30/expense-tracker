import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentFormDialog } from "@/components/purchases/payment-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function PaymentsPage() {
  const { session, allowed } = await guardModule("payments");
  if (!allowed) return <AccessRestricted />;

  const [payments, vendors, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { companyId: session.companyId }, include: { vendor: true, expense: true }, orderBy: { paymentDate: "desc" }, take: 100 }),
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({ where: { companyId: session.companyId, vendorId: { not: null } }, include: { payments: true }, orderBy: { expenseDate: "desc" }, take: 200 }),
  ]);

  const canRecord = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ACCOUNTS);

  const expenseOptions = expenses.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    vendorId: e.vendorId!,
    totalAmount: Number(e.totalAmount),
    paidAmount: e.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0),
  }));

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Vendor payments and settlement status"
        action={canRecord ? <PaymentFormDialog vendors={vendors} expenses={expenseOptions} /> : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Expense</TableHead>
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
                <TableCell>{p.expense?.expenseNumber ?? "—"}</TableCell>
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
