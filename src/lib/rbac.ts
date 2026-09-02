import "server-only";
import type { SessionPayload } from "@/lib/session";
import { hasRole, hasPermission } from "@/lib/auth/permissions";
import { ROLES, MODULE_ACCESS, ALL_ROLES, canAccessModuleClient } from "@/lib/rbac-client";

/** Only SUPER_ADMIN and ADMIN can see expenses across every department. */
export function isAdminRole(session: { roles: string[] }): boolean {
  return hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN);
}

/** Prisma `where` clause restricting expense visibility to what `session` is allowed to see:
 * admins see everything, employees see only their own expenses, everyone else is
 * scoped to their own department. */
export function expenseVisibilityWhere(session: SessionPayload) {
  if (isAdminRole(session)) return {};
  if (hasRole(session, ROLES.EMPLOYEE)) return { employeeId: session.sub };
  return { departmentId: session.departmentId ?? "__no_department__" };
}

/** Whether `session` is allowed to view the given expense (same rules as expenseVisibilityWhere). */
export function canViewExpense(session: SessionPayload, expense: { employeeId: string; departmentId: string }): boolean {
  if (isAdminRole(session)) return true;
  if (hasRole(session, ROLES.EMPLOYEE)) return expense.employeeId === session.sub;
  return expense.departmentId === session.departmentId;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless session holds one of `roleNames`. Returns the session for chaining. */
export function requireRole(session: SessionPayload, roleNames: string[]): SessionPayload {
  if (!hasRole(session, ...roleNames)) {
    throw new ForbiddenError();
  }
  return session;
}

/** Throws ForbiddenError unless session was granted one of `codes` via its roles. Returns the session for chaining. */
export function requirePermission(session: SessionPayload, codes: string[]): SessionPayload {
  if (!hasPermission(session, ...codes)) {
    throw new ForbiddenError();
  }
  return session;
}

export { ALL_ROLES, MODULE_ACCESS, ROLES };

export function canAccessModule(session: { roles: string[] }, moduleKey: string): boolean {
  return canAccessModuleClient(session.roles, moduleKey);
}
