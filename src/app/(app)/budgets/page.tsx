import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BudgetFormDialog } from "@/components/budgets/budget-form-dialog";
import { getBudgetsWithActuals } from "@/lib/services/budgets";
import { formatDate, formatINR } from "@/lib/format";
import { Role } from "@/generated/prisma/enums";

export default async function BudgetsPage() {
  const { session, allowed } = await guardModule("budgets");
  if (!allowed) return <AccessRestricted />;

  const [budgets, departments, categories] = await Promise.all([
    getBudgetsWithActuals(),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { parentId: null }, orderBy: { name: "asc" } }),
  ]);

  const canManage: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.ACCOUNTS];

  return (
    <div>
      <PageHeader
        title="Budgets"
        description="Budget allocations and variance tracking"
        action={canManage.includes(session.role) ? <BudgetFormDialog departments={departments} categories={categories} /> : undefined}
      />
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Budget</TableHead>
              <TableHead>Scope</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="w-40">Utilization</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.map((b) => {
              const pct = b.utilization ? Math.round(b.utilization * 100) : 0;
              const severity = pct >= 100 ? "destructive" : pct >= 80 ? "secondary" : "outline";
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.name}</TableCell>
                  <TableCell>{b.scope}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(b.periodStart)} – {formatDate(b.periodEnd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(b.amount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatINR(b.actual)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${b.variance < 0 ? "text-status-critical" : "text-status-good"}`}>
                    {b.variance < 0 ? "-" : "+"}{formatINR(Math.abs(b.variance))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(100, pct)} className="h-2" />
                      <Badge variant={severity} className="shrink-0 text-[10px]">{pct}%</Badge>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {budgets.length === 0 && (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No budgets configured yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
