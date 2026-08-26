import "server-only";
import { prisma } from "@/lib/db";
import { budgetUtilizationRatio, percentChange } from "@/lib/services/calculations";
import { ExpenseStatus } from "@/generated/prisma/enums";

const FINALIZED: ExpenseStatus[] = [ExpenseStatus.APPROVED, ExpenseStatus.PAID];

function toNumber(d: unknown): number {
  return d === null || d === undefined ? 0 : Number(d);
}

function monthBounds(offsetMonths = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return { start, end };
}

export async function getKpis() {
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
    spareAgg,
    budgets,
  ] = await Promise.all([
    prisma.expense.aggregate({ where: { status: { in: FINALIZED } }, _sum: { totalAmount: true } }),
    prisma.expense.aggregate({
      where: { status: { in: FINALIZED }, date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.aggregate({
      where: { status: { in: FINALIZED }, date: { gte: lastMonthStart, lt: lastMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.expense.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.expense.aggregate({
      where: { status: "APPROVED", paymentStatus: { in: ["PENDING", "PARTIALLY_PAID"] } },
      _sum: { totalAmount: true },
    }),
    prisma.fuelTransaction.aggregate({
      where: { date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalAmount: true },
    }),
    prisma.maintenanceRecord.aggregate({
      where: { date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.transportTrip.aggregate({
      where: { date: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.inventoryTransaction.aggregate({
      where: { type: "PURCHASE", createdAt: { gte: thisMonthStart, lt: thisMonthEnd } },
      _sum: { totalCost: true },
    }),
    prisma.budget.findMany({
      where: { periodStart: { lte: thisMonthEnd }, periodEnd: { gte: thisMonthStart } },
    }),
  ]);

  let budgetTotal = 0;
  let budgetActual = 0;
  for (const b of budgets) {
    budgetTotal += toNumber(b.amount);
    const actual = await prisma.expense.aggregate({
      where: {
        status: { in: FINALIZED },
        date: { gte: b.periodStart, lte: b.periodEnd },
        ...(b.departmentId ? { departmentId: b.departmentId } : {}),
        ...(b.categoryId ? { categoryId: b.categoryId } : {}),
        ...(b.costCenterId ? { costCenterId: b.costCenterId } : {}),
      },
      _sum: { totalAmount: true },
    });
    budgetActual += toNumber(actual._sum?.totalAmount);
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
    sparePartsExpensesThisMonth: toNumber(spareAgg._sum?.totalCost),
    budgetUtilizationPct: budgetUtilizationRatio(budgetTotal, budgetActual),
    budgetTotal,
    budgetActual,
  };
}

export async function getExpenseTrend(months = 12) {
  const rows = await prisma.$queryRaw<{ month: Date; total: number }[]>`
    SELECT date_trunc('month', "date") AS month, SUM("totalAmount")::float AS total
    FROM "Expense"
    WHERE "status" IN ('APPROVED', 'PAID')
      AND "date" >= (date_trunc('month', now()) - (${months - 1} || ' months')::interval)
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({
    month: new Date(r.month).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
    total: Number(r.total),
  }));
}

export async function getExpenseByCategory() {
  const grouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: { status: { in: FINALIZED } },
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

export async function getDepartmentSpending() {
  const grouped = await prisma.expense.groupBy({
    by: ["departmentId"],
    where: { status: { in: FINALIZED } },
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

export async function getTopVendors(limit = 5) {
  const grouped = await prisma.expense.groupBy({
    by: ["vendorId"],
    where: { status: { in: FINALIZED }, vendorId: { not: null } },
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

export async function getMachineMaintenanceCost(limit = 5) {
  const grouped = await prisma.maintenanceRecord.groupBy({
    by: ["machineId"],
    _sum: { totalCost: true },
  });
  const machines = await prisma.machine.findMany({ where: { id: { in: grouped.map((g) => g.machineId) } } });
  const names = new Map(machines.map((m) => [m.id, m.name]));
  return grouped
    .map((g) => ({ name: names.get(g.machineId) ?? "Unknown", value: toNumber(g._sum?.totalCost) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getVehicleFuelCost(limit = 5) {
  const grouped = await prisma.fuelTransaction.groupBy({
    by: ["vehicleId"],
    _sum: { totalAmount: true },
  });
  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: grouped.map((g) => g.vehicleId) } } });
  const names = new Map(vehicles.map((v) => [v.id, v.registrationNumber]));
  return grouped
    .map((g) => ({ name: names.get(g.vehicleId) ?? "Unknown", value: toNumber(g._sum?.totalAmount) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getBudgetVsActual() {
  const { start, end } = monthBounds(0);
  const budgets = await prisma.budget.findMany({
    where: { periodStart: { lte: end }, periodEnd: { gte: start } },
    include: { department: true, category: true, costCenter: true },
  });
  const rows = [];
  for (const b of budgets) {
    const actual = await prisma.expense.aggregate({
      where: {
        status: { in: FINALIZED },
        date: { gte: b.periodStart, lte: b.periodEnd },
        ...(b.departmentId ? { departmentId: b.departmentId } : {}),
        ...(b.categoryId ? { categoryId: b.categoryId } : {}),
        ...(b.costCenterId ? { costCenterId: b.costCenterId } : {}),
      },
      _sum: { totalAmount: true },
    });
    rows.push({
      name: b.name,
      budget: toNumber(b.amount),
      actual: toNumber(actual._sum?.totalAmount),
    });
  }
  return rows;
}
