import {
  IndianRupee,
  CalendarClock,
  ClipboardList,
  Wallet,
  Fuel,
  Wrench,
  Route,
  PiggyBank,
  Gauge,
  AlertTriangle,
} from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart, RankingBarChart, BudgetVsActualChart, YoyTrendChart } from "@/components/dashboard/charts";
import { SpendingAnomalies } from "@/components/dashboard/spending-anomalies";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { OperationsHub } from "@/components/dashboard/operations-hub";
import { TabsContent } from "@/components/ui/tabs";
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
  getMachineMaintenanceCost,
  getVehicleFuelCost,
  getBudgetVsActual,
  getSpendEfficiencyKpis,
  getSpendingAnomalies,
  getRecentTripsSummary,
  getFleetCounts,
  getFuelTypeBreakdown,
} from "@/lib/services/dashboard";

/** Company-wide analytics dashboard — SUPER_ADMIN/ADMIN/ACCOUNTS only.
 * Organizes KPIs and analytics into logical, focused tabbed views to prevent
 * overwhelming single-page scroll. */
export async function CompanyDashboard({
  session,
  tab,
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
    machineCosts,
    vehicleFuel,
    budgetVsActual,
    efficiency,
    anomalies,
    transportSummary,
    fleetCounts,
    fuelBreakdown,
  ] = await Promise.all([
    getKpis(session),
    getExpenseTrend(session, 12),
    getDailyExpenseTrend(session, 30),
    getExpenseTrendYoy(session, 12),
    getExpenseByCategory(session),
    getDepartmentSpending(session),
    getTopVendors(session, 5),
    getMachineMaintenanceCost(session, 5),
    getVehicleFuelCost(session, 5),
    getBudgetVsActual(session),
    getSpendEfficiencyKpis(session),
    getSpendingAnomalies(session),
    getRecentTripsSummary(session, 4),
    getFleetCounts(session),
    getFuelTypeBreakdown(session),
  ]);

  const budgetUtilizationPct = kpis.budgetUtilizationPct ? Math.round(kpis.budgetUtilizationPct * 100) : 0;
  const validTabs = ["overview", "operations", "analysis", "all"];
  const defaultTab = tab && validTabs.includes(tab) ? tab : "overview";

  const now = new Date();
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthLabel = prevMonthDate.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  const renderFinancialKpis = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard label="Total Expenses" value={kpis.totalExpenses} icon={IndianRupee} subtext="Approved + paid" />
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
      <KpiCard label="Outstanding Payments" value={kpis.outstandingPaymentsAmount} icon={Wallet} subtext="Approved, unpaid" />
      <KpiCard
        label="Budget Utilization"
        value={budgetUtilizationPct}
        icon={PiggyBank}
        formatAsCurrency={false}
        subtext={`${budgetUtilizationPct}% used this month`}
      />
    </div>
  );

  const renderOperationalKpis = () => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <KpiCard
        label="Fuel (Month)"
        value={kpis.fuelExpensesThisMonth}
        icon={Fuel}
        subtext={kpis.fuelExpensesThisMonth === 0 ? "No fuel logged" : undefined}
      />
      <KpiCard
        label="Maintenance (Month)"
        value={kpis.maintenanceExpensesThisMonth}
        icon={Wrench}
        subtext={kpis.maintenanceExpensesThisMonth === 0 ? "No maintenance logged" : undefined}
      />
      <KpiCard
        label="Transport (Month)"
        value={kpis.transportExpensesThisMonth}
        icon={Route}
        subtext={kpis.transportExpensesThisMonth === 0 ? "No trips logged" : undefined}
      />
      <KpiCard
        label="Fuel Cost / km"
        value={efficiency.fuelCostPerKm ?? 0}
        precise
        icon={Gauge}
        formattedValue={efficiency.fuelCostPerKm === null ? "—" : undefined}
        deltaPct={efficiency.fuelCostPerKmChangePct}
        deltaLabel={`vs ${previousMonthLabel}`}
        subtext={efficiency.fuelCostPerKm === null ? "Awaiting mileage logs" : undefined}
      />
      <KpiCard
        label="Cost / Machine"
        value={efficiency.maintenanceCostPerMachine ?? 0}
        icon={Wrench}
        deltaPct={efficiency.maintenanceCostPerMachineChangePct}
        deltaLabel={`vs ${previousMonthLabel}`}
        subtext={
          efficiency.maintenanceCostPerMachine === null
            ? "No active machines"
            : `${efficiency.activeMachineCount} active machine(s)`
        }
      />
    </div>
  );

  const renderOverviewCharts = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="lg:col-span-2">
        <CardContent className="pt-6">
          <TrendChart data={trend} dailyData={dailyTrend} />
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

      <Card>
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
    </div>
  );

  const renderSpendAnalysisCharts = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          <CardTitle className="text-base">This Year vs Last Year</CardTitle>
        </CardHeader>
        <CardContent>
          <YoyTrendChart data={trendYoy} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <DashboardTabs
      defaultTab={defaultTab}
      title="Dashboard"
      description="Company-wide cost overview, vehicles, and plant machinery analytics"
    >
        <TabsContent value="overview" className="space-y-6">
          {renderFinancialKpis()}
          {renderOverviewCharts()}
        </TabsContent>

        <TabsContent value="operations" className="space-y-6">
          {renderOperationalKpis()}
          <OperationsHub
            vehicles={vehicleFuel}
            machines={machineCosts}
            transportSummary={transportSummary}
            totalVehicles={fleetCounts.totalVehicles}
            totalMachines={fleetCounts.totalMachines}
            fuelBreakdown={fuelBreakdown}
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {renderSpendAnalysisCharts()}
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Financial Overview</h2>
            {renderFinancialKpis()}
          </div>

          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Vehicles & Machinery</h2>
            {renderOperationalKpis()}
            <OperationsHub
              vehicles={vehicleFuel}
              machines={machineCosts}
              transportSummary={transportSummary}
              totalVehicles={fleetCounts.totalVehicles}
              totalMachines={fleetCounts.totalMachines}
              fuelBreakdown={fuelBreakdown}
            />
          </div>

          <div className="pt-2">
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">Analytics & Trends</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="lg:col-span-2">
                <CardContent className="pt-6"><TrendChart data={trend} dailyData={dailyTrend} /></CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">This Year vs Last Year</CardTitle></CardHeader>
                <CardContent><YoyTrendChart data={trendYoy} /></CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    Spending Anomalies — this month vs 3-month average
                  </CardTitle>
                </CardHeader>
                <CardContent><SpendingAnomalies data={anomalies} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Expense by Category</CardTitle></CardHeader>
                <CardContent><RankingBarChart data={byCategory} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Department Spending</CardTitle></CardHeader>
                <CardContent><RankingBarChart data={byDepartment} /></CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Top Vendors</CardTitle></CardHeader>
                <CardContent><RankingBarChart data={topVendors} /></CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Budget vs Actual — this month</CardTitle></CardHeader>
                <CardContent><BudgetVsActualChart data={budgetVsActual} /></CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </DashboardTabs>
  );
}
