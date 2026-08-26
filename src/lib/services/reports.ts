import "server-only";
import { prisma } from "@/lib/db";

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

export async function getExpenseReportRows(f: ReportFilters) {
  const dr = dateRange(f);
  const expenses = await prisma.expense.findMany({
    where: {
      ...(Object.keys(dr).length ? { date: dr } : {}),
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.categoryId ? { categoryId: f.categoryId } : {}),
      ...(f.vendorId ? { vendorId: f.vendorId } : {}),
    },
    include: { category: true, department: true, vendor: true, employee: true, costCenter: true },
    orderBy: { date: "desc" },
  });
  return expenses.map((e) => ({
    expenseNumber: e.expenseNumber,
    date: e.date,
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

export async function getFuelReportRows(f: ReportFilters) {
  const dr = dateRange(f);
  const txns = await prisma.fuelTransaction.findMany({
    where: Object.keys(dr).length ? { date: dr } : {},
    include: { vehicle: true, driver: true },
    orderBy: { date: "desc" },
  });
  return txns.map((t) => ({
    date: t.date,
    vehicle: t.vehicle.registrationNumber,
    driver: t.driver?.name ?? "",
    litres: Number(t.litres),
    amount: Number(t.totalAmount),
    distance: Number(t.distanceTravelled),
    efficiency: t.efficiencyKmpl ? Number(t.efficiencyKmpl) : "",
    costPerKm: t.costPerKm ? Number(t.costPerKm) : "",
    anomaly: t.isAnomaly ? "Yes" : "No",
  }));
}

export async function getTransportationReportRows(f: ReportFilters) {
  const dr = dateRange(f);
  const trips = await prisma.transportTrip.findMany({
    where: Object.keys(dr).length ? { date: dr } : {},
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
    costPerKg: t.costPerKg ? Number(t.costPerKg) : "",
  }));
}

export async function getMaintenanceReportRows(f: ReportFilters) {
  const dr = dateRange(f);
  const records = await prisma.maintenanceRecord.findMany({
    where: Object.keys(dr).length ? { date: dr } : {},
    include: { machine: true },
    orderBy: { date: "desc" },
  });
  return records.map((r) => ({
    ticketNumber: r.ticketNumber,
    date: r.date,
    machine: r.machine.name,
    type: r.maintenanceType,
    labourCost: Number(r.labourCost),
    sparePartsCost: Number(r.sparePartsCost),
    otherCost: Number(r.otherCost),
    totalCost: Number(r.totalCost),
    downtimeMinutes: r.downtimeMinutes ?? "",
  }));
}

export async function getSpareReportRows() {
  const spares = await prisma.sparePart.findMany({ include: { supplier: true }, orderBy: { name: "asc" } });
  return spares.map((s) => ({
    partNumber: s.partNumber,
    name: s.name,
    supplier: s.supplier?.name ?? "",
    currentStock: Number(s.currentStock),
    minimumStock: Number(s.minimumStock),
    unitPrice: Number(s.purchasePrice),
    status: Number(s.currentStock) < Number(s.minimumStock) ? "Low Stock" : "OK",
  }));
}

export async function getBudgetReportRows() {
  const { getBudgetsWithActuals } = await import("@/lib/services/budgets");
  const rows = await getBudgetsWithActuals();
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
