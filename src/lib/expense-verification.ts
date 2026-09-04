import { ApprovalAction } from "@/generated/prisma/enums";

export interface VerifiedInfo {
  byName: string;
  at: Date | string;
}

export interface ReviewedInfo {
  byName: string;
  at: Date | string;
}

/** Whether an expense has been moved into review (the "Move to Review" action,
 * TRANSITIONS.review, SUBMITTED -> UNDER_REVIEW). Used alongside getVerifiedInfo
 * to drive the Reviewed -> Verified -> Approved step indicator on the expense
 * detail page. Unlike getVerifiedInfo, this has no cycle-reset case: REVIEWED
 * itself marks the start of a review cycle, so the latest entry (if any) is
 * always the answer. */
export function getReviewedInfo(
  approvalsAscending: { action: string; actedAt: Date | string; actedByName: string }[]
): ReviewedInfo | null {
  let reviewed: ReviewedInfo | null = null;
  for (const a of approvalsAscending) {
    if (a.action === ApprovalAction.REVIEWED) reviewed = { byName: a.actedByName, at: a.actedAt };
  }
  return reviewed;
}

/** Whether an expense has already been verified within its *current* review
 * cycle. "Verify" (src/lib/actions/expenses.ts TRANSITIONS.verify) only records
 * an ExpenseApproval row — it doesn't change the expense's status — so button
 * visibility and any "verified" indicator have to derive this from history
 * rather than from `expense.status`.
 *
 * `approvalsAscending` must be ordered oldest-first (as the expense detail
 * page's query already does via `orderBy: { actedAt: "asc" }`). A REVIEWED
 * entry resets the verified state, since it marks entry into a new review
 * cycle — the current TRANSITIONS state machine never actually re-enters
 * UNDER_REVIEW after leaving it, but this keeps the check correct if a future
 * "send back for revision" feature ever adds that path, rather than silently
 * carrying a stale verification forward. */
export function getVerifiedInfo(
  approvalsAscending: { action: string; actedAt: Date | string; actedByName: string }[]
): VerifiedInfo | null {
  let verified: VerifiedInfo | null = null;
  for (const a of approvalsAscending) {
    if (a.action === ApprovalAction.REVIEWED) verified = null;
    else if (a.action === ApprovalAction.VERIFIED) verified = { byName: a.actedByName, at: a.actedAt };
  }
  return verified;
}
