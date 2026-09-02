import "server-only";
import { prisma } from "@/lib/db";
import { notify } from "@/lib/notify";
import { actualSpendForAllocation } from "@/lib/services/budgets";
import { budgetUtilizationRatio } from "@/lib/services/calculations";
import { NotificationSeverity } from "@/generated/prisma/enums";
import { ROLES } from "@/lib/rbac-client";

/** Re-checks budget allocations covering (departmentId, categoryId, costCenterId, date) after
 * an expense moves to APPROVED/PAID and notifies Admins at the configured 80% warning /
 * 100% critical thresholds (§25, §44 budget_warning / budget_exceeded rules). */
export async function checkBudgetThresholds(params: {
  companyId: string;
  departmentId: string;
  categoryId: string;
  costCenterId?: string | null;
  date: Date;
}) {
  const warningThreshold = Number(process.env.BUDGET_WARNING_THRESHOLD ?? "0.8");
  const criticalThreshold = Number(process.env.BUDGET_CRITICAL_THRESHOLD ?? "1.0");

  const allocations = await prisma.budgetAllocation.findMany({
    where: {
      budget: { companyId: params.companyId, periodStart: { lte: params.date }, periodEnd: { gte: params.date } },
      OR: [
        { departmentId: params.departmentId },
        { categoryId: params.categoryId },
        params.costCenterId ? { costCenterId: params.costCenterId } : {},
      ],
    },
    include: { budget: true },
  });

  for (const alloc of allocations) {
    const actualAmount = await actualSpendForAllocation(params.companyId, alloc, alloc.budget.periodStart, alloc.budget.periodEnd);
    const allocatedAmount = Number(alloc.allocatedAmount);
    const ratio = budgetUtilizationRatio(allocatedAmount, actualAmount);
    if (ratio === null) continue;

    if (ratio >= criticalThreshold) {
      await notify({
        companyId: params.companyId,
        roleName: ROLES.ADMIN,
        type: "budget_exceeded",
        severity: NotificationSeverity.CRITICAL,
        title: "Budget exceeded",
        message: `${alloc.budget.name} has exceeded its budget by ${formatOver(actualAmount - allocatedAmount)}.`,
        entityType: "Budget",
        entityId: alloc.budget.id,
      });
    } else if (ratio >= warningThreshold) {
      await notify({
        companyId: params.companyId,
        roleName: ROLES.ADMIN,
        type: "budget_warning",
        severity: NotificationSeverity.WARNING,
        title: "Budget nearing limit",
        message: `${alloc.budget.name} has used ${(ratio * 100).toFixed(0)}% of its allocated budget.`,
        entityType: "Budget",
        entityId: alloc.budget.id,
      });
    }
  }
}

function formatOver(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}
