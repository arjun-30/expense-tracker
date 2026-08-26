import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DataTablePagination } from "@/components/data-table-pagination";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 30;

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { allowed } = await guardModule("auditLogs");
  if (!allowed) return <AccessRestricted />;

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const moduleFilter = sp.module;

  const where = moduleFilter ? { module: moduleFilter } : {};
  const [logs, total, distinctModules] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ distinct: ["module"], select: { module: true } }),
  ]);

  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable log of sensitive actions across the system" />

      <div className="mb-4 flex flex-wrap gap-2">
        {distinctModules.map((m) => (
          <a key={m.module} href={`/audit-logs?module=${m.module}`}>
            <Badge variant={moduleFilter === m.module ? "default" : "outline"} className="cursor-pointer">{m.module}</Badge>
          </a>
        ))}
        {moduleFilter && <a href="/audit-logs"><Badge variant="outline" className="cursor-pointer">Clear filter</Badge></a>}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Record</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm text-muted-foreground">{formatDate(log.createdAt)}</TableCell>
                <TableCell>{log.user?.name ?? "System"}</TableCell>
                <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                <TableCell>{log.module}</TableCell>
                <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">{log.recordId ?? "—"}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No audit entries yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
        <DataTablePagination basePath="/audit-logs" searchParams={sp} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </div>
  );
}
