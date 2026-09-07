import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Clickable expense-status count card for the personal dashboard — links straight
 * to the pre-filtered Expenses list, so the viewer never has to touch the status
 * dropdown manually. `highlight` reuses the exact approval-pending-highlight
 * treatment already built for the Expense List row (globals.css), rather than
 * introducing a second version of the same styling. */
export function StatusCard({
  label,
  count,
  icon: Icon,
  status,
  highlight = false,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  status: string;
  highlight?: boolean;
}) {
  return (
    <Link href={`/expenses?status=${status}`} className="block">
      <Card
        className={cn(
          "transition-shadow hover:shadow-md",
          highlight && "border-l-4 border-l-destructive bg-destructive/10 hover:bg-destructive/15 approval-pending-highlight",
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              highlight ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="font-heading text-2xl font-semibold tabular-nums">{count.toLocaleString("en-IN")}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
