import "server-only";
import { Role } from "@/generated/prisma/enums";
import type { SessionPayload } from "@/lib/session";
import { MODULE_ACCESS, ALL_ROLES } from "@/lib/rbac-client";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.ADMIN];

/** Only SUPER_ADMIN and ADMIN can see expenses across every department. */
export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Prisma `where` clause restricting expense visibility to what `session` is allowed to see:
 * admins see everything, employees see only their own expenses, everyone else is
 * scoped to their own department. */
export function expenseVisibilityWhere(session: SessionPayload) {
  if (isAdminRole(session.role)) return {};
  if (session.role === Role.EMPLOYEE) return { employeeId: session.sub };
  return { departmentId: session.departmentId ?? "__no_department__" };
}

/** Whether `session` is allowed to view the given expense (same rules as expenseVisibilityWhere). */
export function canViewExpense(session: SessionPayload, expense: { employeeId: string; departmentId: string }): boolean {
  if (isAdminRole(session.role)) return true;
  if (session.role === Role.EMPLOYEE) return expense.employeeId === session.sub;
  return expense.departmentId === session.departmentId;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless session.role is one of `roles`. Returns the session for chaining. */
export function requireRole(session: SessionPayload, roles: Role[]): SessionPayload {
  if (!roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export { ALL_ROLES, MODULE_ACCESS };

export function canAccessModule(role: Role, moduleKey: string): boolean {
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false;
}
