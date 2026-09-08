import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { isAdminRole, expenseVisibilityWhere } from "@/lib/rbac";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExpenseRow } from "@/components/expenses/expense-row";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EXPENSE_STATUS_LABELS, VALID_EXPENSE_STATUSES } from "@/lib/status-labels";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { parseFilterParam } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 20;
// APPROVED is a legacy status with no active workflow (no transition ever
// assigns or leaves it in the current TRANSITIONS state machine — it only
// ever appears on historical records predating the invoice-based workflow
// replacement). Excluded from the filter dropdown only; EXPENSE_STATUS_LABELS
// itself stays complete so any such record still renders a correct badge.
const FILTERABLE_STATUS_ENTRIES = Object.entries(EXPENSE_STATUS_LABELS).filter(([value]) => value !== "APPROVED");

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

      <form className="mb-4 flex flex-wrap items-center gap-2" method="get">
        <Input name="q" placeholder="Search expense #, description…" defaultValue={q} className="w-64" />
        <Select name="status" defaultValue={status ?? "all"}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {FILTERABLE_STATUS_ENTRIES.map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {admin && (
          <Select name="department" defaultValue={departmentId ?? "all"}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

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
