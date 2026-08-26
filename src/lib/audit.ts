import "server-only";
import { prisma } from "@/lib/db";

interface AuditParams {
  userId: string | null;
  action: string;
  module: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Single write path into AuditLog — every sensitive mutation should call this
 * so nothing slips through by a route forgetting to log. Audit rows are never
 * updated or deleted by application code (immutable to normal users, §35).
 */
export async function audit(params: AuditParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      oldValue: params.oldValue === undefined ? undefined : JSON.parse(JSON.stringify(params.oldValue)),
      newValue: params.newValue === undefined ? undefined : JSON.parse(JSON.stringify(params.newValue)),
    },
  });
}
