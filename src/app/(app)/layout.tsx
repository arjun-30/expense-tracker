import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { AppSidebar, MobileNavHeader } from "@/components/app-sidebar";
import { FloatingNotificationButton } from "@/components/notifications/floating-notification-button";

const RECENT_NOTIFICATIONS_LIMIT = 5;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const notificationWhere = {
    companyId: session.companyId,
    OR: [{ userId: session.sub }, { roleId: { in: session.roleIds } }],
  };
  const [unreadCount, recent] = await Promise.all([
    prisma.notification.count({ where: { ...notificationWhere, isRead: false } }),
    prisma.notification.findMany({ where: notificationWhere, orderBy: { createdAt: "desc" }, take: RECENT_NOTIFICATIONS_LIMIT }),
  ]);

  const userInfo = { name: session.name, email: session.email };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden md:flex-row">
      <MobileNavHeader roles={session.roles} user={userInfo} />
      <AppSidebar roles={session.roles} user={userInfo} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-muted/30 p-3.5 sm:p-5 md:px-6 md:pb-6">{children}</main>
      </div>
      <FloatingNotificationButton
        unreadCount={unreadCount}
        recent={recent.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          severity: n.severity,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
