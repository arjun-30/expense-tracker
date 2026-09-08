import { ExpenseStatus } from "@/generated/prisma/enums";

/** Every real ExpenseStatus value — shared so any page validating an incoming
 * ?status= query param (Expenses list, Dashboard) uses the exact same set. */
export const VALID_EXPENSE_STATUSES = new Set<string>(Object.values(ExpenseStatus));

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  SUBMITTED: "Submitted",
  APPROVAL_PENDING: "Approval Pending",
  APPROVED: "Approved",
  REVIEWED: "Reviewed",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export const EXPENSE_STATUS_VARIANT: Record<ExpenseStatus, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  SUBMITTED: "secondary",
  APPROVAL_PENDING: "outline",
  APPROVED: "secondary",
  REVIEWED: "secondary",
  REJECTED: "destructive",
  PAID: "success",
};
