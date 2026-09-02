import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ReportExportButtons } from "@/components/reports/export-buttons";
import { getFuelReportRows } from "@/lib/services/reports";
import { formatDate, formatINR } from "@/lib/format";

export default async function FuelReportPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { session, allowed } = await guardModule("reports");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const rows = await getFuelReportRows(session.companyId, { from: sp.from, to: sp.to });

  return (
    <div>
      <PageHeader title="Fuel Report" description={`${rows.length} transactions`} action={<ReportExportButtons type="fuel" query={sp} />} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">From</label><Input type="date" name="from" defaultValue={sp.from} /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">To</label><Input type="date" name="to" defaultValue={sp.to} /></div>
        <Button type="submit" variant="secondary">Filter</Button>
      </form>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Driver</TableHead>
              <TableHead className="text-right">Litres</TableHead><TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Efficiency</TableHead><TableHead>Anomaly</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{formatDate(r.date)}</TableCell><TableCell>{r.vehicle}</TableCell><TableCell>{r.driver || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{r.litres.toFixed(1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(r.amount)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.efficiency ? `${Number(r.efficiency).toFixed(2)} km/L` : "—"}</TableCell>
                <TableCell>{r.anomaly}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No data.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
