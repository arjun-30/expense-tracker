import { describe, it, expect } from "vitest";
import { STATUS_ACTIONS, visibleActionsFor, NEXT_STAGE_LABEL } from "@/components/expenses/expense-actions";
import { getReviewedInfo } from "@/lib/expense-verification";
import { ROLES } from "@/lib/rbac-client";
import { ROLE_PERMISSIONS } from "@/lib/auth/permission-catalog";

function labelFor(status: string, key: string): string | undefined {
  return STATUS_ACTIONS[status]?.find((a) => a.key === key)?.label;
}

function keysFor(status: string, permissions: string[]) {
  return visibleActionsFor(status, { permissions }).map((a) => a.key);
}

describe("STATUS_ACTIONS audit: every TRANSITIONS entry (src/lib/actions/expenses.ts) has a matching button", () => {
  // TRANSITIONS can't be imported here — it lives in a "use server" file, and
  // Next.js only allows async function exports from those — so this mirrors
  // its `from` lists by hand. If TRANSITIONS changes, update this alongside it.
  const EXPECTED_KEYS_BY_STATUS: Record<string, string[]> = {
    SUBMITTED: ["review", "reject"], // review, reject both have SUBMITTED in `from`
    APPROVAL_PENDING: ["approve", "reject"], // approve, reject both have APPROVAL_PENDING in `from`
    REVIEWED: ["markPaid"], // markPaid has REVIEWED in `from`
  };

  it.each(Object.entries(EXPECTED_KEYS_BY_STATUS))("%s exposes exactly %j", (status, expectedKeys) => {
    const actualKeys = (STATUS_ACTIONS[status] ?? []).map((a) => a.key);
    expect(actualKeys.sort()).toEqual([...expectedKeys].sort());
  });

  it("terminal/unreachable statuses (REJECTED, PAID, APPROVED) have no actions", () => {
    // APPROVED remains a valid enum member but no transition ever assigns it
    // (the "approve" transition goes straight to SUBMITTED) — see the
    // ExpenseStatus comment in prisma/schema.prisma.
    for (const status of ["REJECTED", "PAID", "APPROVED"]) {
      expect(STATUS_ACTIONS[status] ?? []).toEqual([]);
    }
  });
});

describe("Button labels", () => {
  it("SUBMITTED's review action is labeled 'Mark as Reviewed'", () => {
    expect(labelFor("SUBMITTED", "review")).toBe("Mark as Reviewed");
  });

  it("APPROVAL_PENDING's approve action is labeled 'Approve'", () => {
    expect(labelFor("APPROVAL_PENDING", "approve")).toBe("Approve");
  });

  it("REVIEWED's markPaid action is labeled 'Mark as Paid'", () => {
    expect(labelFor("REVIEWED", "markPaid")).toBe("Mark as Paid");
  });
});

describe("NEXT_STAGE_LABEL: workflow-summary 'Next' text, only where a single clear next stage exists", () => {
  it("SUBMITTED's next stage is Review", () => {
    expect(NEXT_STAGE_LABEL.SUBMITTED).toBe("Review");
  });

  it("REVIEWED's next stage is Payment", () => {
    expect(NEXT_STAGE_LABEL.REVIEWED).toBe("Payment");
  });

  it("APPROVAL_PENDING has no entry — its current-stage text already conveys what's pending", () => {
    expect(NEXT_STAGE_LABEL.APPROVAL_PENDING).toBeUndefined();
  });

  it.each(["REJECTED", "PAID", "APPROVED"])("%s (terminal/unreachable) has no next-stage entry", (status) => {
    expect(NEXT_STAGE_LABEL[status as keyof typeof NEXT_STAGE_LABEL]).toBeUndefined();
  });
});

describe("ACCOUNTS: Scenario A path (with invoice) — review, reject, mark paid; never approve", () => {
  const accountsPermissions = ROLE_PERMISSIONS[ROLES.ACCOUNTS];

  it("sees Mark as Reviewed and Reject on SUBMITTED", () => {
    const keys = keysFor("SUBMITTED", accountsPermissions);
    expect(keys).toContain("review");
    expect(keys).toContain("reject");
  });

  it("sees only Reject on APPROVAL_PENDING — expenses.approve is ADMIN/SUPER_ADMIN only, but ACCOUNTS still holds expenses.reject", () => {
    expect(keysFor("APPROVAL_PENDING", accountsPermissions)).toEqual(["reject"]);
  });

  it("sees Mark as Paid on REVIEWED", () => {
    expect(keysFor("REVIEWED", accountsPermissions)).toEqual(["markPaid"]);
  });
});

describe("Admins: full Scenario B gate (Approve/Reject on APPROVAL_PENDING) plus everything ACCOUNTS has", () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s sees Approve and Reject on APPROVAL_PENDING", (role) => {
    const keys = keysFor("APPROVAL_PENDING", ROLE_PERMISSIONS[role]);
    expect(keys.sort()).toEqual(["approve", "reject"].sort());
  });

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s sees Mark as Reviewed and Reject on SUBMITTED", (role) => {
    const keys = keysFor("SUBMITTED", ROLE_PERMISSIONS[role]);
    expect(keys.sort()).toEqual(["review", "reject"].sort());
  });

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s sees Mark as Paid on REVIEWED", (role) => {
    expect(keysFor("REVIEWED", ROLE_PERMISSIONS[role])).toEqual(["markPaid"]);
  });
});

describe("Departmental roles and EMPLOYEE: no expense-handling permissions anywhere in the new workflow", () => {
  const noPermissionRoles = [ROLES.PURCHASE_MANAGER, ROLES.MAINTENANCE_MANAGER, ROLES.TRANSPORT_MANAGER, ROLES.EMPLOYEE];

  it.each(noPermissionRoles)("%s sees no actions on SUBMITTED, APPROVAL_PENDING, or REVIEWED", (role) => {
    const permissions = ROLE_PERMISSIONS[role];
    expect(keysFor("SUBMITTED", permissions)).toEqual([]);
    expect(keysFor("APPROVAL_PENDING", permissions)).toEqual([]);
    expect(keysFor("REVIEWED", permissions)).toEqual([]);
  });
});

describe("expenses.verify and expenses.cancel are fully removed from the catalog", () => {
  it.each(Object.values(ROLES))("%s does not hold expenses.verify or expenses.cancel", (role) => {
    const perms = ROLE_PERMISSIONS[role];
    expect(perms).not.toContain("expenses.verify");
    expect(perms).not.toContain("expenses.cancel");
  });
});

describe("getReviewedInfo (src/lib/expense-verification.ts)", () => {
  it("returns null before any REVIEWED entry exists (still SUBMITTED)", () => {
    const approvals = [{ action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" }];
    expect(getReviewedInfo(approvals)).toBeNull();
  });

  it("returns the reviewer's name and timestamp once moved to review", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
    ];
    expect(getReviewedInfo(approvals)).toEqual({ byName: "Divya", at: "2026-01-02" });
  });

  it("stays populated once paid too — the note should survive past REVIEWED into PAID", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
      { action: "PAID", actedAt: "2026-01-03", actedByName: "Divya" },
    ];
    expect(getReviewedInfo(approvals)).toEqual({ byName: "Divya", at: "2026-01-02" });
  });
});
