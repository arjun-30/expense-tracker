// Shared source of truth for the permission catalog and the starter
// role -> permission mapping. Imported by both prisma/seed.ts (to populate
// `permissions`/`role_permissions`) and the app (for permission-code
// constants), so the two never drift apart.
//
// No "server-only" import here — this file is pure data, loaded from a
// tsx script (prisma/seed.ts) that doesn't go through the Next.js server
// module graph.
import { ROLES } from "../rbac-client";

export interface PermissionDef {
  code: string;
  module: string;
  description: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { code: "dashboard.view", module: "dashboard", description: "View the dashboard" },

  { code: "expenses.view", module: "expenses", description: "View expenses" },
  { code: "expenses.create", module: "expenses", description: "Create and edit draft expenses" },
  { code: "expenses.submit", module: "expenses", description: "Submit an expense for approval" },
  { code: "expenses.review", module: "expenses", description: "Move a submitted expense into review" },
  { code: "expenses.verify", module: "expenses", description: "Verify an expense under review" },
  { code: "expenses.approve", module: "expenses", description: "Approve an expense" },
  { code: "expenses.reject", module: "expenses", description: "Reject an expense" },
  { code: "expenses.mark_paid", module: "expenses", description: "Mark an approved expense as paid" },
  { code: "expenses.cancel", module: "expenses", description: "Cancel a draft or submitted expense" },

  { code: "payments.view", module: "payments", description: "View vendor payments" },
  { code: "payments.create", module: "payments", description: "Record a vendor payment" },

  { code: "vendors.view", module: "vendors", description: "View vendors" },
  { code: "vendors.manage", module: "vendors", description: "Create and edit vendors" },

  { code: "purchases.view", module: "purchases", description: "View purchase requests and orders" },
  { code: "purchases.manage", module: "purchases", description: "Create purchase orders and receive goods" },

  { code: "vehicles.view", module: "vehicles", description: "View vehicles and drivers" },
  { code: "vehicles.manage", module: "vehicles", description: "Create and edit vehicles and drivers" },

  { code: "fuel.view", module: "fuel", description: "View fuel transactions" },
  { code: "fuel.manage", module: "fuel", description: "Record fuel transactions" },

  { code: "transportation.view", module: "transportation", description: "View transport trips" },
  { code: "transportation.manage", module: "transportation", description: "Record transport trips" },

  { code: "machinery.view", module: "machinery", description: "View machines" },
  { code: "machinery.manage", module: "machinery", description: "Create and edit machines" },

  { code: "maintenance.view", module: "maintenance", description: "View maintenance requests and records" },
  { code: "maintenance.manage", module: "maintenance", description: "Create maintenance records" },

  { code: "consumables.view", module: "consumables", description: "View consumables (spare parts) stock" },
  { code: "consumables.manage", module: "consumables", description: "Create consumables and adjust stock" },

  { code: "budgets.view", module: "budgets", description: "View budgets" },
  { code: "budgets.manage", module: "budgets", description: "Create budgets and allocations" },

  { code: "reports.view", module: "reports", description: "View and export reports" },

  { code: "notifications.view", module: "notifications", description: "View notifications" },

  { code: "audit_logs.view", module: "audit_logs", description: "View the audit log" },

  { code: "users.manage", module: "users", description: "Manage users and role assignments" },
  { code: "settings.manage", module: "settings", description: "Manage departments, cost centers, categories, and notification rules" },
];

const ALL_CODES = PERMISSIONS.map((p) => p.code);

function except(...codes: string[]): string[] {
  const excluded = new Set(codes);
  return ALL_CODES.filter((c) => !excluded.has(c));
}

/** Starter permission set per role, seeded for every company. A reasonable
 * default mapping (e.g. ACCOUNTS gets expense/payment permissions,
 * PURCHASE_MANAGER gets procurement permissions) — greenfield/demo data,
 * no real access-control history to preserve, per OPEN_DECISIONS.md #2. */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: ALL_CODES,
  [ROLES.ADMIN]: except("users.manage", "settings.manage", "audit_logs.view"),
  [ROLES.ACCOUNTS]: [
    "dashboard.view",
    "expenses.view", "expenses.create", "expenses.submit", "expenses.verify", "expenses.reject", "expenses.mark_paid", "expenses.cancel",
    "payments.view", "payments.create",
    "vendors.view", "vendors.manage",
    "purchases.view", "purchases.manage",
    "fuel.view",
    "transportation.view",
    "budgets.view", "budgets.manage",
    "reports.view",
    "notifications.view",
  ],
  [ROLES.PURCHASE_MANAGER]: [
    "dashboard.view",
    "expenses.view", "expenses.create", "expenses.submit", "expenses.cancel",
    "vendors.view", "vendors.manage",
    "purchases.view", "purchases.manage",
    "consumables.view", "consumables.manage",
    "notifications.view",
  ],
  [ROLES.MAINTENANCE_MANAGER]: [
    "dashboard.view",
    "expenses.view", "expenses.create", "expenses.submit", "expenses.cancel",
    "machinery.view", "machinery.manage",
    "maintenance.view", "maintenance.manage",
    "consumables.view", "consumables.manage",
    "notifications.view",
  ],
  [ROLES.TRANSPORT_MANAGER]: [
    "dashboard.view",
    "expenses.view", "expenses.create", "expenses.submit", "expenses.cancel",
    "vehicles.view", "vehicles.manage",
    "fuel.view", "fuel.manage",
    "transportation.view", "transportation.manage",
    "notifications.view",
  ],
  [ROLES.EMPLOYEE]: [
    "dashboard.view",
    "expenses.view", "expenses.create", "expenses.submit", "expenses.cancel",
    "notifications.view",
  ],
};
