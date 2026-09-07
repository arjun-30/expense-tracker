import Link from "next/link";
import { Send, Clock, CheckCircle2, Wallet, XCircle, Eye } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/dashboard/status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate, formatINR } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import { getExpenseStatusCounts, getRecentExpenses } from "@/lib/services/dashboard";

const RECENT_EXPENSES_LIMIT = 10;

const STATUS_CARDS = [
  { status: "SUBMITTED", label: "Submitted", icon: Send },
  { status: "APPROVAL_PENDING", label: "Approval Pending", icon: Clock, highlight: true },
  { status: "REVIEWED", label: "Reviewed", icon: CheckCircle2 },
  { status: "PAID", label: "Paid", icon: Wallet },
  { status: "REJECTED", label: "Rejected", icon: XCircle },
] as const;

/** Personal dashboard for EMPLOYEE (own expenses) and PURCHASE_MANAGER/
 * MAINTENANCE_MANAGER/TRANSPORT_MANAGER (department expenses) — one component,
 * parameterized by `where` (built by the caller via expenseVisibilityWhere) and
 * `scopeLabel`, since both cases need identical status cards, Recent Expenses
 * table, and click-through-to-filtered-list behavior; only the data scope and
 * copy differ. */
export async function PersonalDashboard({
  where,
  scopeLabel,
}: {
  where: Prisma.ExpenseWhereInput;
  scopeLabel: string;
}) {
  const [counts, recent] = await Promise.all([
    getExpenseStatusCounts(where),
    getRecentExpenses(where, RECENT_EXPENSES_LIMIT),
  ]);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Overview of ${scopeLabel}`}
        action={
          <Button asChild variant="secondary">
            <Link href="/expenses">View All Expenses</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS_CARDS.map((s) => (
          <StatusCard key={s.status} label={s.label} count={counts[s.status]} icon={s.icon} status={s.status} highlight={"highlight" in s && s.highlight} />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invoice/Bill</TableHead>
                <TableHead>View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.expenseNumber}</TableCell>
                  <TableCell>{formatDate(e.expenseDate)}</TableCell>
                  <TableCell>{e.category.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(Number(e.totalAmount))}</TableCell>
                  <TableCell>
                    <Badge variant={EXPENSE_STATUS_VARIANT[e.status]}>{EXPENSE_STATUS_LABELS[e.status]}</Badge>
                  </TableCell>
                  <TableCell>
                    {e.attachments[0] ? (
                      <a
                        href={`/api/files/${e.attachments[0].storageKey}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                        title="View bill"
                      >
                        <Eye className="h-4 w-4" /> View Bill
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">No Bill</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Link href={`/expenses/${e.id}`} className="text-sm text-primary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No expenses yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
