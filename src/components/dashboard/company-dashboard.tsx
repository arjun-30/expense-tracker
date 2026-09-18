import {
  IndianRupee,
  CalendarClock,
  ClipboardList,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart, RankingBarChart, YoyTrendChart } from "@/components/dashboard/charts";
import { SpendingAnomalies } from "@/components/dashboard/spending-anomalies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SessionPayload } from "@/lib/session";
import {
  getKpis,
  getExpenseTrend,
  getDailyExpenseTrend,
  getExpenseTrendYoy,
  getExpenseByCategory,
  getDepartmentSpending,
  getTopVendors,
  getSpendingAnomalies,
} from "@/lib/services/dashboard";

/** Company-wide analytics dashboard for Phase 1 Core system */
export async function CompanyDashboard({
  session,
}: {
  session: SessionPayload;
  tab?: string;
}) {
  const [
    kpis,
    trend,
    dailyTrend,
    trendYoy,
    byCategory,
    byDepartment,
    topVendors,
    anomalies,
  ] = await Promise.all([
    getKpis(session),
    getExpenseTrend(session, 12),
    getDailyExpenseTrend(session, 30),
    getExpenseTrendYoy(session, 12),
    getExpenseByCategory(session),
    getDepartmentSpending(session),
    getTopVendors(session, 5),
    getSpendingAnomalies(session),
  ]);

  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthLabel = prevMonthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Company-wide expense analytics, department cost distribution, and spending trends"
      />

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Expenses"
          value={kpis.totalExpenses}
          icon={IndianRupee}
          subtext="Approved + paid"
        />
        <KpiCard
          label="This Month"
          value={kpis.currentMonthExpenses}
          icon={CalendarClock}
          deltaPct={kpis.momChangePct}
          deltaGoodDirection="down"
          deltaLabel={`vs ${previousMonthLabel}`}
        />
        <KpiCard
          label="Pending Approvals"
          value={kpis.pendingApprovalsCount}
          icon={ClipboardList}
          formatAsCurrency={false}
          subtext={kpis.pendingApprovalsCount > 0 ? "Awaiting action" : "All clear"}
        />
        <KpiCard
          label="Outstanding Payments"
          value={kpis.outstandingPaymentsAmount}
          icon={Wallet}
          subtext="Approved, unpaid"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardContent className="pt-6">
            <TrendChart data={trend} dailyData={dailyTrend} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">This Year vs Last Year</CardTitle>
          </CardHeader>
          <CardContent>
            <YoyTrendChart data={trendYoy} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Spending Anomalies — this month vs 3-month average
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingAnomalies data={anomalies} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={byCategory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Spending</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={byDepartment} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={topVendors} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
