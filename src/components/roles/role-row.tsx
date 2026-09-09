"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

/** A whole clickable role row — navigates to the role's detail page when
 * clicked anywhere in the row (matching ExpenseRow's pattern), while the
 * role-name link stops propagation so it doesn't also trigger the row's
 * own navigation. TableRow's own base styling already includes
 * hover:bg-muted/50 (see ui/table.tsx), so no separate hover class is
 * needed here. */
export function RoleRow({
  id,
  name,
  description,
  isSystemRole,
  userCount,
  permissionCount,
}: {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  userCount: number;
  permissionCount: number;
}) {
  const router = useRouter();

  return (
    <TableRow onClick={() => router.push(`/roles/${id}`)} className="cursor-pointer">
      <TableCell className="font-medium">
        <Link href={`/roles/${id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
          {name}
        </Link>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{description ?? "—"}</TableCell>
      <TableCell>
        <Badge variant={isSystemRole ? "outline" : "default"}>{isSystemRole ? "System" : "Custom"}</Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums">{userCount}</TableCell>
      <TableCell className="text-right tabular-nums">{permissionCount}</TableCell>
    </TableRow>
  );
}
