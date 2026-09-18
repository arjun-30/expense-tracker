import { Clock, Check, CheckCheck, FileCheck, Send, XCircle } from "lucide-react";
import { EXPENSE_STATUS_LABELS } from "@/lib/status-labels";
import type { ExpenseStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  ExpenseStatus,
  {
    icon: typeof Clock;
    colorClass: string;
    iconColor: string;
  }
> = {
  APPROVAL_PENDING: {
    icon: Clock,
    colorClass: "text-destructive font-semibold animate-pulse",
    iconColor: "text-destructive",
  },
  PAID: {
    icon: Check,
    colorClass: "text-emerald-600 dark:text-emerald-400 font-medium",
    iconColor: "text-emerald-500",
  },
  APPROVED: {
    icon: CheckCheck,
    colorClass: "text-blue-600 dark:text-blue-400 font-medium",
    iconColor: "text-blue-500",
  },
  REVIEWED: {
    icon: FileCheck,
    colorClass: "text-sky-600 dark:text-sky-400 font-medium",
    iconColor: "text-sky-500",
  },
  SUBMITTED: {
    icon: Send,
    colorClass: "text-amber-600 dark:text-amber-400 font-medium",
    iconColor: "text-amber-500",
  },
  REJECTED: {
    icon: XCircle,
    colorClass: "text-rose-600 dark:text-rose-400 font-medium",
    iconColor: "text-rose-500",
  },
};

export function ExpenseStatusDisplay({ status }: { status: ExpenseStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs whitespace-nowrap", config.colorClass)}>
      <Icon className={cn("h-3.5 w-3.5 shrink-0", config.iconColor)} />
      <span>{EXPENSE_STATUS_LABELS[status]}</span>
    </span>
  );
}
