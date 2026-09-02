import "server-only";
import { prisma } from "@/lib/db";

/**
 * Centralized roles/permissions lookup — the single place that walks
 * user -> user_roles -> roles -> role_permissions -> permissions. Replaces
 * the old scalar `User.role` enum checks throughout the app now that a user
 * can hold more than one role.
 *
 * Called once at login (see src/lib/actions/auth.ts); the resolved role
 * names and permission codes are then cached in the session JWT so request
 * handlers check against `session.roles`/`session.permissions` instead of
 * re-querying the database on every request.
 */
export interface RolesAndPermissions {
  roles: string[];
  roleIds: string[];
  permissions: string[];
}

export async function loadRolesAndPermissions(userId: string): Promise<RolesAndPermissions> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
  });

  const roles = userRoles.map((ur) => ur.role.name);
  const roleIds = userRoles.map((ur) => ur.roleId);
  const permissions = Array.from(
    new Set(userRoles.flatMap((ur) => ur.role.rolePermissions.map((rp) => rp.permission.code)))
  );

  return { roles, roleIds, permissions };
}

/** True if `ctx` holds any of the given role names. */
export function hasRole(ctx: { roles: string[] }, ...roleNames: string[]): boolean {
  return roleNames.some((r) => ctx.roles.includes(r));
}

/** True if `ctx` was granted any of the given permission codes (via any role it holds). */
export function hasPermission(ctx: { permissions: string[] }, ...codes: string[]): boolean {
  return codes.some((c) => ctx.permissions.includes(c));
}
