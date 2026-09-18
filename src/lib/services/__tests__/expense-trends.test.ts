import { describe, it, expect } from "vitest";
import { ForbiddenError } from "@/lib/rbac";
import { ROLES } from "@/lib/rbac-client";
import { ROLE_PERMISSIONS } from "@/lib/auth/permission-catalog";
import type { SessionPayload } from "@/lib/session";
import { getDailyExpenseTrend, getExpenseTrend } from "@/lib/services/dashboard";

function makeSession(role: string, extraPermissions: string[] = []): SessionPayload {
  return {
    sub: "user-test",
    name: "Test User",
    email: "test@mecs.local",
    companyId: "seed-company-1",
    departmentId: null,
    roles: [role],
    roleIds: [role],
    permissions: Array.from(new Set([...(ROLE_PERMISSIONS[role] ?? []), ...extraPermissions])),
  };
}

describe("Expense Trends Service Tests", () => {
  it("rejects unauthorized roles from accessing daily expense trend", async () => {
    const employeeSession = makeSession(ROLES.EMPLOYEE);
    await expect(getDailyExpenseTrend(employeeSession, 30)).rejects.toThrow(ForbiddenError);
  });

  it("rejects unauthorized roles from accessing monthly expense trend", async () => {
    const transportSession = makeSession(ROLES.TRANSPORT_MANAGER);
    await expect(getExpenseTrend(transportSession, 12)).rejects.toThrow(ForbiddenError);
  });

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS])(
    "%s's session is not rejected by getDailyExpenseTrend permission guard",
    async (role) => {
      const session = makeSession(role);
      const outcome = await getDailyExpenseTrend(session, 30).catch((e) => e);
      expect(outcome).not.toBeInstanceOf(ForbiddenError);
    }
  );

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.ACCOUNTS])(
    "%s's session is not rejected by getExpenseTrend permission guard",
    async (role) => {
      const session = makeSession(role);
      const outcome = await getExpenseTrend(session, 12).catch((e) => e);
      expect(outcome).not.toBeInstanceOf(ForbiddenError);
    }
  );
});
