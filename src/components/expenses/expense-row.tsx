"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EXPENSE_STATUS_LABELS, EXPENSE_STATUS_VARIANT } from "@/lib/status-labels";
import { formatDate, formatINR } from "@/lib/format";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

/** A whole clickable expense row — navigates to the expense's detail page
 * when clicked anywhere in the row (matching what the Expense # link already
 * did), while "View Bill" (and the Expense # link itself) stop propagation
 * so they open their own target instead of also triggering the row's
 * navigation. TableRow's own base styling already includes hover:bg-muted/50
 * (see ui/table.tsx), which tailwind-merge correctly resolves against the
 * Approval Pending row's own hover:bg-destructive/15 below — no separate
 * hover class is needed here for the default case. */
export function ExpenseRow({
  id,
  expenseNumber,
  expenseDate,
  categoryName,
  vendorName,
  departmentName,
  employeeName,
  totalAmount,
  status,
  billStorageKey,
}: {
  id: string;
  expenseNumber: string;
  expenseDate: Date | string;
  categoryName: string;
  vendorName: string | null;
  departmentName: string;
  employeeName: string;
  totalAmount: number;
  status: ExpenseStatus;
  billStorageKey: string | null;
}) {
  const router = useRouter();
  const approvalPending = status === "APPROVAL_PENDING";

  return (
    <TableRow
      onClick={() => router.push(`/expenses/${id}`)}
      className={cn(
        "cursor-pointer",
        // Persistent, accessible "needs approval" highlight — a static
        // red-tinted background/full-perimeter border always applies;
        // approval-pending-highlight (globals.css) adds a subtle border
        // color pulse on top, but only for prefers-reduced-motion: no-preference.
        // Derived live from status, so it vanishes the moment this expense
        // is approved or rejected.
        //
        // The border is a box-shadow (shadow-[inset_...]), not a real
        // `border` utility: this table has border-collapse:collapse
        // (Tailwind's preflight default), under which a <tr>'s own border
        // renders unreliably across browsers — box-shadow sits entirely
        // outside the table border model, so it's unaffected. border-
        // transparent hides the base TableRow's inherited grey border-b
        // (from the global `* { border-color: var(--border) }` base rule)
        // so it can't peek out from behind the shadow at the bottom edge.
        approvalPending &&
          "border-transparent bg-destructive/10 shadow-[inset_0_0_0_2px_var(--approval-pending-accent)] hover:bg-destructive/15 approval-pending-highlight",
      )}
    >
      <TableCell className="font-medium">
        <Link href={`/expenses/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {expenseNumber}
        </Link>
      </TableCell>
      <TableCell>{formatDate(expenseDate)}</TableCell>
      <TableCell>{categoryName}</TableCell>
      <TableCell>{vendorName ?? "—"}</TableCell>
      <TableCell>{departmentName}</TableCell>
      <TableCell>{employeeName}</TableCell>
      <TableCell className="text-right tabular-nums">{formatINR(totalAmount)}</TableCell>
      <TableCell>
        <Badge variant={EXPENSE_STATUS_VARIANT[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>
      </TableCell>
      <TableCell>
        {billStorageKey ? (
          <a
            href={`/api/files/${billStorageKey}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            title="View bill"
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="h-4 w-4" /> View Bill
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">No Bill</span>
        )}
      </TableCell>
    </TableRow>
  );
}
