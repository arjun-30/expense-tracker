import "server-only";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { budgetUtilizationRatio } from "@/lib/services/calculations";
import { Role, AlertSeverity, ExpenseStatus } from "@/generated/prisma/enums";

const FINALIZED: ExpenseStatus[] = [ExpenseStatus.APPROVED, ExpenseStatus.PAID];

/** Re-checks budgets covering (departmentId, categoryId, costCenterId, date) after an
 * expense moves to APPROVED/PAID and notifies Admins/Super Admins at the configured
 * 80% warning / 100% critical thresholds (§25, §44 budget_warning / budget_exceeded rules). */
export async function checkBudgetThresholds(params: {
  departmentId: string;
  categoryId: string;
  costCenterId?: string | null;
  date: Date;
}) {
  const warningThreshold = Number(process.env.BUDGET_WARNING_THRESHOLD ?? "0.8");
  const criticalThreshold = Number(process.env.BUDGET_CRITICAL_THRESHOLD ?? "1.0");

  const budgets = await prisma.budget.findMany({
    where: {
      periodStart: { lte: params.date },
      periodEnd: { gte: params.date },
      OR: [
        { departmentId: params.departmentId },
        { categoryId: params.categoryId },
        params.costCenterId ? { costCenterId: params.costCenterId } : {},
      ],
    },
  });

  for (const budget of budgets) {
    const actual = await prisma.expense.aggregate({
      where: {
        status: { in: FINALIZED },
        date: { gte: budget.periodStart, lte: budget.periodEnd },
        ...(budget.departmentId ? { departmentId: budget.departmentId } : {}),
        ...(budget.categoryId ? { categoryId: budget.categoryId } : {}),
        ...(budget.costCenterId ? { costCenterId: budget.costCenterId } : {}),
      },
      _sum: { totalAmount: true },
    });
    const actualAmount = Number(actual._sum?.totalAmount ?? 0);
    const ratio = budgetUtilizationRatio(Number(budget.amount), actualAmount);
    if (ratio === null) continue;

    if (ratio >= criticalThreshold) {
      await notify({
        role: Role.ADMIN,
        type: "budget_exceeded",
        severity: AlertSeverity.CRITICAL,
        title: "Budget exceeded",
        message: `${budget.name} has exceeded its budget by ${formatOver(actualAmount - Number(budget.amount))}.`,
        entityType: "Budget",
        entityId: budget.id,
      });
    } else if (ratio >= warningThreshold) {
      await notify({
        role: Role.ADMIN,
        type: "budget_warning",
        severity: AlertSeverity.WARNING,
        title: "Budget nearing limit",
        message: `${budget.name} has used ${(ratio * 100).toFixed(0)}% of its allocated budget.`,
        entityType: "Budget",
        entityId: budget.id,
      });
    }
  }
}

function formatOver(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
