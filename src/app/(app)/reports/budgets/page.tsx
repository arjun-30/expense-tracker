import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getBudgetReportRows } from "@/lib/services/reports";
import { formatDate, formatINR } from "@/lib/format";

export default async function BudgetReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const rows = await getBudgetReportRows();

  return (
    <div>
      <PageHeader title="Budget Report" description={`${rows.length} budgets`} action={<ReportExportButtons type="budgets" query={sp} />} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Budget</TableHead><TableHead>Scope</TableHead><TableHead>Period</TableHead>
              <TableHead className="text-right">Budget</TableHead><TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead><TableHead className="text-right">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.scope}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(r.periodStart)} – {formatDate(r.periodEnd)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.budget)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.actual)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.variance)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.utilizationPct}%</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
