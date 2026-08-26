import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { canAccessModule } from "@/lib/rbac";
import type { SessionPayload } from "@/lib/session";

/** For use at the top of a page/layout Server Component. Redirects to /login if
 * unauthenticated (defense in depth alongside proxy.ts); returns the session plus
 * an `allowed` flag the page should check before rendering module content. */
export async function guardModule(moduleKey: string): Promise<{ session: SessionPayload; allowed: boolean }> {
  const session = await getSession();
  if (!session) redirect("/login");
  return { session, allowed: canAccessModule(session.role, moduleKey) };
}
