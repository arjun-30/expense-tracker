import type { ExpenseStatus } from "@/generated/prisma/enums";

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const EXPENSE_STATUS_VARIANT: Record<ExpenseStatus, "default" | "secondary" | "destructive" | "outline" | "success"> = {
  DRAFT: "outline",
  SUBMITTED: "secondary",
  UNDER_REVIEW: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
  PAID: "success",
  CANCELLED: "outline",
};
