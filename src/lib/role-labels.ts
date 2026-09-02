import { ROLES, type RoleName } from "@/lib/rbac-client";

export const ROLE_LABELS: Record<RoleName, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN]: "Management / Admin",
  [ROLES.ACCOUNTS]: "Accounts",
  [ROLES.PURCHASE_MANAGER]: "Purchase Manager",
  [ROLES.MAINTENANCE_MANAGER]: "Maintenance Manager",
  [ROLES.TRANSPORT_MANAGER]: "Transport Manager",
  [ROLES.EMPLOYEE]: "Employee",
};
