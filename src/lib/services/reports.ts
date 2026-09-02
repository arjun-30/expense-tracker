import "server-only";
import { prisma } from "@/lib/db";
import { expenseVisibilityWhere } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";

export interface ReportFilters {
  from?: string;
  to?: string;
  departmentId?: string;
  categoryId?: string;
  vendorId?: string;
}

function dateRange(f: ReportFilters) {
  return {
    ...(f.from ? { gte: new Date(f.from) } : {}),
    ...(f.to ? { lte: new Date(f.to) } : {}),
  };
}

export async function getExpenseReportRows(f: ReportFilters, session: SessionPayload) {
  const dr = dateRange(f);
  const expenses = await prisma.expense.findMany({
    where: {
      companyId: session.companyId,
      ...(Object.keys(dr).length ? { expenseDate: dr } : {}),
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.vendorId ? { vendorId: f.vendorId } : {}),
      // Spread last so a non-admin's own scoping always wins over any departmentId filter passed in.
      ...expenseVisibilityWhere(session),
    },
    include: { category: true, department: true, vendor: true, employee: true, costCenter: true },
    orderBy: { expenseDate: "desc" },
  });
  return expenses.map((e) => ({
    expenseNumber: e.expenseNumber,
    date: e.expenseDate,
    category: e.category.name,
    department: e.department.name,
    costCenter: e.costCenter?.name ?? "",
    vendor: e.vendor?.name ?? "",
    employee: e.employee.name,
    amount: Number(e.amount),
    tax: Number(e.taxAmount),
    total: Number(e.totalAmount),
    status: e.status,
  }));
}

export async function getFuelReportRows(companyId: string, f: ReportFilters) {
  const dr = dateRange(f);
  const txns = await prisma.fuelTransaction.findMany({
    where: { vehicle: { companyId }, ...(Object.keys(dr).length ? { date: dr } : {}) },
    include: { vehicle: true, driver: true },
    orderBy: { date: "desc" },
  });
  return txns.map((t) => ({
    date: t.date,
    vehicle: t.vehicle.registrationNumber,
    driver: t.driver?.name ?? "",
    litres: Number(t.litres),
    amount: Number(t.totalAmount),
    distance: t.distanceTravelled ? Number(t.distanceTravelled) : "",
    efficiency: t.efficiencyKmpl ? Number(t.efficiencyKmpl) : "",
    anomaly: t.isAnomaly ? "Yes" : "No",
  }));
}

export async function getTransportationReportRows(companyId: string, f: ReportFilters) {
  const dr = dateRange(f);
  const trips = await prisma.transportTrip.findMany({
    where: { companyId, ...(Object.keys(dr).length ? { date: dr } : {}) },
    include: { vehicle: true, transporter: true },
    orderBy: { date: "desc" },
  });
  return trips.map((t) => ({
    tripNumber: t.tripNumber,
    date: t.date,
    vehicle: t.vehicle.registrationNumber,
    transporter: t.transporter?.name ?? "",
    source: t.source,
    destination: t.destination,
    quantity: t.quantity ? Number(t.quantity) : "",
    unit: t.unit ?? "",
    totalCost: Number(t.totalCost),
  }));
}

export async function getMaintenanceReportRows(companyId: string, f: ReportFilters) {
  const dr = dateRange(f);
  const records = await prisma.maintenanceRecord.findMany({
    where: { machine: { companyId }, ...(Object.keys(dr).length ? { createdAt: dr } : {}) },
    include: { machine: true },
    orderBy: { createdAt: "desc" },
  });
  return records.map((r) => ({
    ticketNumber: r.ticketNumber,
    date: r.startTime ?? r.createdAt,
    machine: r.machine.name,
    type: r.maintenanceType,
    labourCost: Number(r.labourCost),
    consumablesCost: Number(r.consumablesCost),
    otherCost: Number(r.otherCost),
    totalCost: Number(r.totalCost),
    downtimeMinutes: r.downtimeMinutes ?? "",
  }));
}

export async function getSpareReportRows(companyId: string) {
  const consumables = await prisma.consumable.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return consumables.map((s) => ({
    partNumber: s.partNumber,
    name: s.name,
    currentStock: Number(s.currentStock),
    minimumStock: Number(s.minimumStock),
    unitPrice: Number(s.unitCost),
    status: Number(s.currentStock) < Number(s.minimumStock) ? "Low Stock" : "OK",
  }));
}

export async function getBudgetReportRows(companyId: string) {
  const { getBudgetsWithActuals } = await import("@/lib/services/budgets");
  const rows = await getBudgetsWithActuals(companyId);
  return rows.map((b) => ({
    name: b.name,
    scope: b.scope,
    period: b.period,
    periodStart: b.periodStart,
    periodEnd: b.periodEnd,
    budget: b.amount,
    actual: b.actual,
    variance: b.variance,
    utilizationPct: b.utilization ? Math.round(b.utilization * 100) : 0,
  }));
}
