import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const { id } = await params;
  const [expense, categories, departments, costCenters, vendors] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.expenseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
  ]);
  if (!expense) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${expense.expenseNumber}`} description="Only draft expenses can be edited" />
      <ExpenseForm
        expenseId={expense.id}
        refData={{ categories, departments, costCenters, vendors }}
        defaultValues={{
          date: expense.date.toISOString().slice(0, 10),
          categoryId: expense.categoryId,
          subcategoryId: expense.subcategoryId ?? undefined,
          amount: Number(expense.amount),
          taxAmount: Number(expense.taxAmount),
          discountAmount: Number(expense.discountAmount),
          vendorId: expense.vendorId ?? undefined,
          departmentId: expense.departmentId,
          costCenterId: expense.costCenterId ?? undefined,
          paymentMethod: expense.paymentMethod ?? undefined,
          description: expense.description ?? undefined,
          referenceNumber: expense.referenceNumber ?? undefined,
        }}
      />
    </div>
  );
}
