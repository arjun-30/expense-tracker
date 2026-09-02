"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateUserRoleAction, toggleUserActiveAction } from "@/lib/actions/users";
import { ROLE_LABELS } from "@/lib/role-labels";
import type { RoleName } from "@/lib/rbac-client";

export function UserRoleSelect({
  userId,
  roleId,
  roles,
  departmentId,
}: {
  userId: string;
  roleId: string | undefined;
  roles: { id: string; name: string }[];
  departmentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={roleId}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateUserRoleAction(userId, value, departmentId);
          if (!result.success) { toast.error(result.error ?? "Failed to update role"); return; }
          toast.success("Role updated");
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-48"><SelectValue placeholder="No role" /></SelectTrigger>
      <SelectContent>
        {roles.map((r) => <SelectItem key={r.id} value={r.id}>{ROLE_LABELS[r.name as RoleName] ?? r.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function UserActiveToggle({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Switch
      checked={isActive}
      disabled={pending}
      onCheckedChange={(checked) =>
        startTransition(async () => {
          const result = await toggleUserActiveAction(userId, checked);
          if (!result.success) { toast.error(result.error ?? "Failed to update"); return; }
          router.refresh();
        })
      }
    />
  );
}
