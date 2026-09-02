import {
  IndianRupee,
  CalendarClock,
  ClipboardList,
  Wallet,
  Fuel,
  Wrench,
  Route,
  PackageSearch,
  PiggyBank,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart, RankingBarChart, BudgetVsActualChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardModule } from "@/lib/guards";
import {
  getKpis,
  getExpenseTrend,
  getExpenseByCategory,
  getDepartmentSpending,
  getTopVendors,
  getMachineMaintenanceCost,
  getVehicleFuelCost,
  getBudgetVsActual,
} from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const { session } = await guardModule("dashboard");
  const companyId = session.companyId;
  const [kpis, trend, byCategory, byDepartment, topVendors, machineCosts, vehicleFuel, budgetVsActual] =
    await Promise.all([
      getKpis(companyId),
      getExpenseTrend(companyId, 12),
      getExpenseByCategory(companyId),
      getDepartmentSpending(companyId),
      getTopVendors(companyId, 5),
      getMachineMaintenanceCost(companyId, 5),
      getVehicleFuelCost(companyId, 5),
      getBudgetVsActual(companyId),
    ]);

  return (
    <div>
      <PageHeader title="Dashboard" description="Company-wide cost overview" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Total Expenses" value={kpis.totalExpenses} icon={IndianRupee} subtext="All time, approved + paid" />
        <KpiCard
          label="This Month"
          value={kpis.currentMonthExpenses}
          icon={CalendarClock}
          deltaPct={kpis.momChangePct}
          deltaGoodDirection="down"
        />
        <KpiCard label="Pending Approvals" value={kpis.pendingApprovalsCount} icon={ClipboardList} formatAsCurrency={false} subtext="Expenses awaiting action" />
        <KpiCard label="Outstanding Payments" value={kpis.outstandingPaymentsAmount} icon={Wallet} subtext="Approved, not yet paid" />
        <KpiCard
          label="Budget Utilization"
          value={kpis.budgetUtilizationPct ? Math.round(kpis.budgetUtilizationPct * 100) : 0}
          icon={PiggyBank}
          formatAsCurrency={false}
          subtext={`${kpis.budgetUtilizationPct ? (kpis.budgetUtilizationPct * 100).toFixed(0) : 0}% of this month's budget used`}
        />
        <KpiCard label="Fuel (this month)" value={kpis.fuelExpensesThisMonth} icon={Fuel} subtext="Across all vehicles" />
        <KpiCard label="Maintenance (this month)" value={kpis.maintenanceExpensesThisMonth} icon={Wrench} subtext="Labour + spares + other" />
        <KpiCard label="Transportation (this month)" value={kpis.transportExpensesThisMonth} icon={Route} subtext="Freight, loading, toll etc." />
        <KpiCard label="Spare Parts (this month)" value={kpis.sparePartsExpensesThisMonth} icon={PackageSearch} subtext="Purchased inventory value" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Expense Trend — last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={trend} />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={topVendors} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Machine Maintenance Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={machineCosts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Vehicle Fuel Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingBarChart data={vehicleFuel} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget vs Actual — this month</CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetVsActualChart data={budgetVsActual} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
