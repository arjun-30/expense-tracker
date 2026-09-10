import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { isAdminRole, expenseVisibilityWhere } from "@/lib/rbac";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { ExpenseFilters } from "@/components/expenses/expense-filters";
import { DataTablePagination } from "@/components/data-table-pagination";
import { VALID_EXPENSE_STATUSES } from "@/lib/status-labels";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { parseFilterParam } from "@/lib/utils";

const PAGE_SIZE = 20;

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session, allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const q = sp.q?.trim();
  // "all" (the Select's default option) and any other value that isn't a real
  // ExpenseStatus mean "no filter" — never pass an invalid value to Prisma.
  const rawStatus = parseFilterParam(sp.status);
  const status = rawStatus && VALID_EXPENSE_STATUSES.has(rawStatus) ? (rawStatus as ExpenseStatus) : undefined;
  const admin = isAdminRole(session);
  // Non-admins can only ever filter within what they're already scoped to see —
  // ignore any ?department= param they might pass to probe other departments.
  const departmentId = admin ? parseFilterParam(sp.department) : undefined;

  const where = {
    companyId: session.companyId,
    ...expenseVisibilityWhere(session),
    ...(status ? { status } : {}),
    ...(departmentId ? { departmentId } : {}),
    ...(q
      ? {
          OR: [
            { expenseNumber: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { referenceNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [expenses, total, departments] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: {
        category: true,
        department: true,
        vendor: true,
        employee: true,
        attachments: { where: { attachmentType: "INVOICE" }, take: 1 },
      },
      orderBy: { expenseDate: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.expense.count({ where }),
    admin ? prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={
          admin
            ? "All company expenses across departments"
            : hasRole(session, ROLES.EMPLOYEE)
              ? "Your expenses"
              : "Expenses for your department"
        }
        action={
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="h-4 w-4" /> New Expense
            </Link>
          </Button>
        }
      />

      <ExpenseFilters
        admin={admin}
        departments={departments}
        initialQuery={q ?? ""}
        initialStatus={status ?? "all"}
        initialDepartment={departmentId ?? "all"}
      />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense #</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invoice/Bill</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                id={e.id}
                expenseNumber={e.expenseNumber}
                expenseDate={e.expenseDate}
                categoryName={e.category.name}
                vendorName={e.vendor?.name ?? null}
                departmentName={e.department.name}
                employeeName={e.employee.name}
                totalAmount={Number(e.totalAmount)}
                status={e.status}
                billStorageKey={e.attachments[0]?.storageKey ?? null}
              />
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No expenses found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination basePath="/expenses" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </div>
  );
}
