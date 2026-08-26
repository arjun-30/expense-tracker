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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "")).toUpperCase();
}

export async function AppTopbar({ session }: { session: SessionPayload }) {
  const unreadCount = await prisma.notification.count({
    where: {
      isRead: false,
      OR: [{ userId: session.sub }, { role: session.role }],
    },
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card/60 px-4 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="relative text-muted-foreground hover:text-foreground">
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
            <Button variant="ghost" className="gap-2 pr-2 pl-1.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials(session.name) || <UserIcon className="h-3.5 w-3.5" />}
              </span>
              <span className="hidden flex-col items-start leading-tight sm:flex">
                <span className="text-sm font-medium">{session.name}</span>
                <span className="text-[11px] text-muted-foreground">{ROLE_LABELS[session.role]}</span>
              </span>
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
