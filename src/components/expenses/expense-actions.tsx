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

const STATUS_ACTIONS: Record<string, { key: string; label: string; variant?: "default" | "destructive" | "outline"; ownerOnly?: boolean; permission?: string }[]> = {
  DRAFT: [
    { key: "submit", label: "Submit for approval", ownerOnly: true },
    { key: "cancel", label: "Cancel", variant: "outline", ownerOnly: true },
  ],
  SUBMITTED: [
    { key: "review", label: "Mark reviewed", permission: "expenses.review" },
    { key: "approve", label: "Approve", permission: "expenses.approve" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
  ],
  UNDER_REVIEW: [
    { key: "verify", label: "Mark verified", permission: "expenses.verify" },
    { key: "approve", label: "Approve", permission: "expenses.approve" },
    { key: "reject", label: "Reject", variant: "destructive", permission: "expenses.reject" },
  ],
  APPROVED: [{ key: "markPaid", label: "Mark as paid", permission: "expenses.mark_paid" }],
};

export function ExpenseActions({
  expenseId,
  status,
  roles,
  permissions,
  isOwner,
}: {
  expenseId: string;
  status: ExpenseStatus;
  roles: string[];
  permissions: string[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("ADMIN");
  const candidates = STATUS_ACTIONS[status] ?? [];
  const actions = candidates.filter((a) => {
    if (a.ownerOnly) return isOwner || isAdmin;
    return a.permission ? permissions.includes(a.permission) : false;
  });

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

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
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
