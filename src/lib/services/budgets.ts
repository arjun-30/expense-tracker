import "server-only";
import { prisma } from "@/lib/db";
import { budgetVariance, budgetUtilizationRatio } from "@/lib/services/calculations";

export async function getBudgetsWithActuals() {
  const budgets = await prisma.budget.findMany({
    include: { department: true, category: true, costCenter: true },
    orderBy: { periodStart: "desc" },
  });

  const rows = [];
  for (const b of budgets) {
    const actual = await prisma.expense.aggregate({
      where: {
        status: { in: ["APPROVED", "PAID"] },
        date: { gte: b.periodStart, lte: b.periodEnd },
        ...(b.departmentId ? { departmentId: b.departmentId } : {}),
        ...(b.categoryId ? { categoryId: b.categoryId } : {}),
        ...(b.costCenterId ? { costCenterId: b.costCenterId } : {}),
      },
      _sum: { totalAmount: true },
    });
    const actualAmount = Number(actual._sum?.totalAmount ?? 0);
    const amount = Number(b.amount);
    rows.push({
      id: b.id,
      name: b.name,
      scope: b.department?.name ?? b.category?.name ?? b.costCenter?.name ?? "Company-wide",
      period: b.period,
      periodStart: b.periodStart,
      periodEnd: b.periodEnd,
      amount,
      actual: actualAmount,
      variance: budgetVariance(amount, actualAmount),
      utilization: budgetUtilizationRatio(amount, actualAmount),
    });
  }
  return rows;
}
