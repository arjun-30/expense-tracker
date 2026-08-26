"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

async function requireSuperAdmin() {
  const session = await requireSession();
  requireRole(session, [Role.SUPER_ADMIN]);
  return session;
}

export async function createDepartmentAction(name: string, code: string): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const dept = await prisma.department.create({ data: parsed.data });
  await audit({ userId: session.sub, action: "CREATE", module: "settings", recordId: dept.id, newValue: dept });
  revalidatePath("/settings");
  return { success: true, id: dept.id };
}

export async function createCostCenterAction(name: string, code: string, departmentId: string | null): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const cc = await prisma.costCenter.create({ data: { ...parsed.data, departmentId } });
  await audit({ userId: session.sub, action: "CREATE", module: "settings", recordId: cc.id, newValue: cc });
  revalidatePath("/settings");
  return { success: true, id: cc.id };
}

export async function createCategoryAction(name: string, code: string, parentId: string | null): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const cat = await prisma.expenseCategory.create({ data: { ...parsed.data, parentId } });
  await audit({ userId: session.sub, action: "CREATE", module: "settings", recordId: cat.id, newValue: cat });
  revalidatePath("/settings");
  return { success: true, id: cat.id };
}

export async function toggleAlertRuleAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireSuperAdmin();
  await prisma.alertRule.update({ where: { id }, data: { isActive } });
  await audit({ userId: session.sub, action: isActive ? "ENABLE_RULE" : "DISABLE_RULE", module: "settings", recordId: id });
  revalidatePath("/settings");
  return { success: true };
}
