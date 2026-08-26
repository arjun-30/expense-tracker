"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSessionToken, setSessionCookie, clearSessionCookie, getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  // Same generic error whether the account doesn't exist or the password is
  // wrong — don't let the login form reveal which emails are registered.
  const genericError = "Invalid email or password";

  if (!user || !user.isActive) {
    return { error: genericError };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Account locked. Try again in ${minutesLeft} minute(s).` };
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
      : null;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: attempts, lockedUntil },
    });
    return {
      error: lockedUntil
        ? `Too many failed attempts. Account locked for ${LOCKOUT_MINUTES} minutes.`
        : genericError,
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });

  const token = await createSessionToken({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
  });
  await setSessionCookie(token);

  await audit({ userId: user.id, action: "LOGIN", module: "auth", recordId: user.id });

  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  await clearSessionCookie();
  if (session) {
    await audit({ userId: session.sub, action: "LOGOUT", module: "auth", recordId: session.sub });
  }
  redirect("/login");
}
