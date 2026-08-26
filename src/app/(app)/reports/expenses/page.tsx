import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getExpenseReportRows } from "@/lib/services/reports";
import { formatDate, formatINR } from "@/lib/format";

export default async function ExpenseReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const [rows, departments] = await Promise.all([
    getExpenseReportRows({ from: sp.from, to: sp.to, departmentId: sp.departmentId }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);
  const total = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader title="Expense Report" description={`${rows.length} records — total ${formatINR(total)}`} action={<ReportExportButtons type="expenses" query={sp} />} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">From</label><Input type="date" name="from" defaultValue={sp.from} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">To</label><Input type="date" name="to" defaultValue={sp.to} /></div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Department</label>
          <Select name="departmentId" defaultValue={sp.departmentId ?? "all"}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Expense #</TableHead><TableHead>Date</TableHead><TableHead>Category</TableHead>
              <TableHead>Department</TableHead><TableHead>Vendor</TableHead><TableHead>Employee</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 200).map((r) => (
              <TableRow key={r.expenseNumber}>
                <TableCell className="font-medium">{r.expenseNumber}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.category}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell>{r.vendor || "—"}</TableCell>
                <TableCell>{r.employee}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.total)}</TableCell>
                <TableCell>{r.status}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No matching expenses.</TableCell></TableRow>}
          </TableBody>
        </Table>
        {rows.length > 200 && <p className="p-3 text-xs text-muted-foreground">Showing first 200 of {rows.length} — use export for the full set.</p>}
      </div>
    </div>
  );
}
