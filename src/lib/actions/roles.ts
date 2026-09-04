"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { audit } from "@/lib/audit";
import type { ActionResult } from "@/lib/actions/expenses";

const ROLES_PERMISSIONS = ["roles.manage"];
const VALID_PERMISSION_CODES = new Set(PERMISSIONS.map((p) => p.code));

async function requireRolesAccess() {
  const session = await requireSession();
  requirePermission(session, ROLES_PERMISSIONS);
  return session;
}

function isPrismaErrorCode(err: unknown, code: string): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === code;
}

const roleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().optional().nullable(),
});
export type RoleInput = z.infer<typeof roleSchema>;

export async function createRoleAction(input: RoleInput): Promise<ActionResult> {
  const session = await requireRolesAccess();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    // Custom roles created here are never system roles — isSystemRole is
    // reserved for the 7 starter roles seeded per company.
    const role = await prisma.role.create({
      data: {
        companyId: session.companyId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isSystemRole: false,
      },
    });
    await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Role", entityId: role.id, newValue: role });
    revalidatePath("/roles");
    return { success: true, id: role.id };
  } catch (err) {
    if (isPrismaErrorCode(err, "P2002")) return { success: false, error: "A role with this name already exists" };
    throw err;
  }
}

export async function updateRoleAction(id: string, input: RoleInput): Promise<ActionResult> {
  const session = await requireRolesAccess();
  const parsed = roleSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const existing = await prisma.role.findFirst({ where: { id, companyId: session.companyId } });
  if (!existing) return { success: false, error: "Role not found" };

  // A system role's name is load-bearing: hasRole()/isAdminRole()/MODULE_ACCESS
  // and prisma/seed.ts all match roles by this exact string. Renaming one here
  // would silently break every permission check for everyone who holds it.
  if (existing.isSystemRole && parsed.data.name !== existing.name) {
    return { success: false, error: "System role names cannot be changed" };
  }

  try {
    const role = await prisma.role.update({
      where: { id },
      data: { name: parsed.data.name, description: parsed.data.description || null },
    });
    await audit({ companyId: session.companyId, userId: session.sub, action: "UPDATE", entityType: "Role", entityId: id, oldValue: existing, newValue: role });
    revalidatePath("/roles");
    revalidatePath(`/roles/${id}`);
    return { success: true, id };
  } catch (err) {
    if (isPrismaErrorCode(err, "P2002")) return { success: false, error: "A role with this name already exists" };
    throw err;
  }
}

export async function updateRolePermissionsAction(id: string, permissionCodes: string[]): Promise<ActionResult> {
  const session = await requireRolesAccess();
  const role = await prisma.role.findFirst({
    where: { id, companyId: session.companyId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) return { success: false, error: "Role not found" };

  const currentCodes = role.rolePermissions.map((rp) => rp.permission.code);
  const requestedCodes = Array.from(new Set(permissionCodes)).filter((c) => VALID_PERMISSION_CODES.has(c));
  const permissions = await prisma.permission.findMany({ where: { code: { in: requestedCodes } } });
  const permissionIdByCode = new Map(permissions.map((p) => [p.code, p.id]));
  const resolvedCodes = requestedCodes.filter((c) => permissionIdByCode.has(c));

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: id } }),
    prisma.rolePermission.createMany({
      data: resolvedCodes.map((code) => ({ roleId: id, permissionId: permissionIdByCode.get(code)! })),
    }),
  ]);

  await audit({
    companyId: session.companyId,
    userId: session.sub,
    action: "UPDATE_PERMISSIONS",
    entityType: "Role",
    entityId: id,
    oldValue: { permissions: currentCodes },
    newValue: { permissions: resolvedCodes },
  });
  revalidatePath(`/roles/${id}`);
  revalidatePath("/roles");
  return { success: true, id };
}

export async function deleteRoleAction(id: string): Promise<ActionResult> {
  const session = await requireRolesAccess();
  const role = await prisma.role.findFirst({
    where: { id, companyId: session.companyId },
    include: { _count: { select: { userRoles: true } } },
  });
  if (!role) return { success: false, error: "Role not found" };
  if (role.isSystemRole) return { success: false, error: "System roles cannot be deleted" };
  if (role._count.userRoles > 0) {
    const n = role._count.userRoles;
    return { success: false, error: `Cannot delete: ${n} user${n === 1 ? "" : "s"} currently hold this role` };
  }

  try {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: id } }),
      prisma.role.delete({ where: { id } }),
    ]);
  } catch (err) {
    // Defensive fallback — e.g. an approval rule or historical notification
    // still referencing this role — rather than letting a raw DB error surface.
    if (isPrismaErrorCode(err, "P2003")) {
      return { success: false, error: "Cannot delete: this role is still referenced elsewhere" };
    }
    throw err;
  }

  await audit({ companyId: session.companyId, userId: session.sub, action: "DELETE", entityType: "Role", entityId: id, oldValue: { name: role.name } });
  revalidatePath("/roles");
  return { success: true };
}
