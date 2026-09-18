import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UserRoleSelect, UserActiveToggle } from "@/components/users/user-row-controls";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RoleRow } from "@/components/roles/role-row";
import {
  QuickAddDepartment,
  QuickAddCostCenter,
  QuickAddCategory,
  QuickAddSubcategory,
  AlertRuleToggle,
} from "@/components/settings/quick-add-forms";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { session, allowed } = await guardModule("settings");
  if (!allowed) return <AccessRestricted />;

  const canManageSettings = hasPermission(session, "settings.manage");
  const canManageUsers = hasPermission(session, "users.manage");
  const canManageRoles = hasPermission(session, "roles.manage");

  if (!canManageSettings && !canManageUsers && !canManageRoles) return <AccessRestricted />;

  const sp = searchParams ? await searchParams : {};
  const validTabs = ["users", "roles", "departments", "cost-centers", "categories", "rules"];
  const defaultTab = sp.tab && validTabs.includes(sp.tab) ? sp.tab : "users";

  const [departments, costCenters, categories, notificationRules, users, roles] = await Promise.all([
    prisma.department.findMany({ where: { companyId: session.companyId }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ where: { companyId: session.companyId }, include: { department: true }, orderBy: { name: "asc" } }),
    prisma.expenseCategory.findMany({ where: { companyId: session.companyId }, include: { subcategories: true }, orderBy: { name: "asc" } }),
    prisma.notificationRule.findMany({ where: { companyId: session.companyId }, orderBy: { key: "asc" } }),
    prisma.user.findMany({
      where: { companyId: session.companyId },
      include: { department: true, userRoles: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({
      where: { companyId: session.companyId },
      include: { _count: { select: { userRoles: true, rolePermissions: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Manage user accounts, roles, departments, cost centers, expense categories and notification rules"
      />

      <SettingsTabs defaultTab={defaultTab}>
        <TabsContent value="users">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Users</CardTitle>
                <p className="text-sm text-muted-foreground">Manage user accounts and role assignments</p>
              </div>
              {canManageUsers && <UserFormDialog roles={roles} departments={departments} />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>{u.department?.name ?? "—"}</TableCell>
                      <TableCell>
                        <UserRoleSelect userId={u.id} roleId={u.userRoles[0]?.roleId} roles={roles} departmentId={u.departmentId} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                      <TableCell>
                        <UserActiveToggle userId={u.id} isActive={u.isActive} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No users yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 space-y-0 pb-4">
              <div>
                <CardTitle className="text-base">Roles & Permissions</CardTitle>
                <p className="text-sm text-muted-foreground">Configure roles and permissions for access control</p>
              </div>
              {canManageRoles && <RoleFormDialog />}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Permissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((r) => (
                    <RoleRow
                      key={r.id}
                      id={r.id}
                      name={r.name}
                      description={r.description}
                      isSystemRole={r.isSystemRole}
                      userCount={r._count.userRoles}
                      permissionCount={r._count.rolePermissions}
                    />
                  ))}
                  {roles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                        No roles yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

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
      </SettingsTabs>
    </div>
  );
}
