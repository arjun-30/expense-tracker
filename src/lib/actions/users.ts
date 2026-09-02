"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { ROLES } from "@/lib/rbac-client";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import type { ActionResult } from "@/lib/actions/expenses";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Role is required"),
  departmentId: z.string().optional().nullable(),
});
export type UserInput = z.infer<typeof userSchema>;

export async function createUserAction(input: UserInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { success: false, error: "A user with this email already exists" };

  const role = await prisma.role.findFirst({ where: { id: data.roleId, companyId: session.companyId } });
  if (!role) return { success: false, error: "Role not found" };

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      companyId: session.companyId,
      departmentId: data.departmentId || null,
      userRoles: { create: { roleId: role.id } },
    },
  });

  await audit({
    companyId: session.companyId,
    userId: session.sub,
    action: "CREATE",
    entityType: "User",
    entityId: user.id,
    newValue: { name: user.name, email: user.email, role: role.name },
  });
  revalidatePath("/users");
  return { success: true, id: user.id };
}

/** Replaces the user's single role assignment with `roleId` (the UI only offers a
 * one-role-at-a-time picker today, even though `user_roles` supports more). */
export async function updateUserRoleAction(userId: string, roleId: string, departmentId: string | null): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);

  const existing = await prisma.user.findUnique({ where: { id: userId }, include: { userRoles: { include: { role: true } } } });
  if (!existing) return { success: false, error: "User not found" };

  const role = await prisma.role.findFirst({ where: { id: roleId, companyId: session.companyId } });
  if (!role) return { success: false, error: "Role not found" };

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId } }),
    prisma.userRole.create({ data: { userId, roleId } }),
    prisma.user.update({ where: { id: userId }, data: { departmentId } }),
  ]);

  await audit({
    companyId: session.companyId,
    userId: session.sub,
    action: "UPDATE_ROLE",
    entityType: "User",
    entityId: userId,
    oldValue: { roles: existing.userRoles.map((ur) => ur.role.name) },
    newValue: { role: role.name },
  });
  revalidatePath("/users");
  return { success: true, id: userId };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [ROLES.SUPER_ADMIN]);
  if (userId === session.sub) return { success: false, error: "You cannot deactivate your own account" };

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await audit({
    companyId: session.companyId,
    userId: session.sub,
    action: isActive ? "ACTIVATE" : "DEACTIVATE",
    entityType: "User",
    entityId: userId,
  });
  revalidatePath("/users");
  return { success: true };
}
