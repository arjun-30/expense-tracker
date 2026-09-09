import { LogOut } from "lucide-react";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/role-labels";

export default async function ProfilePage() {
  const { session, allowed } = await guardModule("profile");
  if (!allowed) return <AccessRestricted />;

  return (
    <div>
      <PageHeader title="Profile" description="Your account details" />
      <Card>
        <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 text-sm">
            <div className="flex justify-between border-b py-2 last:border-0">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{session.name}</span>
            </div>
            <div className="flex justify-between border-b py-2 last:border-0">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{session.email}</span>
            </div>
            <div className="flex justify-between border-b py-2 last:border-0">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium">
                {session.roles[0] ? ROLE_LABELS[session.roles[0] as keyof typeof ROLE_LABELS] : "—"}
              </span>
            </div>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="outline">
              <LogOut className="h-4 w-4" /> Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
