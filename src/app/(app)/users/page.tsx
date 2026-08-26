import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserFormDialog } from "@/components/users/user-form-dialog";
import { UserRoleSelect, UserActiveToggle } from "@/components/users/user-row-controls";
import { formatDate } from "@/lib/format";

export default async function UsersPage() {
  const { allowed } = await guardModule("usersRoles");
  if (!allowed) return <AccessRestricted />;

  const [users, departments] = await Promise.all([
    prisma.user.findMany({ include: { department: true }, orderBy: { createdAt: "asc" } }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Users & Roles" description="Manage user accounts and role assignments" action={<UserFormDialog departments={departments} />} />
      <div className="rounded-lg border bg-card">
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
                <TableCell><UserRoleSelect userId={u.id} role={u.role} departmentId={u.departmentId} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(u.createdAt)}</TableCell>
                <TableCell><UserActiveToggle userId={u.id} isActive={u.isActive} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
