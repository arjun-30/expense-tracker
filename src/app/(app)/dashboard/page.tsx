import { guardModule } from "@/lib/guards";
import { canViewCompanyDashboard, expenseVisibilityWhere } from "@/lib/rbac";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { CompanyDashboard } from "@/components/dashboard/company-dashboard";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";

export default async function DashboardPage() {
  const { session } = await guardModule("dashboard");

  if (canViewCompanyDashboard(session)) {
    return <CompanyDashboard session={session} />;
  }

  return (
    <PersonalDashboard
      where={{ companyId: session.companyId, ...expenseVisibilityWhere(session) }}
      scopeLabel={hasRole(session, ROLES.EMPLOYEE) ? "your expenses" : "your department's expenses"}
    />
  );
}
