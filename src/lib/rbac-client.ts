// Role names are no longer a Prisma enum — under the ERP schema, roles are
// rows in the `roles` table (company-scoped, many-to-many with users via
// `user_roles`). These string constants are the client-safe catalog of the
// 7 starter roles seeded for every company; used for module-visibility
// checks in both server and client code.
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  ACCOUNTS: "ACCOUNTS",
  PURCHASE_MANAGER: "PURCHASE_MANAGER",
  MAINTENANCE_MANAGER: "MAINTENANCE_MANAGER",
  TRANSPORT_MANAGER: "TRANSPORT_MANAGER",
  EMPLOYEE: "EMPLOYEE",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleName[] = Object.values(ROLES);

/** Sidebar/module keys, mapped to the roles permitted to view that module at all.
 * Individual mutation server actions still enforce their own, finer-grained
 * permission checks via `hasPermission`/`requirePermission` (see rbac.ts). */
export const MODULE_ACCESS: Record<string, RoleName[]> = {
  dashboard: ALL_ROLES,
  expenses: ALL_ROLES,
  fuel: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER, ROLES.ACCOUNTS],
  vehicles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER],
  transportation: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.TRANSPORT_MANAGER, ROLES.ACCOUNTS],
  machinery: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER],
  maintenance: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER],
  spareParts: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MAINTENANCE_MANAGER, ROLES.PURCHASE_MANAGER],
  purchases: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.ACCOUNTS],
  vendors: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER, ROLES.ACCOUNTS],
  payments: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS],
  budgets: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS],
  reports: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS],
  notifications: ALL_ROLES,
  auditLogs: [ROLES.SUPER_ADMIN],
  usersRoles: [ROLES.SUPER_ADMIN],
  roles: [ROLES.SUPER_ADMIN],
  settings: [ROLES.SUPER_ADMIN],
};

/** True if any role in `roles` (the roles a user holds) grants access to `moduleKey`. */
export function canAccessModuleClient(roles: string[], moduleKey: string): boolean {
  const allowed = MODULE_ACCESS[moduleKey];
  if (!allowed) return false;
  return allowed.some((r) => roles.includes(r));
}
