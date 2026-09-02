import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { isAdminRole } from "@/lib/rbac";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "@/components/expenses/expense-form";

export default async function NewExpensePage() {
  const { session, allowed } = await guardModule("expenses");
  if (!allowed) return <AccessRestricted />;

  const [categories, subcategories, allDepartments, costCenters, vendors] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.expenseSubcategory.findMany({ where: { category: { companyId: session.companyId }, isActive: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { companyId: session.companyId, isActive: true }, orderBy: { name: "asc" } }),
  ]);
  const departments = isAdminRole(session)
    ? allDepartments
    : allDepartments.filter((d) => d.id === session.departmentId);

  return (
    <div>
      <PageHeader title="New Expense" description="Create a new expense record (saved as draft)" />
      <ExpenseForm refData={{ categories, subcategories, departments, costCenters, vendors }} />
    </div>
  );
}
