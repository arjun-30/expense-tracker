import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { canViewExpense, isAdminRole } from "@/lib/rbac";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { session, allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const { id } = await params;
  const [expense, categories, subcategories, allDepartments, costCenters, vendors] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.expenseSubcategory.findMany({ where: { category: { companyId: session.companyId }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);
  if (!expense) notFound();
  if (!canViewExpense(session, expense)) return <AccessRestricted />;
  const departments = isAdminRole(session)
    ? allDepartments
    : allDepartments.filter((d) => d.id === session.departmentId);

  return (
    <div>
      <PageHeader title={`Edit ${expense.expenseNumber}`} description="Only draft expenses can be edited" />
      <ExpenseForm
        expenseId={expense.id}
        refData={{ categories, subcategories, departments, costCenters, vendors }}
        defaultValues={{
          date: expense.expenseDate.toISOString().slice(0, 10),
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
