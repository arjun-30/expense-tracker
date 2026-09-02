import { prisma } from "@/lib/db";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { NotificationList } from "@/components/notifications/notification-list";

export default async function NotificationsPage() {
  const { session, allowed } = await guardModule("notifications");
  if (!allowed) return <AccessRestricted />;

  const notifications = await prisma.notification.findMany({
    where: { companyId: session.companyId, OR: [{ userId: session.sub }, { roleId: { in: session.roleIds } }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Notifications" description="Alerts from the rules engine and workflow events" />
      <NotificationList
        notifications={notifications.map((n) => ({
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
