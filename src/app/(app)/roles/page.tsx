import Link from "next/link";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
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
              <TableRow key={r.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/roles/${r.id}`} className="hover:underline">{r.name}</Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={r.isSystemRole ? "outline" : "default"}>{r.isSystemRole ? "System" : "Custom"}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r._count.userRoles}</TableCell>
                <TableCell className="text-right tabular-nums">{r._count.rolePermissions}</TableCell>
              </TableRow>
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
