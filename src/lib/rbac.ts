import "server-only";
import type { Role } from "@/generated/prisma/enums";
import type { SessionPayload } from "@/lib/session";
import { MODULE_ACCESS, ALL_ROLES } from "@/lib/rbac-client";

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Throws ForbiddenError unless session.role is one of `roles`. Returns the session for chaining. */
export function requireRole(session: SessionPayload, roles: Role[]): SessionPayload {
  if (!roles.includes(session.role)) {
    throw new ForbiddenError();
  }
  return session;
}

export { ALL_ROLES, MODULE_ACCESS };

export function canAccessModule(role: Role, moduleKey: string): boolean {
  return MODULE_ACCESS[moduleKey]?.includes(role) ?? false;
}
