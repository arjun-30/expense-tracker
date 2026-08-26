import Link from "next/link";
import { Receipt, Fuel, Route, Wrench, PackageSearch, PiggyBank, ArrowRight } from "lucide-react";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REPORTS = [
  { href: "/reports/expenses", title: "Expense Reports", description: "Daily, monthly, category, department and vendor-wise", icon: Receipt },
  { href: "/reports/fuel", title: "Fuel Reports", description: "Vehicle-wise fuel, consumption and efficiency", icon: Fuel },
  { href: "/reports/transportation", title: "Transportation Reports", description: "Trip-wise, vehicle-wise, cost/kg", icon: Route },
  { href: "/reports/maintenance", title: "Machinery Reports", description: "Maintenance cost, downtime, breakdown history", icon: Wrench },
  { href: "/reports/spares", title: "Spare Reports", description: "Stock, consumption and low-stock", icon: PackageSearch },
  { href: "/reports/budgets", title: "Budget Reports", description: "Budget vs actual, variance", icon: PiggyBank },
];

export default async function ReportsPage() {
  const { allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  return (
    <div>
      <PageHeader title="Reports" description="Export-ready reports across every module" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href}>
            <Card className="h-full transition-colors hover:bg-accent">
              <CardHeader className="flex flex-row items-center gap-3">
                <r.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{r.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                {r.description}
                <ArrowRight className="h-4 w-4 shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
