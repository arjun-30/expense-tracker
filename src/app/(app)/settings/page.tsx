import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { QuickAddDepartment, QuickAddCostCenter, QuickAddCategory, QuickAddSubcategory, AlertRuleToggle } from "@/components/settings/quick-add-forms";

export default async function SettingsPage() {
  const { session, allowed } = await guardModule("settings");
  if (!allowed) return <AccessRestricted />;

  const [departments, costCenters, categories, notificationRules] = await Promise.all([
    prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { companyId: session.companyId }, include: { department: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.companyId }, include: { subcategories: true }, orderBy: { name: "asc" } }),
    prisma.notificationRule.findMany({ where: { companyId: session.companyId }, orderBy: { key: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Settings" description="Categories, departments, cost centers and notification rules" />

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="cost-centers">Cost Centers</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="rules">Notification Rules</TabsTrigger>
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
              <div className="flex flex-col gap-2">
                <QuickAddCategory />
                <QuickAddSubcategory categories={categories} />
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Subcategories</TableHead></TableRow></TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">{c.code}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.subcategories.length ? c.subcategories.map((s) => s.name).join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader><CardTitle className="text-base">Automated Notification Rules</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Rule</TableHead><TableHead>Key</TableHead><TableHead>Severity</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
                <TableBody>
                  {notificationRules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.key}</TableCell>
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
