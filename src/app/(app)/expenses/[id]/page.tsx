import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { canViewExpense } from "@/lib/rbac";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ExpenseActions } from "@/components/expenses/expense-actions";
import { ExpenseAttachments } from "@/components/expenses/expense-attachments";
import { getReviewedInfo, getVerifiedInfo } from "@/lib/expense-verification";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate, formatINR } from "@/lib/format";

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const { id } = await params;
  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      category: true,
      subcategory: true,
      vendor: true,
      department: true,
      costCenter: true,
      employee: true,
      attachments: { include: { uploadedBy: true }, orderBy: { uploadedAt: "desc" } },
      approvals: { include: { actedBy: true }, orderBy: { actedAt: "asc" } },
    },
  });
  if (!expense) notFound();

  if (!canViewExpense(session, expense)) {
    return <AccessRestricted />;
  }

  const isOwner = expense.employeeId === session.sub;
  const canEditAttachments = expense.status !== "PAID" && expense.status !== "CANCELLED";
  const approvalsForHistory = expense.approvals.map((a) => ({ action: a.action, actedAt: a.actedAt, actedByName: a.actedBy.name }));
  const reviewedInfo = getReviewedInfo(approvalsForHistory);
  const verifiedInfo = getVerifiedInfo(approvalsForHistory);

  return (
    <div>
      <PageHeader
        title={expense.expenseNumber}
        description={expense.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={EXPENSE_STATUS_VARIANT[expense.status]} className="text-sm">
              {EXPENSE_STATUS_LABELS[expense.status]}
            </Badge>
            {expense.status === "DRAFT" && (isOwner || session.roles.some((r) => ["SUPER_ADMIN", "ADMIN"].includes(r))) && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/expenses/${expense.id}/edit`}><Pencil className="h-4 w-4" /> Edit</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent>
            <DetailRow label="Date" value={formatDate(expense.expenseDate)} />
            <DetailRow label="Category" value={expense.subcategory ? `${expense.category.name} / ${expense.subcategory.name}` : expense.category.name} />
            <DetailRow label="Department" value={expense.department.name} />
            <DetailRow label="Cost Center" value={expense.costCenter?.name ?? "—"} />
            <DetailRow label="Vendor" value={expense.vendor?.name ?? "—"} />
            <DetailRow label="Employee" value={expense.employee.name} />
            <DetailRow label="Amount" value={formatINR(Number(expense.amount))} />
            <DetailRow label="Tax / GST" value={formatINR(Number(expense.taxAmount))} />
            <DetailRow label="Discount" value={formatINR(Number(expense.discountAmount))} />
            <DetailRow label="Total" value={<span className="text-base">{formatINR(Number(expense.totalAmount))}</span>} />
            <DetailRow label="Payment Method" value={expense.paymentMethod ?? "—"} />
            <DetailRow label="Reference #" value={expense.referenceNumber ?? "—"} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
            <CardContent>
              <ExpenseActions
                expenseId={expense.id}
                status={expense.status}
                roles={session.roles}
                permissions={session.permissions}
                isOwner={isOwner}
                reviewedInfo={reviewedInfo ? { byName: reviewedInfo.byName, at: new Date(reviewedInfo.at).toISOString() } : null}
                verifiedInfo={verifiedInfo ? { byName: verifiedInfo.byName, at: new Date(verifiedInfo.at).toISOString() } : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Bills & Invoices</CardTitle></CardHeader>
            <CardContent>
              <ExpenseAttachments
                expenseId={expense.id}
                canEdit={canEditAttachments}
                attachments={expense.attachments.map((a) => ({ ...a, fileSizeBytes: a.fileSizeBytes !== null ? Number(a.fileSizeBytes) : null, uploadedAt: a.uploadedAt.toISOString() }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Approval History</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {expense.approvals.map((a) => (
                  <li key={a.id} className="text-sm">
                    <p className="font-medium">{a.action.charAt(0) + a.action.slice(1).toLowerCase()}</p>
                    <p className="text-muted-foreground">{a.actedBy.name} — {formatDate(a.actedAt)}</p>
                    {a.remarks && <p className="mt-1 rounded bg-muted px-2 py-1 text-xs">{a.remarks}</p>}
                    <Separator className="mt-3" />
                  </li>
                ))}
                {expense.approvals.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
