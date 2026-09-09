import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RoleRow } from "@/components/roles/role-row";
import { hasPermission } from "@/lib/auth/permissions";

export default async function RolesPage() {
  const { session, allowed } = await guardModule("roles");
  if (!allowed) return <AccessRestricted />;

  const canManage = hasPermission(session, "roles.manage");

  const roles = await prisma.role.findMany({
    where: { companyId: session.companyId },
    include: { _count: { select: { userRoles: true, rolePermissions: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Roles"
        description="Roles and the permissions each one grants"
        action={canManage ? <RoleFormDialog /> : undefined}
      />
      <div className="rounded-lg border bg-card">
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
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No roles yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
