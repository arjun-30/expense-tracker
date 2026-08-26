import { Role } from "@/generated/prisma/enums";

export const ALL_ROLES = Object.values(Role);

/** Sidebar/module keys, mapped to the roles permitted to view that module at all.
 * Individual mutation server actions still enforce their own, finer-grained role checks. */
export const MODULE_ACCESS: Record<string, Role[]> = {
  dashboard: ALL_ROLES,
  expenses: ALL_ROLES,
  fuel: [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER, Role.ACCOUNTS],
  vehicles: [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER],
  transportation: [Role.SUPER_ADMIN, Role.ADMIN, Role.TRANSPORT_MANAGER, Role.ACCOUNTS],
  machinery: [Role.SUPER_ADMIN, Role.ADMIN, Role.MAINTENANCE_MANAGER],
  maintenance: [Role.SUPER_ADMIN, Role.ADMIN, Role.MAINTENANCE_MANAGER],
  spareParts: [Role.SUPER_ADMIN, Role.ADMIN, Role.MAINTENANCE_MANAGER, Role.PURCHASE_MANAGER],
  purchases: [Role.SUPER_ADMIN, Role.ADMIN, Role.PURCHASE_MANAGER, Role.ACCOUNTS],
  vendors: [Role.SUPER_ADMIN, Role.ADMIN, Role.PURCHASE_MANAGER, Role.ACCOUNTS],
  payments: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTS],
  budgets: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTS],
  reports: [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTS],
  notifications: ALL_ROLES,
  auditLogs: [Role.SUPER_ADMIN],
  usersRoles: [Role.SUPER_ADMIN],
  settings: [Role.SUPER_ADMIN],
};

export function canAccessModuleClient(role: Role, moduleKey: string): boolean {
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false;
}
