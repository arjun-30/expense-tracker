"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { transitionExpenseAction } from "@/lib/actions/expenses";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import type { ReviewedInfo } from "@/lib/expense-verification";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate } from "@/lib/format";
import { CheckCircle2, Clock } from "lucide-react";

/** The immediate next stage's label, only where a single one clearly exists.
 * APPROVAL_PENDING deliberately has no entry here — its actual next transition
 * (admin approval, back to SUBMITTED) reads confusingly as a standalone "Next:
 * Submitted" line, and its current-stage text ("Awaiting admin approval")
 * already conveys what's pending without it. REJECTED/PAID are terminal. */
export const NEXT_STAGE_LABEL: Partial<Record<ExpenseStatus, string>> = {
  SUBMITTED: "Review",
  REVIEWED: "Payment",
};

// Exported so tests can assert this stays in sync with the TRANSITIONS state
// machine in src/lib/actions/expenses.ts (which can't be imported directly —
// it's a "use server" file, and Next.js only allows async function exports
// from those). Keep both in sync by hand: every TRANSITIONS entry must have a
// matching entry here for each status in its `from` list.
export const STATUS_ACTIONS: Record<string, { key: string; label: string; variant?: "default" | "destructive" | "outline"; permission: string }[]> = {
  SUBMITTED: [
    { key: "review", label: "Mark as Reviewed", permission: "expenses.review" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
  ],
  APPROVAL_PENDING: [
    { key: "approve", label: "Approve", permission: "expenses.approve" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
  ],
  REVIEWED: [{ key: "markPaid", label: "Mark as Paid", permission: "expenses.mark_paid" }],
};

/** Which of STATUS_ACTIONS[status] the acting user is allowed to see/use.
 * Extracted so it can be unit-tested without rendering the component. */
export function visibleActionsFor(status: string, { permissions }: { permissions: string[] }) {
  const candidates = STATUS_ACTIONS[status] ?? [];
  return candidates.filter((a) => permissions.includes(a.permission));
}

export function ExpenseActions({
  expenseId,
  status,
  permissions,
  reviewedInfo,
  submitterName,
}: {
  expenseId: string;
  status: ExpenseStatus;
  permissions: string[];
  reviewedInfo: ReviewedInfo | null;
  submitterName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const canApprove = permissions.includes("expenses.approve");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(status === "APPROVAL_PENDING" && canApprove);

  const actions = visibleActionsFor(status, { permissions });
  const showReviewedNote = !!reviewedInfo && (status === "REVIEWED" || status === "PAID");
  const nextStage = NEXT_STAGE_LABEL[status];

  function run(key: string, withRemarks?: string) {
    startTransition(async () => {
      const result = await transitionExpenseAction(expenseId, key as never, withRemarks);
      if (!result.success) {
        toast.error(result.error ?? "Action failed");
        return;
      }
      toast.success("Updated");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {/* Workflow summary — always rendered, regardless of whether any action
       * buttons are available below it. A viewer with no permitted actions
       * (e.g. an EMPLOYEE on their own expense) must still see clear status
       * information rather than an empty section; a viewer who *can* act
       * sees this exact same summary, with their buttons rendered after it. */}
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-muted-foreground">Status</span>
        <Badge variant={EXPENSE_STATUS_VARIANT[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>
      </div>
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-muted-foreground">Submitted by</span>
        <span className="font-medium">{submitterName}</span>
      </div>

      {showReviewedNote && reviewedInfo && (
        <div className="flex w-full items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Reviewed by {reviewedInfo.byName} on {formatDate(reviewedInfo.at)}</span>
        </div>
      )}
      {!showReviewedNote && status === "SUBMITTED" && (
        <div className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Awaiting review</span>
        </div>
      )}
      {!showReviewedNote && status === "APPROVAL_PENDING" && (
        <div className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Awaiting admin approval</span>
        </div>
      )}
      {status === "REJECTED" && (
        <div className="flex w-full items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span>This expense was rejected.</span>
        </div>
      )}
      {nextStage && <p className="w-full text-xs text-muted-foreground">Next: {nextStage}</p>}

      {actions.map((a) =>
        a.key === "reject" ? (
          <Button key={a.key} variant={a.variant} disabled={pending} onClick={() => setRejectOpen(true)}>
            {a.label}
          </Button>
        ) : (
          <Button key={a.key} variant={a.variant} disabled={pending} onClick={() => run(a.key)}>
            {a.label}
          </Button>
        )
      )}

      <AlertDialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject expense</AlertDialogTitle>
            <AlertDialogDescription>A reason is required and will be visible to the submitter.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="e.g. Invoice does not match submitted amount."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRemarks("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!remarks.trim()}
              onClick={() => {
                run("reject", remarks);
                setRejectOpen(false);
                setRemarks("");
              }}
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shown once, automatically, to an approver opening a no-invoice expense —
       * explains why it's stuck here before they see the plain Approve/Reject
       * buttons above. Dismissible: closing it doesn't remove those buttons. */}
      <AlertDialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approval required — no invoice attached</AlertDialogTitle>
            <AlertDialogDescription>
              This expense was submitted without an invoice or bill. It needs your explicit
              approval before it can proceed — approving it moves it into the normal review
              flow; rejecting it ends it here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review details first</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setApprovalDialogOpen(false);
                run("approve");
              }}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
