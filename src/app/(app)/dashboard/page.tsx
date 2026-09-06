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
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart, RankingBarChart, BudgetVsActualChart, YoyTrendChart } from "@/components/dashboard/charts";
import { SpendingAnomalies } from "@/components/dashboard/spending-anomalies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { guardModule } from "@/lib/guards";
import {
  getKpis,
  getExpenseTrend,
  getExpenseTrendYoy,
  getExpenseByCategory,
  getDepartmentSpending,
  getTopVendors,
  getMachineMaintenanceCost,
  getVehicleFuelCost,
  getBudgetVsActual,
  getSpendEfficiencyKpis,
  getSpendingAnomalies,
} from "@/lib/services/dashboard";

export default async function DashboardPage() {
  const { session } = await guardModule("dashboard");
  const companyId = session.companyId;
  const [
    kpis,
    trend,
    trendYoy,
    byCategory,
    byDepartment,
    topVendors,
    machineCosts,
    vehicleFuel,
    budgetVsActual,
    efficiency,
    anomalies,
  ] = await Promise.all([
    getKpis(companyId),
    getExpenseTrend(companyId, 12),
    getExpenseTrendYoy(companyId, 12),
    getExpenseByCategory(companyId),
    getDepartmentSpending(companyId),
    getTopVendors(companyId, 5),
    getMachineMaintenanceCost(companyId, 5),
    getVehicleFuelCost(companyId, 5),
    getBudgetVsActual(companyId),
    getSpendEfficiencyKpis(companyId),
    getSpendingAnomalies(companyId),
  ]);

  // A company with no budgets configured for this period has
  // budgetUtilizationPct === null — compute the displayed 0% once, rather
  // than repeating the same null-check inline at each spot that needs it.
  const budgetUtilizationPct = kpis.budgetUtilizationPct ? Math.round(kpis.budgetUtilizationPct * 100) : 0;

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
          value={budgetUtilizationPct}
          icon={PiggyBank}
          formatAsCurrency={false}
          subtext={`${budgetUtilizationPct}% of this month's budget used`}
        />
        <KpiCard label="Fuel (this month)" value={kpis.fuelExpensesThisMonth} icon={Fuel} subtext="Across all vehicles" />
        <KpiCard label="Maintenance (this month)" value={kpis.maintenanceExpensesThisMonth} icon={Wrench} subtext="Labour + spares + other" />
        <KpiCard label="Transportation (this month)" value={kpis.transportExpensesThisMonth} icon={Route} subtext="Freight, loading, toll etc." />
        <KpiCard label="Spare Parts (this month)" value={kpis.sparePartsExpensesThisMonth} icon={PackageSearch} subtext="Purchased inventory value" />
        <KpiCard
          label="Fuel Cost / km"
          value={efficiency.fuelCostPerKm ?? 0}
          precise
          icon={Gauge}
          deltaPct={efficiency.fuelCostPerKmChangePct}
          deltaLabel="vs last month"
          subtext={efficiency.fuelCostPerKm === null ? "No fuel data with distance this month" : undefined}
        />
        <KpiCard
          label="Maintenance Cost / Machine"
          value={efficiency.maintenanceCostPerMachine ?? 0}
          icon={Wrench}
          deltaPct={efficiency.maintenanceCostPerMachineChangePct}
          deltaLabel="vs last month"
          subtext={
            efficiency.maintenanceCostPerMachine === null
              ? "No active machines"
              : `Across ${efficiency.activeMachineCount} active machine(s)`
          }
        />
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
