import { describe, it, expect } from "vitest";
import { groupPermissions, humanizeGroup } from "@/components/roles/role-permissions-form";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";

describe("humanizeGroup", () => {
  it("capitalizes a single-word prefix", () => {
    expect(humanizeGroup("expenses")).toBe("Expenses");
  });

  it("splits and capitalizes each word of an underscored prefix", () => {
    expect(humanizeGroup("audit_logs")).toBe("Audit Logs");
  });
});

describe("groupPermissions: derives grouping from the code prefix automatically", () => {
  it("groups every permission by the text before its first '.'", () => {
    const groups = groupPermissions(PERMISSIONS);
    for (const group of groups) {
      for (const item of group.items) {
        expect(item.code.split(".")[0]).toBe(group.key);
      }
    }
  });

  it("puts all expenses.* codes in one 'Expenses' group", () => {
    const groups = groupPermissions(PERMISSIONS);
    const expensesGroup = groups.find((g) => g.key === "expenses")!;
    expect(expensesGroup.label).toBe("Expenses");
    const codes = expensesGroup.items.map((p) => p.code);
    expect(codes).toContain("expenses.verify");
    expect(codes).toContain("expenses.approve");
    expect(codes.every((c) => c.startsWith("expenses."))).toBe(true);
  });

  it("a newly-added permission code is grouped automatically with no separate mapping to update", () => {
    const withNewCode = [...PERMISSIONS, { code: "widgets.manage", module: "widgets", description: "Manage widgets" }];
    const groups = groupPermissions(withNewCode);
    const widgetsGroup = groups.find((g) => g.key === "widgets");
    expect(widgetsGroup).toBeDefined();
    expect(widgetsGroup!.label).toBe("Widgets");
    expect(widgetsGroup!.items).toEqual([{ code: "widgets.manage", module: "widgets", description: "Manage widgets" }]);
  });

  it("includes the newly-added roles.manage permission in its own 'Roles' group", () => {
    const groups = groupPermissions(PERMISSIONS);
    const rolesGroup = groups.find((g) => g.key === "roles")!;
    expect(rolesGroup).toBeDefined();
    expect(rolesGroup.label).toBe("Roles");
    expect(rolesGroup.items.map((p) => p.code)).toContain("roles.manage");
  });

  it("covers every permission in the catalog exactly once", () => {
    const groups = groupPermissions(PERMISSIONS);
    const total = groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(total).toBe(PERMISSIONS.length);
  });
});
