import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Clickable expense-status count card. `href` is supplied by the caller (the
 * personal dashboard points it at its own ?status= filter, same page) rather
 * than being constructed here, so this component doesn't need to know where
 * it's used. `tone` reuses this app's existing --destructive/--status-good
 * tokens — the same families behind the Expense List's red row highlight and
 * the "Paid" success badge — rather than introducing new colors; omit it for
 * plain/default styling. */
export function StatusCard({
  label,
  count,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  count: number;
  icon: LucideIcon;
  href: string;
  tone?: "destructive" | "success";
}) {
  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          "transition-shadow hover:shadow-md",
          tone === "destructive" && "bg-destructive/10 hover:bg-destructive/15",
          tone === "success" && "bg-status-good/10 hover:bg-status-good/15",
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              tone === "destructive" && "bg-destructive/15 text-destructive",
              tone === "success" && "bg-status-good/15 text-status-good",
              !tone && "bg-primary/10 text-primary",
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
