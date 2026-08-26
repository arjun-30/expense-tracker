import { Role } from "@/generated/prisma/enums";

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Management / Admin",
  ACCOUNTS: "Accounts",
  PURCHASE_MANAGER: "Purchase Manager",
  MAINTENANCE_MANAGER: "Maintenance Manager",
  TRANSPORT_MANAGER: "Transport Manager",
  EMPLOYEE: "Employee",
};
