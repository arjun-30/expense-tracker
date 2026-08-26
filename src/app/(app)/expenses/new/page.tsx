import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function NewExpensePage() {
  const { allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const [categories, departments, costCenters, vendors] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New Expense" description="Create a new expense record (saved as draft)" />
      <ExpenseForm refData={{ categories, departments, costCenters, vendors }} />
    </div>
  );
}
