import "server-only";
import { prisma } from "@/lib/db";
import { NotificationSeverity } from "@/generated/prisma/enums";

interface NotifyParams {
  companyId: string;
  userId?: string;
  /** Role name (e.g. ROLES.ADMIN) to notify every holder of that role — resolved
   * to the company's `roles.id` via the unique (companyId, name) index. */
  roleName?: string;
  type: string;
  severity?: NotificationSeverity;
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
  console.log(`[email-stub] to=${params.userId ?? params.roleName ?? "?"} :: ${params.title} — ${params.message}`);
}

export async function notify(params: NotifyParams) {
  let roleId: string | undefined;
  if (params.roleName) {
    const role = await prisma.role.findUnique({
      where: { companyId_name: { companyId: params.companyId, name: params.roleName } },
    });
    roleId = role?.id;
  }

  await prisma.notification.create({
    data: {
      companyId: params.companyId,
      userId: params.userId,
      roleId,
      type: params.type,
      severity: params.severity ?? NotificationSeverity.INFO,
      title: params.title,
      message: params.message,
      entityType: params.entityType,
      entityId: params.entityId,
    },
  });
  sendEmailStub(params);
}
