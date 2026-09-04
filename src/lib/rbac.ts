import "server-only";
import type { SessionPayload } from "@/lib/session";
import { hasRole, hasPermission } from "@/lib/auth/permissions";
import { ROLES, MODULE_ACCESS, ALL_ROLES, canAccessModuleClient } from "@/lib/rbac-client";

/** Only SUPER_ADMIN and ADMIN can see expenses across every department. */
export function isAdminRole(session: { roles: string[] }): boolean {
  return hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN);
}

/** Permission codes whose holder is responsible for processing expenses company-wide
 * (verification, approval, rejection, payment) rather than only within their own
 * department — e.g. ACCOUNTS reviews and pays expenses submitted by every department. */
const COMPANY_WIDE_EXPENSE_PERMISSIONS = ["expenses.verify", "expenses.approve", "expenses.reject", "expenses.mark_paid"];

/** True if `session` holds any permission that makes it responsible for handling
 * expenses across the whole company, not just its own department. */
function hasCompanyWideExpenseAccess(session: { permissions: string[] }): boolean {
  return hasPermission(session, ...COMPANY_WIDE_EXPENSE_PERMISSIONS);
}

/** Prisma `where` clause restricting expense visibility to what `session` is allowed to see:
 * admins see everything, employees see only their own expenses, roles holding a
 * company-wide expense-handling permission see every department, and everyone else is
 * scoped to their own department. */
export function expenseVisibilityWhere(session: SessionPayload) {
  if (isAdminRole(session)) return {};
  if (hasRole(session, ROLES.EMPLOYEE)) return { employeeId: session.sub };
  // Company-wide expense handling (e.g. ACCOUNTS verifying/paying expenses) requires
  // seeing expenses from every department, not just the reviewer's own.
  if (hasCompanyWideExpenseAccess(session)) return {};
  return { departmentId: session.departmentId ?? "__no_department__" };
}

/** Whether `session` is allowed to view the given expense (same rules as expenseVisibilityWhere). */
export function canViewExpense(
  session: SessionPayload,
  expense: { employeeId: string; departmentId: string; companyId: string }
): boolean {
  // Never allow cross-tenant visibility, regardless of role or permission.
  if (expense.companyId !== session.companyId) return false;
  if (isAdminRole(session)) return true;
  if (hasRole(session, ROLES.EMPLOYEE)) return expense.employeeId === session.sub;
  if (hasCompanyWideExpenseAccess(session)) return true;
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
