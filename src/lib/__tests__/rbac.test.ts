import { describe, it, expect } from "vitest";
import { canViewExpense, expenseVisibilityWhere } from "@/lib/rbac";
import { ROLES } from "@/lib/rbac-client";
import { ROLE_PERMISSIONS } from "@/lib/auth/permission-catalog";
import type { SessionPayload } from "@/lib/session";

const COMPANY_A = "company-a";
const COMPANY_B = "company-b";
const DEPT_ADMINISTRATION = "dept-administration";
const DEPT_PRODUCTION = "dept-production";

function makeSession(role: string, overrides: Partial<SessionPayload> = {}): SessionPayload {
  return {
    sub: "user-1",
    name: "Test User",
    email: "test@mecs.local",
    companyId: COMPANY_A,
    departmentId: DEPT_ADMINISTRATION,
    roles: [role],
    roleIds: [role],
    permissions: ROLE_PERMISSIONS[role] ?? [],
    ...overrides,
  };
}

function makeExpense(overrides: { employeeId?: string; departmentId?: string; companyId?: string } = {}) {
  return {
    employeeId: "some-other-employee",
    departmentId: DEPT_PRODUCTION,
    companyId: COMPANY_A,
    ...overrides,
  };
}

describe("ACCOUNTS: company-wide expense visibility (bug fix)", () => {
  const accounts = makeSession(ROLES.ACCOUNTS, { departmentId: DEPT_ADMINISTRATION });

  it("can view a SUBMITTED expense filed from a foreign department", () => {
    const foreignDeptExpense = makeExpense({ departmentId: DEPT_PRODUCTION });
    expect(canViewExpense(accounts, foreignDeptExpense)).toBe(true);
  });

  it("expenseVisibilityWhere imposes no department restriction (list-page fix)", () => {
    expect(expenseVisibilityWhere(accounts)).toEqual({});
  });
});

describe("EMPLOYEE: unchanged, own submissions only", () => {
  const employee = makeSession(ROLES.EMPLOYEE, { sub: "employee-1", departmentId: DEPT_ADMINISTRATION });

  it("cannot view another employee's expense, even in their own department", () => {
    const someoneElses = makeExpense({ employeeId: "employee-2", departmentId: DEPT_ADMINISTRATION });
    expect(canViewExpense(employee, someoneElses)).toBe(false);
  });

  it("can view their own expense", () => {
    const own = makeExpense({ employeeId: "employee-1", departmentId: DEPT_PRODUCTION });
    expect(canViewExpense(employee, own)).toBe(true);
  });

  it("expenseVisibilityWhere scopes to their own employeeId", () => {
    expect(expenseVisibilityWhere(employee)).toEqual({ employeeId: "employee-1" });
  });
});

describe("Departmental roles without company-wide expense permissions stay department-scoped", () => {
  const departmentalRoles = [ROLES.PURCHASE_MANAGER, ROLES.MAINTENANCE_MANAGER, ROLES.TRANSPORT_MANAGER];

  it.each(departmentalRoles)("%s holds none of the company-wide expense permissions", (role) => {
    const perms = ROLE_PERMISSIONS[role];
    expect(perms).not.toContain("expenses.verify");
    expect(perms).not.toContain("expenses.approve");
    expect(perms).not.toContain("expenses.reject");
    expect(perms).not.toContain("expenses.mark_paid");
  });

  it.each(departmentalRoles)("%s cannot view a foreign-department expense", (role) => {
    const session = makeSession(role, { departmentId: DEPT_ADMINISTRATION });
    const foreignDeptExpense = makeExpense({ departmentId: DEPT_PRODUCTION });
    expect(canViewExpense(session, foreignDeptExpense)).toBe(false);
  });

  it.each(departmentalRoles)("%s can still view an expense in their own department", (role) => {
    const session = makeSession(role, { departmentId: DEPT_ADMINISTRATION });
    const ownDeptExpense = makeExpense({ departmentId: DEPT_ADMINISTRATION });
    expect(canViewExpense(session, ownDeptExpense)).toBe(true);
  });

  it.each(departmentalRoles)("%s's expenseVisibilityWhere stays department-scoped", (role) => {
    const session = makeSession(role, { departmentId: DEPT_ADMINISTRATION });
    expect(expenseVisibilityWhere(session)).toEqual({ departmentId: DEPT_ADMINISTRATION });
  });
});

describe("Cross-tenant safety", () => {
  it("no role — including ACCOUNTS and admins — can view an expense from a different company", () => {
    const foreignCompanyExpense = makeExpense({ companyId: COMPANY_B });
    for (const role of Object.values(ROLES)) {
      const session = makeSession(role);
      expect(canViewExpense(session, foreignCompanyExpense)).toBe(false);
    }
  });
});

describe("Admins: unchanged, full access within their own company", () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s can view any department's expense in their company", (role) => {
    const session = makeSession(role, { departmentId: DEPT_ADMINISTRATION });
    const foreignDeptExpense = makeExpense({ departmentId: DEPT_PRODUCTION });
    expect(canViewExpense(session, foreignDeptExpense)).toBe(true);
  });

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s's expenseVisibilityWhere imposes no restriction", (role) => {
    const session = makeSession(role);
    expect(expenseVisibilityWhere(session)).toEqual({});
  });
});
