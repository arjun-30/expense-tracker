import "server-only";
import { prisma } from "@/lib/db";
import { AlertSeverity, Role } from "@/generated/prisma/enums";

interface NotifyParams {
  userId?: string;
  role?: Role;
  type: string;
  severity?: AlertSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
}

/**
 * NotificationChannel interface point: in-app rows are always written; the
 * "email" channel below is a console/log stub so the architecture supports
 * swapping in real SMTP/WhatsApp/SMS providers later (§33) without touching
 * call sites.
 */
function sendEmailStub(params: NotifyParams) {
  console.log(`[email-stub] to=${params.userId ?? params.role ?? "?"} :: ${params.title} — ${params.message}`);
}

export async function notify(params: NotifyParams) {
  await prisma.notification.create({
    data: {
      userId: params.userId,
      role: params.role,
      type: params.type,
      severity: params.severity ?? AlertSeverity.INFO,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
  sendEmailStub(params);
}
