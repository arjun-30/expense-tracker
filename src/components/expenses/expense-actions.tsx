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
import type { Role, ExpenseStatus } from "@/generated/prisma/enums";

const ROLE_ACTIONS: Record<string, { key: string; label: string; variant?: "default" | "destructive" | "outline" }[]> = {
  DRAFT: [
    { key: "submit", label: "Submit for approval" },
    { key: "cancel", label: "Cancel", variant: "outline" },
  ],
  SUBMITTED: [
    { key: "review", label: "Mark reviewed" },
    { key: "approve", label: "Approve" },
    { key: "reject", label: "Reject", variant: "destructive" },
  ],
  UNDER_REVIEW: [
    { key: "verify", label: "Mark verified" },
    { key: "approve", label: "Approve" },
    { key: "reject", label: "Reject", variant: "destructive" },
  ],
  APPROVED: [{ key: "markPaid", label: "Mark as paid" }],
};

const ROLE_PERMS: Record<string, string[]> = {
  SUPER_ADMIN: ["submit", "cancel", "review", "verify", "approve", "reject", "markPaid"],
  ADMIN: ["review", "approve", "reject"],
  ACCOUNTS: ["verify", "reject", "markPaid"],
  EMPLOYEE: ["submit", "cancel"],
  PURCHASE_MANAGER: ["submit", "cancel"],
  MAINTENANCE_MANAGER: ["submit", "cancel"],
  TRANSPORT_MANAGER: ["submit", "cancel"],
};

export function ExpenseActions({
  expenseId,
  status,
  role,
  isOwner,
}: {
  expenseId: string;
  status: ExpenseStatus;
  role: Role;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [remarks, setRemarks] = useState("");

  const candidates = ROLE_ACTIONS[status] ?? [];
  const allowedKeys = new Set(ROLE_PERMS[role] ?? []);
  const actions = candidates.filter((a) => {
    const ownerGated = a.key === "submit" || a.key === "cancel";
    if (ownerGated) return isOwner || role === "SUPER_ADMIN" || role === "ADMIN";
    return allowedKeys.has(a.key);
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
