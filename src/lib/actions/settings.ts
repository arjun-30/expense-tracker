"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

const SETTINGS_PERMISSIONS = ["settings.manage"];

async function requireSettingsAccess() {
  const session = await requireSession();
  requirePermission(session, SETTINGS_PERMISSIONS);
  return session;
}

export async function createDepartmentAction(name: string, code: string): Promise<ActionResult> {
  const session = await requireSettingsAccess();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const dept = await prisma.department.create({ data: { ...parsed.data, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Department", entityId: dept.id, newValue: dept });
  revalidatePath("/settings");
  return { success: true, id: dept.id };
}

export async function createCostCenterAction(name: string, code: string, departmentId: string | null): Promise<ActionResult> {
  const session = await requireSettingsAccess();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const cc = await prisma.costCenter.create({ data: { ...parsed.data, departmentId, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "CostCenter", entityId: cc.id, newValue: cc });
  revalidatePath("/settings");
  return { success: true, id: cc.id };
}

// Categories are always top-level now — nesting is at most 2 levels
// (category -> subcategory), modeled as two separate flat tables
// (OPEN_DECISIONS.md #3). Use createSubcategoryAction for the second level.
export async function createCategoryAction(name: string, code: string): Promise<ActionResult> {
  const session = await requireSettingsAccess();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1) }).safeParse({ name, code });
  if (!parsed.success) return { success: false, error: "Name and code are required" };

  const cat = await prisma.expenseCategory.create({ data: { ...parsed.data, companyId: session.companyId } });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "ExpenseCategory", entityId: cat.id, newValue: cat });
  revalidatePath("/settings");
  return { success: true, id: cat.id };
}

export async function createSubcategoryAction(name: string, code: string, categoryId: string): Promise<ActionResult> {
  const session = await requireSettingsAccess();
  const parsed = z.object({ name: z.string().min(1), code: z.string().min(1), categoryId: z.string().min(1) }).safeParse({ name, code, categoryId });
  if (!parsed.success) return { success: false, error: "Name, code, and parent category are required" };

  const sub = await prisma.expenseSubcategory.create({ data: parsed.data });
  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "ExpenseSubcategory", entityId: sub.id, newValue: sub });
  revalidatePath("/settings");
  return { success: true, id: sub.id };
}

export async function toggleNotificationRuleAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireSettingsAccess();
  await prisma.notificationRule.update({ where: { id }, data: { isActive } });
  await audit({ companyId: session.companyId, userId: session.sub, action: isActive ? "ENABLE_RULE" : "DISABLE_RULE", entityType: "NotificationRule", entityId: id });
  revalidatePath("/settings");
  return { success: true };
}
