import Link from "next/link";
import { Bell, LogOut, User as UserIcon } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/role-labels";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db";
import type { SessionPayload } from "@/lib/session";

export async function AppTopbar({ session }: { session: SessionPayload }) {
  const unreadCount = await prisma.notification.count({
    where: {
      isRead: false,
      OR: [{ userId: session.sub }, { role: session.role }],
    },
  });

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild className="relative">
          <Link href="/notifications">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -right-1 -top-1 h-4 min-w-4 justify-center px-1 text-[10px]" variant="destructive">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Link>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <UserIcon className="h-4 w-4" />
              <span className="hidden text-sm sm:inline">{session.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>
              <div className="font-medium">{session.name}</div>
              <div className="text-xs font-normal text-muted-foreground">{ROLE_LABELS[session.role]}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <form action={logoutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
