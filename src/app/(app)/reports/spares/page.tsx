import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getSpareReportRows } from "@/lib/services/reports";
import { formatINR } from "@/lib/format";

export default async function SpareReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { session, allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const rows = await getSpareReportRows(session.companyId);

  return (
    <div>
      <PageHeader title="Spare Parts Report" description={`${rows.length} parts`} action={<ReportExportButtons type="spares" query={sp} />} />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part #</TableHead><TableHead>Name</TableHead>
              <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Unit Price</TableHead><TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.partNumber}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="text-right tabular-nums">{r.currentStock}</TableCell>
                <TableCell className="text-right tabular-nums">{r.minimumStock}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.unitPrice)}</TableCell>
                <TableCell><Badge variant={r.status === "Low Stock" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
