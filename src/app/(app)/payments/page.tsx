import { IndianRupee, CheckCircle2, Clock, Building2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PaymentFormDialog } from "@/components/purchases/payment-form-dialog";
import { formatDate, formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function PaymentsPage() {
  const { session, allowed } = await guardModule("payments");
  if (!allowed) return <AccessRestricted />;

  const [payments, vendors, expenses, paidAgg, pendingCount, paidCount] = await Promise.all([
    prisma.payment.findMany({ where: { companyId: session.companyId }, include: { vendor: true, expense: true }, orderBy: { paymentDate: "desc" }, take: 100 }),
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.expense.findMany({ where: { companyId: session.companyId, vendorId: { not: null } }, include: { payments: true }, orderBy: { expenseDate: "desc" }, take: 200 }),
    prisma.payment.aggregate({ where: { companyId: session.companyId, status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.count({ where: { companyId: session.companyId, status: "PENDING" } }),
    prisma.payment.count({ where: { companyId: session.companyId, status: "PAID" } }),
  ]);

  const canRecord = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ACCOUNTS);
  const distinctVendorsPaid = new Set(payments.filter(p => p.status === "PAID").map(p => p.vendorId)).size;

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

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard label="Total Disbursed" value={Number(paidAgg._sum?.amount ?? 0)} icon={IndianRupee} subtext="Successfully paid" />
        <KpiCard
          label="Settled Payments"
          value={paidCount}
          icon={CheckCircle2}
          formatAsCurrency={false}
          subtext="Completed transactions"
        />
        <KpiCard
          label="Pending Settlement"
          value={pendingCount}
          icon={Clock}
          formatAsCurrency={false}
          subtext={pendingCount > 0 ? "Awaiting processing" : "All cleared"}
        />
        <KpiCard
          label="Vendors Paid"
          value={distinctVendorsPaid}
          icon={Building2}
          formatAsCurrency={false}
          subtext="Distinct suppliers"
        />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Expense</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Reference #</TableHead>
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
                <TableCell>{p.referenceNumber ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(p.amount))}</TableCell>
                <TableCell><Badge variant={p.status === "PAID" ? "success" : "secondary"}>{p.status.replace("_", " ")}</Badge></TableCell>
              </TableRow>
            ))}
            {payments.length === 0 && (
              <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No payments recorded yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
