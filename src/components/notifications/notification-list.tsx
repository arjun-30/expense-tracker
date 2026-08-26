"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/lib/actions/notifications";
import { formatDate } from "@/lib/format";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  isRead: boolean;
  createdAt: string;
}

const SEVERITY_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  INFO: "default",
  WARNING: "secondary",
  CRITICAL: "destructive",
};

export function NotificationList({ notifications }: { notifications: NotificationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => startTransition(async () => { await markAllNotificationsReadAction(); router.refresh(); })}>
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      </div>
      {notifications.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
          <Bell className="h-8 w-8" />
          <p>No notifications.</p>
        </div>
      )}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id} className={`rounded-lg border p-3 ${n.isRead ? "opacity-60" : "bg-card"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[n.severity]} className="text-[10px]">{n.severity}</Badge>
                  <p className="font-medium">{n.title}</p>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatDate(n.createdAt)}</p>
              </div>
              {!n.isRead && (
                <Button
                  variant="ghost"
                  size="sm"
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
    </div>
  );
}
