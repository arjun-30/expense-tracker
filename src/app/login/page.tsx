import { redirect } from "next/navigation";
import { Factory } from "lucide-react";
import { getSession } from "@/lib/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,var(--primary)_0%,transparent_45%)] opacity-[0.08]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Factory className="h-5 w-5" />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold tracking-tight">Manufacturing Cost Control</p>
            <p className="text-sm text-muted-foreground">Expense &amp; Cost Management System</p>
          </div>
        </div>
        <Card className="shadow-lg shadow-black/[0.03]">
          <CardHeader className="space-y-1">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
