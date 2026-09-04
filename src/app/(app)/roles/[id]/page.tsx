import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleFormDialog } from "@/components/roles/role-form-dialog";
import { RolePermissionsForm } from "@/components/roles/role-permissions-form";
import { DeleteRoleButton } from "@/components/roles/delete-role-button";
import { PERMISSIONS } from "@/lib/auth/permission-catalog";
import { hasPermission } from "@/lib/auth/permissions";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { session, allowed } = await guardModule("roles");
  if (!allowed) return <AccessRestricted />;

  const { id } = await params;
  const role = await prisma.role.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
  });
  if (!role) notFound();

  const canManage = hasPermission(session, "roles.manage");
  const grantedCodes = role.rolePermissions.map((rp) => rp.permission.code);

  return (
    <div>
      <PageHeader
        title={role.name}
        description={role.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={role.isSystemRole ? "outline" : "default"}>{role.isSystemRole ? "System role" : "Custom role"}</Badge>
            {canManage && <RoleFormDialog roleId={role.id} isSystemRole={role.isSystemRole} defaultValues={{ name: role.name, description: role.description ?? undefined }} trigger="icon" />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Permissions</CardTitle></CardHeader>
          <CardContent>
            <RolePermissionsForm
              roleId={role.id}
              isSystemRole={role.isSystemRole}
              userCount={role._count.userRoles}
              allPermissions={PERMISSIONS}
              grantedCodes={grantedCodes}
              canManage={canManage}
            />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between border-b py-2 last:border-0">
                <span className="text-muted-foreground">Users holding this role</span>
                <span className="font-medium">{role._count.userRoles}</span>
              </div>
              <div className="flex justify-between border-b py-2 last:border-0">
                <span className="text-muted-foreground">Permissions granted</span>
                <span className="font-medium">{grantedCodes.length}</span>
              </div>
            </CardContent>
          </Card>

          {canManage && !role.isSystemRole && (
            <Card>
              <CardHeader><CardTitle className="text-base">Danger zone</CardTitle></CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-muted-foreground">
                  Deleting a role is permanent. A role with users assigned can&apos;t be deleted.
                </p>
                <DeleteRoleButton roleId={role.id} roleName={role.name} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
