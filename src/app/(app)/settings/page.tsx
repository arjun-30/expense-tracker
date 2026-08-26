import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QuickAddDepartment, QuickAddCostCenter, QuickAddCategory, AlertRuleToggle } from "@/components/settings/quick-add-forms";

export default async function SettingsPage() {
  const { allowed } = await guardModule("settings");
  if (!allowed) return <AccessRestricted />;

  const [departments, costCenters, categories, alertRules] = await Promise.all([
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ include: { department: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.alertRule.findMany({ orderBy: { module: "asc" } }),
  ]);
  const parentCategories = categories.filter((c) => !c.parentId);

  return (
    <div>
      <PageHeader title="Settings" description="Categories, departments, cost centers and alert rules" />

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="cost-centers">Cost Centers</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Alert Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="departments">
          <Card>
            <CardHeader><CardTitle className="text-base">Departments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <QuickAddDepartment />
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead></TableRow></TableHeader>
                <TableBody>
                  {departments.map((d) => <TableRow key={d.id}><TableCell>{d.name}</TableCell><TableCell className="text-muted-foreground">{d.code}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost-centers">
          <Card>
            <CardHeader><CardTitle className="text-base">Cost Centers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <QuickAddCostCenter departments={departments} />
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead></TableRow></TableHeader>
                <TableBody>
                  {costCenters.map((c) => <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell className="text-muted-foreground">{c.code}</TableCell><TableCell>{c.department?.name ?? "—"}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card>
            <CardHeader><CardTitle className="text-base">Expense Categories</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <QuickAddCategory parents={parentCategories} />
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Parent</TableHead></TableRow></TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.code}</TableCell>
                      <TableCell>{categories.find((p) => p.id === c.parentId)?.name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle className="text-base">Automated Alert Rules</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Module</TableHead><TableHead>Severity</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
                <TableBody>
                  {alertRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <p className="font-medium">{r.name}</p>
                        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                      </TableCell>
                      <TableCell>{r.module}</TableCell>
                      <TableCell><Badge variant={r.severity === "CRITICAL" ? "destructive" : r.severity === "WARNING" ? "secondary" : "outline"}>{r.severity}</Badge></TableCell>
                      <TableCell><AlertRuleToggle id={r.id} isActive={r.isActive} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
