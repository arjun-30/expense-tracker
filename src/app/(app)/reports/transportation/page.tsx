import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getTransportationReportRows } from "@/lib/services/reports";
import { formatDate, formatINR } from "@/lib/format";

export default async function TransportationReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const rows = await getTransportationReportRows({ from: sp.from, to: sp.to });

  return (
    <div>
      <PageHeader title="Transportation Report" description={`${rows.length} trips`} action={<ReportExportButtons type="transportation" query={sp} />} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">From</label><Input type="date" name="from" defaultValue={sp.from} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">To</label><Input type="date" name="to" defaultValue={sp.to} /></div>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trip #</TableHead><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Route</TableHead>
              <TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Cost/kg</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.tripNumber}</TableCell>
                <TableCell>{formatDate(r.date)}</TableCell>
                <TableCell>{r.vehicle}</TableCell>
                <TableCell>{r.source} → {r.destination}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.totalCost)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.costPerKg ? formatINR(Number(r.costPerKg), true) : "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
