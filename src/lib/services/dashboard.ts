import "server-only";
import { prisma } from "@/lib/db";
import { budgetUtilizationRatio, percentChange, fuelCostPerKm, averagePerUnit } from "@/lib/services/calculations";
import { actualSpendForAllocation } from "@/lib/services/budgets";
import { ExpenseStatus, MachineStatus } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";

// Finalized spend = PAID only (invoice-presence-gated workflow; APPROVED and
// REVIEWED are pre-payment checkpoints, not committed spend).
const FINALIZED: ExpenseStatus[] = [ExpenseStatus.PAID];

// A dimension's current-month spend must swing at least this much off its
// trailing 3-month average, and clear this floor, before it's surfaced as an
// anomaly — keeps small/noisy categories from drowning out real spikes.
const ANOMALY_THRESHOLD_PCT = 40;
const ANOMALY_MIN_AMOUNT = 2000;

function toNumber(d: unknown): number {
  return d === null || d === undefined ? 0 : Number(d);
}

function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return { start, end };
}

export async function getKpis(companyId: string) {
  const { start: thisMonthStart, end: thisMonthEnd } = monthBounds(0);
  const { start: lastMonthStart, end: lastMonthEnd } = monthBounds(-1);

  const [
    totalExpensesAgg,
    thisMonthAgg,
    lastMonthAgg,
    pendingApprovalsCount,
    outstandingAgg,
    fuelAgg,
    maintenanceAgg,
    transportAgg,
    consumablesAgg,
    budgets,
  ] = await Promise.all([
    prisma.expense.aggregate({ where: { companyId, status: { in: FINALIZED } }, _sum: { totalAmount: true } }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: FINALIZED }, expenseDate: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { companyId, status: { in: FINALIZED }, expenseDate: { gte: lastMonthStart, lt: lastMonthEnd } },
      _sum: { totalAmount: true },
    }),
    // Awaiting a review/approval decision — SUBMITTED (with invoice, not yet
    // reviewed) or APPROVAL_PENDING (no invoice, awaiting admin approval).
    // REVIEWED expenses have already passed every decision gate and are
    // just awaiting payment processing, so they're not "pending approval".
    prisma.expense.count({ where: { companyId, status: { in: ["SUBMITTED", "APPROVAL_PENDING"] } } }),
    // Reviewed-but-not-yet-paid stands in for "outstanding payments" now that
    // Expense no longer carries its own paymentStatus (see prisma/SCHEMA_MIGRATION_NOTES.md §2).
    prisma.expense.aggregate({
      where: { companyId, status: "REVIEWED" },
      _sum: { totalAmount: true },
    }),
    prisma.fuelTransaction.aggregate({
      where: { vehicle: { companyId }, date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: { machine: { companyId }, createdAt: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.transportTrip.aggregate({
      where: { companyId, date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.consumableStockMovement.aggregate({
      where: { movementType: "PURCHASE", consumable: { companyId }, movementDate: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.budget.findMany({
      where: { companyId, periodStart: { lte: thisMonthEnd }, periodEnd: { gte: thisMonthStart } },
      include: { allocations: true },
    }),
  ]);

  let budgetTotal = 0;
  let budgetActual = 0;
  for (const b of budgets) {
    budgetTotal += toNumber(b.totalAmount);
    for (const alloc of b.allocations) {
      budgetActual += await actualSpendForAllocation(companyId, alloc, b.periodStart, b.periodEnd);
    }
  }

  const totalExpenses = toNumber(totalExpensesAgg._sum?.totalAmount);
  const currentMonthExpenses = toNumber(thisMonthAgg._sum?.totalAmount);
  const lastMonthExpenses = toNumber(lastMonthAgg._sum?.totalAmount);

  return {
    totalExpenses,
    currentMonthExpenses,
    momChangePct: percentChange(currentMonthExpenses, lastMonthExpenses),
    pendingApprovalsCount,
    outstandingPaymentsAmount: toNumber(outstandingAgg._sum?.totalAmount),
    fuelExpensesThisMonth: toNumber(fuelAgg._sum?.totalAmount),
    maintenanceExpensesThisMonth: toNumber(maintenanceAgg._sum?.totalCost),
    transportExpensesThisMonth: toNumber(transportAgg._sum?.totalCost),
    sparePartsExpensesThisMonth: toNumber(consumablesAgg._sum?.totalCost),
    budgetUtilizationPct: budgetUtilizationRatio(budgetTotal, budgetActual),
    budgetTotal,
    budgetActual,
  };
}

export async function getExpenseTrend(companyId: string, months = 12) {
  const rows = await prisma.$queryRaw<{ month: Date; total: number }[]>`
    SELECT date_trunc('month', "expense_date") AS month, SUM("total_amount")::float AS total
    FROM "expenses"
    WHERE "company_id" = ${companyId}
      AND "status" = 'PAID'
      AND "expense_date" >= (date_trunc('month', now()) - (${months - 1} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    month: new Date(r.month).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    total: Number(r.total),
  }));
}

export async function getExpenseByCategory(companyId: string) {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { companyId, status: { in: FINALIZED } },
    _sum: { totalAmount: true },
  });
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
  });
  const names = new Map(categories.map((c) => [c.id, c.name]));
  return grouped
    .map((g) => ({ name: names.get(g.categoryId) ?? "Unknown", value: toNumber(g._sum?.totalAmount) }))
    .sort((a, b) => b.value - a.value);
}

export async function getDepartmentSpending(companyId: string) {
  const grouped = await prisma.expense.groupBy({
    by: ["departmentId"],
    where: { companyId, status: { in: FINALIZED } },
    _sum: { totalAmount: true },
  });
  const departments = await prisma.department.findMany({
    where: { id: { in: grouped.map((g) => g.departmentId) } },
  });
  const names = new Map(departments.map((d) => [d.id, d.name]));
  return grouped
    .map((g) => ({ name: names.get(g.departmentId) ?? "Unknown", value: toNumber(g._sum?.totalAmount) }))
    .sort((a, b) => b.value - a.value);
}

export async function getTopVendors(companyId: string, limit = 5) {
  const grouped = await prisma.expense.groupBy({
    by: ["vendorId"],
    where: { companyId, status: { in: FINALIZED }, vendorId: { not: null } },
    _sum: { totalAmount: true },
  });
  const ids = grouped.map((g) => g.vendorId).filter((v): v is string => !!v);
  const vendors = await prisma.vendor.findMany({ where: { id: { in: ids } } });
  const names = new Map(vendors.map((v) => [v.id, v.name]));
  return grouped
    .map((g) => ({ name: names.get(g.vendorId!) ?? "Unknown", value: toNumber(g._sum?.totalAmount) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getMachineMaintenanceCost(companyId: string, limit = 5) {
  const grouped = await prisma.maintenanceRecord.groupBy({
    by: ["machineId"],
    where: { machine: { companyId } },
    _sum: { totalCost: true },
  });
  const machines = await prisma.machine.findMany({ where: { id: { in: grouped.map((g) => g.machineId) } } });
  const names = new Map(machines.map((m) => [m.id, m.name]));
  return grouped
    .map((g) => ({ name: names.get(g.machineId) ?? "Unknown", value: toNumber(g._sum?.totalCost) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getVehicleFuelCost(companyId: string, limit = 5) {
  const grouped = await prisma.fuelTransaction.groupBy({
    by: ["vehicleId"],
    where: { vehicle: { companyId } },
    _sum: { totalAmount: true },
  });
  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: grouped.map((g) => g.vehicleId) } } });
  const names = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));
  return grouped
    .map((g) => ({ name: names.get(g.vehicleId) ?? "Unknown", value: toNumber(g._sum?.totalAmount) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getBudgetVsActual(companyId: string) {
  const { start, end } = monthBounds(0);
  const budgets = await prisma.budget.findMany({
    where: { companyId, periodStart: { lte: end }, periodEnd: { gte: start } },
    include: { allocations: { include: { department: true, category: true, costCenter: true } } },
  });
  const rows = [];
  for (const b of budgets) {
    let actual = 0;
    for (const alloc of b.allocations) {
      actual += await actualSpendForAllocation(companyId, alloc, b.periodStart, b.periodEnd);
    }
    rows.push({
      name: b.name,
      budget: toNumber(b.totalAmount),
      actual,
    });
  }
  return rows;
}

/**
 * Rolling 12-month expense trend alongside the same 12 calendar months one
 * year earlier, so the dashboard trend chart can show growth/contraction
 * against last year rather than just the raw trailing line.
 */
export async function getExpenseTrendYoy(companyId: string, months = 12) {
  // Stale-definition fix (post workflow-replacement): this originally hardcoded
  // 'APPROVED', 'PAID' from the dual-status "finalized" definition that predated
  // the invoice-based workflow. Now reuses FINALIZED, same as getSpendingAnomalies
  // and the rest of this file, so this can't drift from that definition again.
  const rows = await prisma.$queryRaw<{ month: Date; total: number }[]>`
    SELECT date_trunc('month', "expense_date") AS month, SUM("total_amount")::float AS total
    FROM "expenses"
    WHERE "company_id" = ${companyId}
      AND "status" IN (${Prisma.join(FINALIZED)})
      AND "expense_date" >= (date_trunc('month', now()) - (${months - 1 + 12} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `;
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    const d = new Date(r.month);
    byMonth.set(`${d.getFullYear()}-${d.getMonth()}`, Number(r.total));
  }

  const now = new Date();
  const out: { month: string; thisYear: number; lastYear: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const current = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const priorYear = new Date(now.getFullYear() - 1, now.getMonth() - i, 1);
    out.push({
      month: current.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      thisYear: byMonth.get(`${current.getFullYear()}-${current.getMonth()}`) ?? 0,
      lastYear: byMonth.get(`${priorYear.getFullYear()}-${priorYear.getMonth()}`) ?? 0,
    });
  }
  return out;
}

/** Fleet-wide cost-efficiency metrics for the current month, alongside their prior-month comparisons. */
export async function getSpendEfficiencyKpis(companyId: string) {
  const { start: thisStart, end: thisEnd } = monthBounds(0);
  const { start: lastStart, end: lastEnd } = monthBounds(-1);

  const [thisFuel, lastFuel, activeMachineCount, thisMaintenance, lastMaintenance] = await Promise.all([
    prisma.fuelTransaction.aggregate({
      where: { vehicle: { companyId }, date: { gte: thisStart, lt: thisEnd } },
      _sum: { totalAmount: true, distanceTravelled: true },
    }),
    prisma.fuelTransaction.aggregate({
      where: { vehicle: { companyId }, date: { gte: lastStart, lt: lastEnd } },
      _sum: { totalAmount: true, distanceTravelled: true },
    }),
    prisma.machine.count({ where: { companyId, status: { not: MachineStatus.RETIRED } } }),
    prisma.maintenanceRecord.aggregate({
      where: { machine: { companyId }, createdAt: { gte: thisStart, lt: thisEnd } },
      _sum: { totalCost: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: { machine: { companyId }, createdAt: { gte: lastStart, lt: lastEnd } },
      _sum: { totalCost: true },
    }),
  ]);

  const fuelCostPerKmThisMonth = fuelCostPerKm(toNumber(thisFuel._sum?.totalAmount), toNumber(thisFuel._sum?.distanceTravelled));
  const fuelCostPerKmLastMonth = fuelCostPerKm(toNumber(lastFuel._sum?.totalAmount), toNumber(lastFuel._sum?.distanceTravelled));

  const maintenanceCostPerMachineThisMonth = averagePerUnit(toNumber(thisMaintenance._sum?.totalCost), activeMachineCount);
  const maintenanceCostPerMachineLastMonth = averagePerUnit(toNumber(lastMaintenance._sum?.totalCost), activeMachineCount);

  return {
    fuelCostPerKm: fuelCostPerKmThisMonth,
    fuelCostPerKmChangePct:
      fuelCostPerKmThisMonth !== null && fuelCostPerKmLastMonth !== null ? percentChange(fuelCostPerKmThisMonth, fuelCostPerKmLastMonth) : null,
    maintenanceCostPerMachine: maintenanceCostPerMachineThisMonth,
    maintenanceCostPerMachineChangePct:
      maintenanceCostPerMachineThisMonth !== null && maintenanceCostPerMachineLastMonth !== null
        ? percentChange(maintenanceCostPerMachineThisMonth, maintenanceCostPerMachineLastMonth)
        : null,
    activeMachineCount,
  };
}

async function categoryTotalsInWindow(companyId: string, start: Date, end: Date) {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { companyId, status: { in: FINALIZED }, expenseDate: { gte: start, lt: end } },
    _sum: { totalAmount: true },
  });
  return new Map(grouped.map((g) => [g.categoryId, toNumber(g._sum?.totalAmount)]));
}

async function departmentTotalsInWindow(companyId: string, start: Date, end: Date) {
  const grouped = await prisma.expense.groupBy({
    by: ["departmentId"],
    where: { companyId, status: { in: FINALIZED }, expenseDate: { gte: start, lt: end } },
    _sum: { totalAmount: true },
  });
  return new Map(grouped.map((g) => [g.departmentId, toNumber(g._sum?.totalAmount)]));
}

async function vendorTotalsInWindow(companyId: string, start: Date, end: Date) {
  const grouped = await prisma.expense.groupBy({
    by: ["vendorId"],
    where: { companyId, status: { in: FINALIZED }, vendorId: { not: null }, expenseDate: { gte: start, lt: end } },
    _sum: { totalAmount: true },
  });
  return new Map(grouped.map((g) => [g.vendorId as string, toNumber(g._sum?.totalAmount)]));
}

export interface SpendAnomaly {
  type: "Category" | "Department" | "Vendor";
  name: string;
  currentAmount: number;
  trailingAvgAmount: number;
  changePct: number;
}

/**
 * Flags categories/departments/vendors whose current-month spend swings hard
 * off their trailing 3-month average — a cheap stand-in for real forecasting
 * that surfaces the spikes and drops worth a human look.
 */
export async function getSpendingAnomalies(companyId: string, limit = 8): Promise<SpendAnomaly[]> {
  const { start: thisMonthStart, end: thisMonthEnd } = monthBounds(0);
  const trailingStart = monthBounds(-3).start;

  const [
    currentByCategory,
    trailingByCategory,
    currentByDepartment,
    trailingByDepartment,
    currentByVendor,
    trailingByVendor,
  ] = await Promise.all([
    categoryTotalsInWindow(companyId, thisMonthStart, thisMonthEnd),
    categoryTotalsInWindow(companyId, trailingStart, thisMonthStart),
    departmentTotalsInWindow(companyId, thisMonthStart, thisMonthEnd),
    departmentTotalsInWindow(companyId, trailingStart, thisMonthStart),
    vendorTotalsInWindow(companyId, thisMonthStart, thisMonthEnd),
    vendorTotalsInWindow(companyId, trailingStart, thisMonthStart),
  ]);

  const [categories, departments, vendors] = await Promise.all([
    prisma.expenseCategory.findMany({ where: { id: { in: [...new Set([...currentByCategory.keys(), ...trailingByCategory.keys()])] } } }),
    prisma.department.findMany({ where: { id: { in: [...new Set([...currentByDepartment.keys(), ...trailingByDepartment.keys()])] } } }),
    prisma.vendor.findMany({ where: { id: { in: [...new Set([...currentByVendor.keys(), ...trailingByVendor.keys()])] } } }),
  ]);

  const anomalies: SpendAnomaly[] = [
    ...buildAnomalies("Category", currentByCategory, trailingByCategory, new Map(categories.map((c) => [c.id, c.name]))),
    ...buildAnomalies("Department", currentByDepartment, trailingByDepartment, new Map(departments.map((d) => [d.id, d.name]))),
    ...buildAnomalies("Vendor", currentByVendor, trailingByVendor, new Map(vendors.map((v) => [v.id, v.name]))),
  ];

  return anomalies.sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, limit);
}

function buildAnomalies(
  type: SpendAnomaly["type"],
  current: Map<string, number>,
  trailing: Map<string, number>,
  names: Map<string, string>,
): SpendAnomaly[] {
  const out: SpendAnomaly[] = [];
  for (const [id, currentAmount] of current) {
    if (currentAmount < ANOMALY_MIN_AMOUNT) continue;
    const trailingAvgAmount = (trailing.get(id) ?? 0) / 3;
    if (trailingAvgAmount <= 0) continue;
    const changePct = percentChange(currentAmount, trailingAvgAmount);
    if (changePct === null || Math.abs(changePct) < ANOMALY_THRESHOLD_PCT) continue;
    out.push({ type, name: names.get(id) ?? "Unknown", currentAmount, trailingAvgAmount: Math.round(trailingAvgAmount * 100) / 100, changePct });
  }
  return out;
}
