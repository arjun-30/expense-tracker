"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

const BUDGET_PERMISSIONS = ["budgets.manage"];

const budgetSchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  period: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  amount: z.coerce.number().positive(),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

// Every budget is created as one parent `budgets` row with exactly one
// matching `budget_allocations` row underneath it (same department/category/
// cost center, same total amount) — confirmed sufficient, no multi-department
// budgets needed at this time (OPEN_DECISIONS.md #11).
export async function createBudgetAction(input: BudgetInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, BUDGET_PERMISSIONS);
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (data.periodEnd <= data.periodStart) return { success: false, error: "End date must be after start date" };

  const budget = await prisma.budget.create({
    data: {
      companyId: session.companyId,
      name: data.name,
      period: data.period,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      totalAmount: data.amount,
      createdById: session.sub,
      allocations: {
        create: {
          departmentId: data.departmentId || null,
          categoryId: data.categoryId || null,
          costCenterId: data.costCenterId || null,
          allocatedAmount: data.amount,
        },
      },
    },
  });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Budget", entityId: budget.id, newValue: budget });
  revalidatePath("/budgets");
  return { success: true, id: budget.id };
}
