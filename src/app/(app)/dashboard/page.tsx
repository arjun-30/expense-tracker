import { guardModule } from "@/lib/guards";
import { canViewCompanyDashboard, expenseVisibilityWhere } from "@/lib/rbac";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";
import { VALID_EXPENSE_STATUSES } from "@/lib/status-labels";
import { parseFilterParam } from "@/lib/utils";
import { CompanyDashboard } from "@/components/dashboard/company-dashboard";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import type { ExpenseStatus } from "@/generated/prisma/enums";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { session } = await guardModule("dashboard");

  if (canViewCompanyDashboard(session)) {
    return <CompanyDashboard session={session} />;
  }

  const sp = await searchParams;
  const rawStatus = parseFilterParam(sp.status);
  const statusFilter = rawStatus && VALID_EXPENSE_STATUSES.has(rawStatus) ? (rawStatus as ExpenseStatus) : undefined;

  return (
    <PersonalDashboard
      where={{ companyId: session.companyId, ...expenseVisibilityWhere(session) }}
      scopeLabel={hasRole(session, ROLES.EMPLOYEE) ? "your expenses" : "your department's expenses"}
      statusFilter={statusFilter}
    />
  );
}
