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
import type { ReviewedInfo, VerifiedInfo } from "@/lib/expense-verification";
import { formatDate } from "@/lib/format";
import { CheckCircle2, Circle } from "lucide-react";

// Exported so tests can assert this stays in sync with the TRANSITIONS state
// machine in src/lib/actions/expenses.ts (which can't be imported directly —
// it's a "use server" file, and Next.js only allows async function exports
// from those). Keep both in sync by hand: every TRANSITIONS entry must have a
// matching entry here for each status in its `from` list.
export const STATUS_ACTIONS: Record<string, { key: string; label: string; variant?: "default" | "destructive" | "outline"; ownerOnly?: boolean; permission?: string }[]> = {
  DRAFT: [
    { key: "submit", label: "Submit for approval", ownerOnly: true },
    { key: "cancel", label: "Cancel", variant: "outline", ownerOnly: true },
  ],
  SUBMITTED: [
    // "Move to Review" — distinct from UNDER_REVIEW's "Confirm Verified" below —
    // this changes the expense's status; that one only logs a checkpoint. Two
    // near-identical "Mark ___ed" labels here previously read as one repeated,
    // flaky button to users stepping through SUBMITTED -> UNDER_REVIEW -> verify.
    { key: "review", label: "Move to Review", permission: "expenses.review" },
    { key: "approve", label: "Approve", permission: "expenses.approve" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
    { key: "cancel", label: "Cancel", variant: "outline", ownerOnly: true },
  ],
  UNDER_REVIEW: [
    { key: "verify", label: "Confirm Verified", permission: "expenses.verify" },
    { key: "approve", label: "Approve", permission: "expenses.approve" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
  ],
  APPROVED: [{ key: "markPaid", label: "Mark as paid", permission: "expenses.mark_paid" }],
};

/** Which of STATUS_ACTIONS[status] the acting user is allowed to see/use. Extracted
 * so it can be unit-tested without rendering the component.
 *
 * `alreadyVerified` hides "Mark verified" once a VERIFIED approval already
 * exists for the expense's current review cycle — "verify" only writes an
 * ExpenseApproval row, not a status change, so without this the button would
 * stay visible (and clickable again) forever. See src/lib/expense-verification.ts. */
export function visibleActionsFor(
  status: string,
  { roles, permissions, isOwner, alreadyVerified = false }: { roles: string[]; permissions: string[]; isOwner: boolean; alreadyVerified?: boolean }
) {
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
  const candidates = STATUS_ACTIONS[status] ?? [];
  return candidates.filter((a) => {
    if (a.key === "verify" && alreadyVerified) return false;
    if (a.ownerOnly) return isOwner || isAdmin;
    return a.permission ? permissions.includes(a.permission) : false;
  });
}

/** Reviewed -> Verified -> Approved progress, for expenses still working
 * through the review workflow (SUBMITTED or UNDER_REVIEW). Kept to plain
 * markup/icons — no new dependency — matching the existing "✓ Verified by
 * <name> on <date>" note's style. */
function ReviewProgress({ reviewed, verified, approved }: { reviewed: boolean; verified: boolean; approved: boolean }) {
  const steps = [
    { label: "Reviewed", done: reviewed },
    { label: "Verified", done: verified },
    { label: "Approved", done: approved },
  ];
  return (
    <ol aria-label="Review progress" className="flex w-full flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true">→</span>}
          <span className={`flex items-center gap-1 ${s.done ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}>
            {s.done ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            {s.label}
            {s.done && <span className="sr-only"> (done)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ExpenseActions({
  expenseId,
  status,
  roles,
  permissions,
  isOwner,
  reviewedInfo,
  verifiedInfo,
}: {
  expenseId: string;
  status: ExpenseStatus;
  roles: string[];
  permissions: string[];
  isOwner: boolean;
  reviewedInfo: ReviewedInfo | null;
  verifiedInfo: VerifiedInfo | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const actions = visibleActionsFor(status, { roles, permissions, isOwner, alreadyVerified: !!verifiedInfo });
  const showVerifiedNote = !!verifiedInfo && status === "UNDER_REVIEW";
  const showProgress = status === "SUBMITTED" || status === "UNDER_REVIEW";

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

  if (actions.length === 0 && !showVerifiedNote && !showProgress) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {showProgress && (
        // `approved` is always false here — this indicator only renders for
        // SUBMITTED/UNDER_REVIEW — but ReviewProgress takes it explicitly so it
        // stays correct if ever reused somewhere that also shows APPROVED.
        <ReviewProgress reviewed={!!reviewedInfo} verified={!!verifiedInfo} approved={false} />
      )}
      {showVerifiedNote && verifiedInfo && (
        <div className="flex w-full items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Verified by {verifiedInfo.byName} on {formatDate(verifiedInfo.at)}</span>
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
    </div>
  );
}
