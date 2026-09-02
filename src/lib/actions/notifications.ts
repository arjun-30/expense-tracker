"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "@/lib/actions/expenses";

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification) return { success: false, error: "Notification not found" };
  if (notification.userId && notification.userId !== session.sub) {
    return { success: false, error: "Not your notification" };
  }
  await prisma.notification.update({ where: { id }, data: { isRead: true } });
  revalidatePath("/notifications");
  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const session = await requireSession();
  await prisma.notification.updateMany({
    where: { isRead: false, OR: [{ userId: session.sub }, { roleId: { in: session.roleIds } }] },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
  return { success: true };
}
