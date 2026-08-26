import { NextResponse, type NextRequest } from "next/server";
import { getSession, type SessionPayload } from "@/lib/session";
import { canAccessModule, isAdminRole } from "@/lib/rbac";
import { toCsv, toExcel, toPdf, type ExportColumn } from "@/lib/services/export";
import {
  getExpenseReportRows,
  getFuelReportRows,
  getTransportationReportRows,
  getMaintenanceReportRows,
  getSpareReportRows,
  getBudgetReportRows,
} from "@/lib/services/reports";

const REPORT_COLUMNS: Record<string, ExportColumn[]> = {
  expenses: [
    { key: "expenseNumber", header: "Expense #" }, { key: "date", header: "Date" }, { key: "category", header: "Category" },
    { key: "department", header: "Department" }, { key: "costCenter", header: "Cost Center" }, { key: "vendor", header: "Vendor" },
    { key: "employee", header: "Employee" }, { key: "amount", header: "Amount" }, { key: "tax", header: "Tax" },
    { key: "total", header: "Total" }, { key: "status", header: "Status" },
  ],
  fuel: [
    { key: "date", header: "Date" }, { key: "vehicle", header: "Vehicle" }, { key: "driver", header: "Driver" },
    { key: "litres", header: "Litres" }, { key: "amount", header: "Amount" }, { key: "distance", header: "Distance (km)" },
    { key: "efficiency", header: "Efficiency (km/L)" }, { key: "costPerKm", header: "Cost/km" }, { key: "anomaly", header: "Anomaly" },
  ],
  transportation: [
    { key: "tripNumber", header: "Trip #" }, { key: "date", header: "Date" }, { key: "vehicle", header: "Vehicle" },
    { key: "transporter", header: "Transporter" }, { key: "source", header: "Source" }, { key: "destination", header: "Destination" },
    { key: "quantity", header: "Quantity" }, { key: "unit", header: "Unit" }, { key: "totalCost", header: "Total Cost" }, { key: "costPerKg", header: "Cost/kg" },
  ],
  maintenance: [
    { key: "ticketNumber", header: "Ticket #" }, { key: "date", header: "Date" }, { key: "machine", header: "Machine" },
    { key: "type", header: "Type" }, { key: "labourCost", header: "Labour" }, { key: "sparePartsCost", header: "Spares" },
    { key: "otherCost", header: "Other" }, { key: "totalCost", header: "Total" }, { key: "downtimeMinutes", header: "Downtime (min)" },
  ],
  spares: [
    { key: "partNumber", header: "Part #" }, { key: "name", header: "Name" }, { key: "supplier", header: "Supplier" },
    { key: "currentStock", header: "Stock" }, { key: "minimumStock", header: "Min Stock" }, { key: "unitPrice", header: "Unit Price" }, { key: "status", header: "Status" },
  ],
  budgets: [
    { key: "name", header: "Budget" }, { key: "scope", header: "Scope" }, { key: "period", header: "Period" },
    { key: "periodStart", header: "Start" }, { key: "periodEnd", header: "End" }, { key: "budget", header: "Budget" },
    { key: "actual", header: "Actual" }, { key: "variance", header: "Variance" }, { key: "utilizationPct", header: "Utilization %" },
  ],
};

async function fetchRows(
  type: string,
  filters: { from?: string; to?: string; departmentId?: string; categoryId?: string; vendorId?: string },
  session: SessionPayload
) {
  switch (type) {
    case "expenses": return getExpenseReportRows(filters, session);
    case "fuel": return getFuelReportRows(filters);
    case "transportation": return getTransportationReportRows(filters);
    case "maintenance": return getMaintenanceReportRows(filters);
    case "spares": return getSpareReportRows();
    case "budgets": return getBudgetReportRows();
    default: return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !canAccessModule(session.role, "reports")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "";
  const format = searchParams.get("format") ?? "csv";
  const columns = REPORT_COLUMNS[type];
  if (!columns) return NextResponse.json({ error: "Unknown report type" }, { status: 400 });

  const rows = await fetchRows(
    type,
    {
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      departmentId: isAdminRole(session.role) ? searchParams.get("departmentId") ?? undefined : undefined,
      categoryId: searchParams.get("categoryId") ?? undefined,
      vendorId: searchParams.get("vendorId") ?? undefined,
    },
    session
  );
  if (!rows) return NextResponse.json({ error: "Unknown report type" }, { status: 400 });

  const filename = `${type}-report-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    return new NextResponse(toCsv(rows, columns), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${filename}.csv"` },
    });
  }
  if (format === "xlsx") {
    const buf = await toExcel(rows, columns, type);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }
  if (format === "pdf") {
    const buf = await toPdf(`${type[0].toUpperCase()}${type.slice(1)} Report`, rows, columns);
    return new NextResponse(new Uint8Array(buf), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}.pdf"` },
    });
  }
  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}
