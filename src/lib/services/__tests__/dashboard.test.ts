import { describe, it, expect } from "vitest";
import { ForbiddenError } from "@/lib/rbac";
import { ROLES } from "@/lib/rbac-client";
import { ROLE_PERMISSIONS } from "@/lib/auth/permission-catalog";
import type { SessionPayload } from "@/lib/session";
import {
  getKpis,
  getExpenseTrend,
  getExpenseTrendYoy,
  getExpenseByCategory,
  getDepartmentSpending,
  getTopVendors,
  getMachineMaintenanceCost,
  getVehicleFuelCost,
  getBudgetVsActual,
  getSpendEfficiencyKpis,
  getSpendingAnomalies,
} from "@/lib/services/dashboard";

function makeSession(role: string): SessionPayload {
  return {
    sub: "user-1",
    name: "Test User",
    email: "test@mecs.local",
    companyId: "company-a",
    departmentId: null,
    roles: [role],
    roleIds: [role],
    permissions: ROLE_PERMISSIONS[role] ?? [],
  };
}

// A restricted session, deliberately never given dashboard.company_analytics.
// Every function below must refuse it before ever reaching the database —
// this is the data-layer defense-in-depth check: even a direct call to these
// functions (bypassing the page-level canViewCompanyDashboard branch entirely)
// must not return company-wide data to a role that shouldn't see it.
const RESTRICTED_SESSIONS: [string, SessionPayload][] = [
  [ROLES.EMPLOYEE, makeSession(ROLES.EMPLOYEE)],
  [ROLES.PURCHASE_MANAGER, makeSession(ROLES.PURCHASE_MANAGER)],
  [ROLES.MAINTENANCE_MANAGER, makeSession(ROLES.MAINTENANCE_MANAGER)],
  [ROLES.TRANSPORT_MANAGER, makeSession(ROLES.TRANSPORT_MANAGER)],
];

describe("Company-analytics dashboard functions refuse restricted roles at the data layer", () => {
  const cases: [string, (session: SessionPayload) => Promise<unknown>][] = [
    ["getKpis", (s) => getKpis(s)],
    ["getExpenseTrend", (s) => getExpenseTrend(s)],
    ["getExpenseTrendYoy", (s) => getExpenseTrendYoy(s)],
    ["getExpenseByCategory", (s) => getExpenseByCategory(s)],
    ["getDepartmentSpending", (s) => getDepartmentSpending(s)],
    ["getTopVendors", (s) => getTopVendors(s)],
    ["getMachineMaintenanceCost", (s) => getMachineMaintenanceCost(s)],
    ["getVehicleFuelCost", (s) => getVehicleFuelCost(s)],
    ["getBudgetVsActual", (s) => getBudgetVsActual(s)],
    ["getSpendEfficiencyKpis", (s) => getSpendEfficiencyKpis(s)],
    ["getSpendingAnomalies", (s) => getSpendingAnomalies(s)],
  ];

  for (const [fnName, fn] of cases) {
    for (const [roleName, session] of RESTRICTED_SESSIONS) {
      it(`${fnName} throws ForbiddenError for ${roleName} (simulated direct call, no page-level gate)`, async () => {
        await expect(fn(session)).rejects.toThrow(ForbiddenError);
      });
    }
  }
});

describe("Company-analytics dashboard functions accept the 3 permitted roles' permission check", () => {
  // These roles hold dashboard.company_analytics, so requirePermission itself
  // must not throw — a genuine DB connection isn't available in this unit test,
  // so we only assert the function gets *past* the permission guard (i.e. it
  // doesn't reject synchronously with ForbiddenError) rather than asserting on
  // real query results, which are covered by the live local-DB verification.
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS])("%s's session is not rejected by getKpis's permission guard", async (role) => {
    const session = makeSession(role);
    const result = getKpis(session).catch((e) => e);
    const outcome = await result;
    if (outcome instanceof ForbiddenError) {
      throw new Error(`${role} should hold dashboard.company_analytics but was refused`);
    }
    // Any other outcome (success, or a DB-connection error in this no-DB unit
    // test) proves the permission guard itself let this role through.
  });
});
