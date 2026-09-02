import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "mecs_session";
const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me"
);
const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 hours

export interface SessionPayload {
  sub: string; // user id
  name: string;
  email: string;
  companyId: string;
  departmentId: string | null;
  /** Role names this user holds (a user can hold more than one role — see user_roles). */
  roles: string[];
  /** Ids of the roles above, e.g. for scoping notifications by role_id. */
  roleIds: string[];
  /** Permission codes granted via the roles above, resolved once at login. */
  permissions: string[];
  [key: string]: unknown;
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(SECRET);
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * A JWT's signature proves it was issued by us and hasn't expired — it says
 * nothing about whether its *payload* still matches the current
 * SessionPayload shape. A cookie signed before the roles/permissions
 * session redesign (or any other future payload change) verifies here just
 * fine but carries the old, narrower fields — `session.roles` etc. would be
 * `undefined`, and every downstream consumer that assumes an array (session
 * guards, the sidebar, the topbar) throws instead of rendering. Validate the
 * decoded payload against the shape we actually rely on before trusting it.
 */
function isValidSessionPayload(payload: unknown): payload is SessionPayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  return (
    typeof p.sub === "string" &&
    typeof p.name === "string" &&
    typeof p.email === "string" &&
    typeof p.companyId === "string" &&
    Array.isArray(p.roles) &&
    Array.isArray(p.roleIds) &&
    Array.isArray(p.permissions)
  );
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    // An outdated or otherwise malformed payload is not a valid session —
    // treat it the same as logged-out (redirects to /login) rather than
    // letting `undefined` fields reach code that assumes they're arrays.
    if (!isValidSessionPayload(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }
  return session;
}
