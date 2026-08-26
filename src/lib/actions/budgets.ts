"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

const BUDGET_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTS];

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

export async function createBudgetAction(input: BudgetInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, BUDGET_ROLES);
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;
  if (data.periodEnd <= data.periodStart) return { success: false, error: "End date must be after start date" };

  const budget = await prisma.budget.create({
    data: { ...data, createdById: session.sub },
  });
  await audit({ userId: session.sub, action: "CREATE", module: "budgets", recordId: budget.id, newValue: budget });
  revalidatePath("/budgets");
  return { success: true, id: budget.id };
}
