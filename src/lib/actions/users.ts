"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireRole } from "@/lib/rbac";
import { Role } from "@/generated/prisma/enums";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import type { ActionResult } from "@/lib/actions/expenses";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.nativeEnum(Role),
  departmentId: z.string().optional().nullable(),
});
export type UserInput = z.infer<typeof userSchema>;

export async function createUserAction(input: UserInput): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [Role.SUPER_ADMIN]);
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { success: false, error: "A user with this email already exists" };

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email, passwordHash, role: data.role, departmentId: data.departmentId || null },
  });

  await audit({ userId: session.sub, action: "CREATE", module: "users", recordId: user.id, newValue: { name: user.name, email: user.email, role: user.role } });
  revalidatePath("/users");
  return { success: true, id: user.id };
}

export async function updateUserRoleAction(userId: string, role: Role, departmentId: string | null): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [Role.SUPER_ADMIN]);

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { success: false, error: "User not found" };

  const updated = await prisma.user.update({ where: { id: userId }, data: { role, departmentId } });
  await audit({ userId: session.sub, action: "UPDATE_ROLE", module: "users", recordId: userId, oldValue: { role: existing.role }, newValue: { role: updated.role } });
  revalidatePath("/users");
  return { success: true, id: userId };
}

export async function toggleUserActiveAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireSession();
  requireRole(session, [Role.SUPER_ADMIN]);
  if (userId === session.sub) return { success: false, error: "You cannot deactivate your own account" };

  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  await audit({ userId: session.sub, action: isActive ? "ACTIVATE" : "DEACTIVATE", module: "users", recordId: userId });
  revalidatePath("/users");
  return { success: true };
}
