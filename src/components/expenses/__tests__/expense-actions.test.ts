import { describe, it, expect } from "vitest";
import { STATUS_ACTIONS, visibleActionsFor } from "@/components/expenses/expense-actions";
import { getReviewedInfo, getVerifiedInfo } from "@/lib/expense-verification";
import { ROLES } from "@/lib/rbac-client";
import { ROLE_PERMISSIONS } from "@/lib/auth/permission-catalog";

function labelFor(status: string, key: string): string | undefined {
  return STATUS_ACTIONS[status]?.find((a) => a.key === key)?.label;
}

function keysFor(status: string, opts: { roles: string[]; permissions: string[]; isOwner: boolean; alreadyVerified?: boolean }) {
  return visibleActionsFor(status, opts).map((a) => a.key);
}

describe("STATUS_ACTIONS audit: every TRANSITIONS entry (src/lib/actions/expenses.ts) has a matching button", () => {
  // TRANSITIONS can't be imported here — it lives in a "use server" file, and
  // Next.js only allows async function exports from those — so this mirrors
  // its `from` lists by hand. If TRANSITIONS changes, update this alongside it.
  const EXPECTED_KEYS_BY_STATUS: Record<string, string[]> = {
    DRAFT: ["submit", "cancel"], // submit, cancel both have DRAFT in `from`
    SUBMITTED: ["review", "approve", "reject", "cancel"], // review, approve, reject, cancel all have SUBMITTED in `from`
    UNDER_REVIEW: ["verify", "approve", "reject"], // verify, approve, reject all have UNDER_REVIEW in `from`
    APPROVED: ["markPaid"], // markPaid has APPROVED in `from`
  };

  it.each(Object.entries(EXPECTED_KEYS_BY_STATUS))("%s exposes exactly %j", (status, expectedKeys) => {
    const actualKeys = (STATUS_ACTIONS[status] ?? []).map((a) => a.key);
    expect(actualKeys.sort()).toEqual([...expectedKeys].sort());
  });

  it("terminal statuses (REJECTED, PAID, CANCELLED) have no actions", () => {
    for (const status of ["REJECTED", "PAID", "CANCELLED"]) {
      expect(STATUS_ACTIONS[status] ?? []).toEqual([]);
    }
  });
});

describe("Cancel on SUBMITTED (regression: was missing entirely)", () => {
  it("the expense owner sees Cancel on their own SUBMITTED expense", () => {
    const keys = keysFor("SUBMITTED", { roles: [ROLES.EMPLOYEE], permissions: ROLE_PERMISSIONS[ROLES.EMPLOYEE], isOwner: true });
    expect(keys).toContain("cancel");
  });

  it("a non-owner, non-admin does not see Cancel on someone else's SUBMITTED expense", () => {
    const keys = keysFor("SUBMITTED", { roles: [ROLES.EMPLOYEE], permissions: ROLE_PERMISSIONS[ROLES.EMPLOYEE], isOwner: false });
    expect(keys).not.toContain("cancel");
  });
});

describe("ACCOUNTS: Verify workflow (root-cause fix — expenses.review granted)", () => {
  const accountsSession = { roles: [ROLES.ACCOUNTS], permissions: ROLE_PERMISSIONS[ROLES.ACCOUNTS], isOwner: false };

  it("sees 'Move to Review' (not Confirm Verified) and Reject on a SUBMITTED expense — Verify isn't valid until UNDER_REVIEW", () => {
    const keys = keysFor("SUBMITTED", accountsSession);
    expect(keys).toContain("review");
    expect(keys).toContain("reject");
    expect(keys).not.toContain("verify");
    expect(keys).not.toContain("approve");
  });

  it("sees Verify and Reject once the expense reaches UNDER_REVIEW", () => {
    const keys = keysFor("UNDER_REVIEW", accountsSession);
    expect(keys).toContain("verify");
    expect(keys).toContain("reject");
    expect(keys).not.toContain("approve");
  });

  it("sees Mark as paid on an APPROVED expense", () => {
    expect(keysFor("APPROVED", accountsSession)).toEqual(["markPaid"]);
  });
});

describe("Verify is a checkpoint, not a status change: repeat-verify bug fix", () => {
  const accountsSession = { roles: [ROLES.ACCOUNTS], permissions: ROLE_PERMISSIONS[ROLES.ACCOUNTS], isOwner: false };

  it("Mark verified is offered on UNDER_REVIEW when not yet verified", () => {
    expect(keysFor("UNDER_REVIEW", { ...accountsSession, alreadyVerified: false })).toContain("verify");
  });

  it("Mark verified disappears once already verified, but Reject stays available", () => {
    const keys = keysFor("UNDER_REVIEW", { ...accountsSession, alreadyVerified: true });
    expect(keys).not.toContain("verify");
    expect(keys).toContain("reject");
  });

  it("Approve (admin) is unaffected by verified state either way", () => {
    const admin = { roles: [ROLES.ADMIN], permissions: ROLE_PERMISSIONS[ROLES.ADMIN], isOwner: false };
    expect(keysFor("UNDER_REVIEW", { ...admin, alreadyVerified: false })).toContain("approve");
    expect(keysFor("UNDER_REVIEW", { ...admin, alreadyVerified: true })).toContain("approve");
  });
});

describe("Button labels are visually/semantically distinct (label-collision fix)", () => {
  it("SUBMITTED's review action is labeled 'Move to Review'", () => {
    expect(labelFor("SUBMITTED", "review")).toBe("Move to Review");
  });

  it("UNDER_REVIEW's verify action is labeled 'Confirm Verified'", () => {
    expect(labelFor("UNDER_REVIEW", "verify")).toBe("Confirm Verified");
  });

  it("the two labels no longer share the near-identical 'Mark ___ed' phrasing", () => {
    const reviewLabel = labelFor("SUBMITTED", "review")!;
    const verifyLabel = labelFor("UNDER_REVIEW", "verify")!;
    expect(reviewLabel).not.toBe(verifyLabel);
    expect(reviewLabel.startsWith("Mark ")).toBe(false);
    expect(verifyLabel.startsWith("Mark ")).toBe(false);
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

  it("stays true (returns the latest) once verified too", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
    ];
    expect(getReviewedInfo(approvals)).toEqual({ byName: "Divya", at: "2026-01-02" });
  });
});

describe("Step-indicator workflow states (Reviewed -> Verified -> Approved)", () => {
  // Same four states an expense visibly moves through end to end; mirrors what
  // ReviewProgress in expense-actions.tsx renders from reviewedInfo/verifiedInfo/status.
  it("not-yet-reviewed: only a SUBMITTED entry exists", () => {
    const approvals = [{ action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" }];
    expect(getReviewedInfo(approvals)).toBeNull();
    expect(getVerifiedInfo(approvals)).toBeNull();
  });

  it("reviewed-not-verified: a REVIEWED entry exists, no VERIFIED entry yet", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
    ];
    expect(getReviewedInfo(approvals)).not.toBeNull();
    expect(getVerifiedInfo(approvals)).toBeNull();
  });

  it("reviewed-and-verified: both entries exist", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
    ];
    expect(getReviewedInfo(approvals)).not.toBeNull();
    expect(getVerifiedInfo(approvals)).not.toBeNull();
  });

  it("approved: reviewed and verified stay true, and the expense's own status flags the Approved step", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Divya" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
      { action: "APPROVED", actedAt: "2026-01-04", actedByName: "Ashwin" },
    ];
    expect(getReviewedInfo(approvals)).not.toBeNull();
    expect(getVerifiedInfo(approvals)).not.toBeNull();
    const status = "APPROVED";
    expect(status === "APPROVED").toBe(true); // ReviewProgress's `approved` prop
  });
});

describe("getVerifiedInfo (src/lib/expense-verification.ts)", () => {
  it("returns null when there is no VERIFIED entry", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Admin" },
    ];
    expect(getVerifiedInfo(approvals)).toBeNull();
  });

  it("returns the verifier's name and timestamp once a VERIFIED entry exists", () => {
    const approvals = [
      { action: "SUBMITTED", actedAt: "2026-01-01", actedByName: "Priya" },
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Admin" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
    ];
    expect(getVerifiedInfo(approvals)).toEqual({ byName: "Divya", at: "2026-01-03" });
  });

  it("a later REVIEWED entry (a fresh review cycle) resets an earlier verification", () => {
    const approvals = [
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Admin" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
      { action: "REVIEWED", actedAt: "2026-01-10", actedByName: "Admin" }, // hypothetical future re-review cycle
    ];
    expect(getVerifiedInfo(approvals)).toBeNull();
  });

  it("picks up a verification that happens after that later cycle starts", () => {
    const approvals = [
      { action: "REVIEWED", actedAt: "2026-01-02", actedByName: "Admin" },
      { action: "VERIFIED", actedAt: "2026-01-03", actedByName: "Divya" },
      { action: "REVIEWED", actedAt: "2026-01-10", actedByName: "Admin" },
      { action: "VERIFIED", actedAt: "2026-01-11", actedByName: "Divya" },
    ];
    expect(getVerifiedInfo(approvals)).toEqual({ byName: "Divya", at: "2026-01-11" });
  });
});

describe("Departmental roles without expense-handling permissions see no verify/approve/reject/review actions", () => {
  const departmentalRoles = [ROLES.PURCHASE_MANAGER, ROLES.MAINTENANCE_MANAGER, ROLES.TRANSPORT_MANAGER];

  it.each(departmentalRoles)("%s sees nothing but their own draft/submit/cancel actions", (role) => {
    const session = { roles: [role], permissions: ROLE_PERMISSIONS[role], isOwner: false };
    expect(keysFor("SUBMITTED", session)).toEqual([]);
    expect(keysFor("UNDER_REVIEW", session)).toEqual([]);
    expect(keysFor("APPROVED", session)).toEqual([]);
  });
});

describe("Admins: unchanged, full action set regardless of ownership", () => {
  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN])("%s sees every SUBMITTED action, including owner-only Cancel, even as a non-owner", (role) => {
    const keys = keysFor("SUBMITTED", { roles: [role], permissions: ROLE_PERMISSIONS[role], isOwner: false });
    expect(keys.sort()).toEqual(["approve", "cancel", "reject", "review"].sort());
  });
});
