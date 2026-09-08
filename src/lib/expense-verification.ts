import { ApprovalAction } from "@/generated/prisma/enums";

export interface ReviewedInfo {
  byName: string;
  at: Date | string;
}

/** Whether an expense has been through the "Mark as Reviewed" action
 * (TRANSITIONS.review, SUBMITTED -> REVIEWED) — used to show a "Reviewed by
 * <name> on <date>" note that survives even after the expense later moves
 * on to PAID (whose own status no longer says "REVIEWED"). Since the current
 * TRANSITIONS state machine never re-enters SUBMITTED->REVIEWED for the same
 * expense a second time, the latest (only) REVIEWED entry is always the answer. */
export function getReviewedInfo(
  approvalsAscending: { action: string; actedAt: Date | string; actedByName: string }[]
): ReviewedInfo | null {
  let reviewed: ReviewedInfo | null = null;
  for (const a of approvalsAscending) {
    if (a.action === ApprovalAction.REVIEWED) reviewed = { byName: a.actedByName, at: a.actedAt };
  }
  return reviewed;
}
