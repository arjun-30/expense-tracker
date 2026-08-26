"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateUserRoleAction, toggleUserActiveAction } from "@/lib/actions/users";
import { ROLE_LABELS } from "@/lib/role-labels";
import type { Role } from "@/generated/prisma/enums";

export function UserRoleSelect({ userId, role, departmentId }: { userId: string; role: Role; departmentId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Select
      value={role}
      disabled={pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await updateUserRoleAction(userId, value as Role, departmentId);
          if (!result.success) { toast.error(result.error ?? "Failed to update role"); return; }
          toast.success("Role updated");
          router.refresh();
        })
      }
    >
      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
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
