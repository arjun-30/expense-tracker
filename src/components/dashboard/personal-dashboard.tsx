import Link from "next/link";
import { Send, Clock, CheckCircle2, Wallet, XCircle, Eye, X, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusCard } from "@/components/dashboard/status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate, formatINR } from "@/lib/format";
import type { Prisma } from "@/generated/prisma/client";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { getExpenseStatusCounts, getRecentExpenses, type PersonalDashboardStatus } from "@/lib/services/dashboard";

// 10 for the unfiltered "recent across everything" overview; a status filter
// means the viewer has drilled into one category specifically, so a somewhat
// higher cap is more useful there without needing full pagination — see the
// Option A vs. B investigation in this task's report for why this stays a
// capped list rather than growing into a second paginated /expenses.
const RECENT_EXPENSES_LIMIT = 10;
const FILTERED_EXPENSES_LIMIT = 20;

const STATUS_CARDS: { status: PersonalDashboardStatus; label: string; icon: LucideIcon; tone?: "destructive" | "success" }[] = [
  { status: "SUBMITTED", label: "Submitted", icon: Send },
  { status: "REVIEWED", label: "Reviewed", icon: CheckCircle2 },
  { status: "APPROVAL_PENDING", label: "Approval Pending", icon: Clock },
  { status: "PAID", label: "Paid", icon: Wallet, tone: "success" },
  { status: "REJECTED", label: "Rejected", icon: XCircle, tone: "destructive" },
];

/** Personal dashboard for EMPLOYEE (own expenses) and PURCHASE_MANAGER/
 * MAINTENANCE_MANAGER/TRANSPORT_MANAGER (department expenses) — one component,
 * parameterized by `where` (built by the caller via expenseVisibilityWhere) and
 * `scopeLabel`, since both cases need identical status cards, Recent Expenses
 * table, and click-through behavior; only the data scope and copy differ.
 *
 * Clicking a status card sets ?status= on this same page (see dashboard/page.tsx)
 * rather than navigating to /expenses — `statusFilter`, once present, narrows
 * the Recent Expenses table in place instead of showing a separate list. */
export async function PersonalDashboard({
  where,
  scopeLabel,
  statusFilter,
}: {
  where: Prisma.ExpenseWhereInput;
  scopeLabel: string;
  statusFilter?: ExpenseStatus;
}) {
  // Card counts always reflect the true, unfiltered totals — only the Recent
  // Expenses table below narrows by statusFilter, so clicking one card never
  // makes the other four appear to drop to zero.
  const listWhere = statusFilter ? { ...where, status: statusFilter } : where;
  const limit = statusFilter ? FILTERED_EXPENSES_LIMIT : RECENT_EXPENSES_LIMIT;

  const [counts, recent] = await Promise.all([
    getExpenseStatusCounts(where),
    getRecentExpenses(listWhere, limit),
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
          <StatusCard
            key={s.status}
            label={s.label}
            count={counts[s.status]}
            icon={s.icon}
            href={`/dashboard?status=${s.status}`}
            tone={s.tone}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {statusFilter ? `${EXPENSE_STATUS_LABELS[statusFilter]} Expenses` : "Recent Expenses"}
          </CardTitle>
          {statusFilter && (
            <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
              <X className="h-3.5 w-3.5" /> Clear filter
            </Link>
          )}
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
                    {statusFilter ? `No ${EXPENSE_STATUS_LABELS[statusFilter].toLowerCase()} expenses.` : "No expenses yet."}
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
