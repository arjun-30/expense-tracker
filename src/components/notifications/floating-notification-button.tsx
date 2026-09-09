"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions/notifications";
import { formatDate } from "@/lib/format";
import { SEVERITY_VARIANT, type NotificationRow } from "@/components/notifications/notification-list";

/** Fixed bottom-right across every page (rendered once in the (app) layout,
 * outside the scrollable <main>, so position: fixed anchors to the
 * viewport regardless of scroll position or which page is showing). Shows
 * the most recent notifications inline — the full list, filtering and
 * "mark all read" all still live at /notifications (no longer nav-listed,
 * but still directly reachable) via the "View all" link below. */
export function FloatingNotificationButton({
  unreadCount,
  recent,
}: {
  unreadCount: number;
  recent: NotificationRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="fixed right-6 bottom-6 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" className="relative h-12 w-12 rounded-full shadow-lg">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]" variant="destructive">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
            <span className="sr-only">Notifications{unreadCount > 0 ? ` (${unreadCount} unread)` : ""}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Notifications</p>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || unreadCount === 0}
              onClick={() => startTransition(async () => { await markAllNotificationsReadAction(); router.refresh(); })}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          </div>

          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto">
              {recent.map((n) => (
                <li key={n.id} className={`rounded-md border p-2 text-sm ${n.isRead ? "opacity-60" : "bg-card"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={SEVERITY_VARIANT[n.severity]} className="text-[9px]">{n.severity}</Badge>
                        <p className="truncate font-medium">{n.title}</p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 shrink-0 px-1.5 text-xs"
                        disabled={pending}
                        onClick={() => startTransition(async () => { await markNotificationReadAction(n.id); router.refresh(); })}
                      >
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Button variant="outline" size="sm" className="w-full" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
