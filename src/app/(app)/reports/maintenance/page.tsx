import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getMaintenanceReportRows } from "@/lib/services/reports";
import { formatDate, formatINR } from "@/lib/format";

export default async function MaintenanceReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { session, allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const rows = await getMaintenanceReportRows(session.companyId, { from: sp.from, to: sp.to });

  return (
    <div>
      <PageHeader title="Machinery Report" description={`${rows.length} maintenance records`} action={<ReportExportButtons type="maintenance" query={sp} />} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">From</label><Input type="date" name="from" defaultValue={sp.from} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">To</label><Input type="date" name="to" defaultValue={sp.to} /></div>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticket #</TableHead><TableHead>Date</TableHead><TableHead>Machine</TableHead><TableHead>Type</TableHead>
              <TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Downtime</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.ticketNumber}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.machine}</TableCell>
                <TableCell>{r.type}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.totalCost)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.downtimeMinutes ? `${r.downtimeMinutes} min` : "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
