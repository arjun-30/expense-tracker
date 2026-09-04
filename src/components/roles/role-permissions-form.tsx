"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { updateRolePermissionsAction } from "@/lib/actions/roles";
import type { PermissionDef } from "@/lib/auth/permission-catalog";

export function humanizeGroup(prefix: string): string {
  return prefix
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Groups permissions by the module prefix of their code (e.g. "expenses.verify"
 * -> group "expenses"), preserving the catalog's own ordering — so a new
 * permission added to PERMISSIONS is grouped automatically, no separate
 * mapping to maintain. */
export function groupPermissions(permissions: PermissionDef[]): { key: string; label: string; items: PermissionDef[] }[] {
  const groups = new Map<string, PermissionDef[]>();
  for (const p of permissions) {
    const key = p.code.split(".")[0];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, label: humanizeGroup(key), items }));
}

export function RolePermissionsForm({
  roleId,
  isSystemRole,
  userCount,
  allPermissions,
  grantedCodes,
  canManage,
}: {
  roleId: string;
  isSystemRole: boolean;
  userCount: number;
  allPermissions: PermissionDef[];
  grantedCodes: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(grantedCodes));
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const groups = useMemo(() => groupPermissions(allPermissions), [allPermissions]);
  const changed = useMemo(() => {
    const original = new Set(grantedCodes);
    if (original.size !== selected.size) return true;
    for (const c of original) if (!selected.has(c)) return true;
    return false;
  }, [selected, grantedCodes]);

  function toggle(code: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(code);
      else next.delete(code);
      return next;
    });
  }

  async function save() {
    setSubmitting(true);
    const result = await updateRolePermissionsAction(roleId, Array.from(selected));
    setSubmitting(false);
    if (!result.success) {
      toast.error(result.error ?? "Something went wrong");
      return;
    }
    toast.success("Permissions updated");
    router.refresh();
  }

  function handleSaveClick() {
    if (isSystemRole && userCount > 0) {
      setConfirmOpen(true);
      return;
    }
    save();
  }

  return (
    <div className="space-y-4">
      {isSystemRole && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          This is a system role. Changing its permissions changes what every one of its {userCount} current holder{userCount === 1 ? "" : "s"} can do, company-wide.
        </div>
      )}

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="mb-2 text-sm font-semibold">{group.label}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((p) => (
                <label key={p.code} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                  <Checkbox
                    checked={selected.has(p.code)}
                    disabled={!canManage}
                    onCheckedChange={(checked) => toggle(p.code, checked === true)}
                  />
                  <span>
                    <span className="block font-medium">{p.description}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{p.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <div className="flex items-center gap-2 border-t pt-4">
          <Button onClick={handleSaveClick} disabled={!changed || submitting}>
            {submitting ? "Saving…" : "Save permissions"}
          </Button>
          {changed && <span className="text-xs text-muted-foreground">Unsaved changes</span>}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change permissions for a system role?</AlertDialogTitle>
            <AlertDialogDescription>
              {userCount} user{userCount === 1 ? "" : "s"} currently hold this role. Permissions are cached in each
              user&apos;s session at login, so this change will apply the next time each of them logs in — not
              immediately for anyone already signed in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                save();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
