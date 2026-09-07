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
import { transitionExpenseAction } from "@/lib/actions/expenses";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import type { ReviewedInfo } from "@/lib/expense-verification";
import { formatDate } from "@/lib/format";
import { CheckCircle2 } from "lucide-react";

// Exported so tests can assert this stays in sync with the TRANSITIONS state
// machine in src/lib/actions/expenses.ts (which can't be imported directly —
// it's a "use server" file, and Next.js only allows async function exports
// from those). Keep both in sync by hand: every TRANSITIONS entry must have a
// matching entry here for each status in its `from` list.
export const STATUS_ACTIONS: Record<string, { key: string; label: string; variant?: "default" | "destructive" | "outline"; permission: string }[]> = {
  SUBMITTED: [
    { key: "review", label: "Move to Review", permission: "expenses.review" },
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
}: {
  expenseId: string;
  status: ExpenseStatus;
  permissions: string[];
  reviewedInfo: ReviewedInfo | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const canApprove = permissions.includes("expenses.approve");
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(status === "APPROVAL_PENDING" && canApprove);

  const actions = visibleActionsFor(status, { permissions });
  const showReviewedNote = !!reviewedInfo && (status === "REVIEWED" || status === "PAID");

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

  if (actions.length === 0 && !showReviewedNote) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {showReviewedNote && reviewedInfo && (
        <div className="flex w-full items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Reviewed by {reviewedInfo.byName} on {formatDate(reviewedInfo.at)}</span>
        </div>
      )}
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
