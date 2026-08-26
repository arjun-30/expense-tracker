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
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate, formatINR } from "@/lib/format";
import { Role, type ExpenseStatus } from "@/generated/prisma/enums";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const status = sp.status as ExpenseStatus | undefined;
  const admin = isAdminRole(session.role);
  // Non-admins can only ever filter within what they're already scoped to see —
  // ignore any ?department= param they might pass to probe other departments.
  const departmentId = admin ? sp.department : undefined;

  const where = {
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
      include: { category: true, department: true, vendor: true, employee: true },
      orderBy: { date: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.expense.count({ where }),
    admin ? prisma.department.findMany({ orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description={
          admin
            ? "All company expenses across departments"
            : session.role === Role.EMPLOYEE
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
            {Object.entries(EXPENSE_STATUS_LABELS).map(([value, label]) => (
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/expenses/${e.id}`} className="hover:underline">{e.expenseNumber}</Link>
                </TableCell>
                <TableCell>{formatDate(e.date)}</TableCell>
                <TableCell>{e.category.name}</TableCell>
                <TableCell>{e.vendor?.name ?? "—"}</TableCell>
                <TableCell>{e.department.name}</TableCell>
                <TableCell>{e.employee.name}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(Number(e.totalAmount))}</TableCell>
                <TableCell>
                  <Badge variant={EXPENSE_STATUS_VARIANT[e.status]}>{EXPENSE_STATUS_LABELS[e.status]}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
