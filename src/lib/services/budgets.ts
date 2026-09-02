import "server-only";
import { prisma } from "@/lib/db";
import { budgetVariance, budgetUtilizationRatio } from "@/lib/services/calculations";
import { ExpenseStatus } from "@/generated/prisma/enums";

const FINALIZED: ExpenseStatus[] = [ExpenseStatus.APPROVED, ExpenseStatus.PAID];

export interface BudgetAllocationScope {
  departmentId: string | null;
  categoryId: string | null;
  costCenterId: string | null;
}

/** Sum of finalized expenses matching one budget allocation's scope within its period. */
export async function actualSpendForAllocation(
  companyId: string,
  scope: BudgetAllocationScope,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const actual = await prisma.expense.aggregate({
    where: {
      companyId,
      status: { in: FINALIZED },
      expenseDate: { gte: periodStart, lte: periodEnd },
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      ...(scope.categoryId ? { categoryId: scope.categoryId } : {}),
      ...(scope.costCenterId ? { costCenterId: scope.costCenterId } : {}),
    },
    _sum: { totalAmount: true },
  });
  return Number(actual._sum?.totalAmount ?? 0);
}

export async function getBudgetsWithActuals(companyId: string) {
  const budgets = await prisma.budget.findMany({
    where: { companyId },
    include: { allocations: { include: { department: true, category: true, costCenter: true } } },
    orderBy: { periodStart: "desc" },
  });

  const rows = [];
  for (const b of budgets) {
    let actual = 0;
    for (const alloc of b.allocations) {
      actual += await actualSpendForAllocation(companyId, alloc, b.periodStart, b.periodEnd);
    }
    const amount = Number(b.totalAmount);
    // A budget can legitimately have zero allocations (or an allocation
    // scoped to none of department/category/cost center) — fall through to
    // "Company-wide" explicitly rather than letting an empty array silently
    // produce `undefined` through unguarded indexing.
    const [firstAllocation] = b.allocations;
    const scope = firstAllocation
      ? (firstAllocation.department?.name ?? firstAllocation.category?.name ?? firstAllocation.costCenter?.name ?? "Company-wide")
      : "Company-wide";
    rows.push({
      id: b.id,
      name: b.name,
      scope,
      period: b.period,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      amount,
      actual,
      variance: budgetVariance(amount, actual),
      utilization: budgetUtilizationRatio(amount, actual),
    });
  }
  return rows;
}
