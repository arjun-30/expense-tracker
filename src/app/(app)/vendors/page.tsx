import { Building2, ShoppingBag, IndianRupee, Clock } from "lucide-react";
import { guardModule } from "@/lib/guards";
import { AccessRestricted } from "@/components/access-restricted";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { VendorFormDialog } from "@/components/vendors/vendor-form-dialog";
import { getVendorsWithStats } from "@/lib/services/vendors";
import { formatINR } from "@/lib/format";
import { hasRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/rbac-client";

export default async function VendorsPage() {
  const { session, allowed } = await guardModule("vendors");
  if (!allowed) return <AccessRestricted />;

  const vendors = await getVendorsWithStats(session.companyId);
  const canEdit = hasRole(session, ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.PURCHASE_MANAGER);

  const activeVendorsCount = vendors.filter((v) => v.isActive).length;
  const totalPurchasesSum = vendors.reduce((s, v) => s + v.totalPurchases, 0);
  const totalPaidSum = vendors.reduce((s, v) => s + v.totalPayments, 0);
  const totalOutstandingSum = vendors.reduce((s, v) => s + v.outstanding, 0);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Supplier directory and spend analytics"
        action={canEdit ? <VendorFormDialog /> : undefined}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Active Vendors"
          value={activeVendorsCount}
          icon={Building2}
          formatAsCurrency={false}
          subtext={`${vendors.length} total suppliers`}
        />
        <KpiCard label="Total Purchases" value={totalPurchasesSum} icon={ShoppingBag} subtext="Contracted spend" />
        <KpiCard label="Total Settled" value={totalPaidSum} icon={IndianRupee} subtext="Paid to vendors" />
        <KpiCard
          label="Outstanding Payable"
          value={totalOutstandingSum}
          icon={Clock}
          subtext={totalOutstandingSum > 0 ? "Pending payment" : "All settled"}
        />
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Total Purchases</TableHead>
              <TableHead className="text-right">Total Payments</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Purchase Orders</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell>{v.category ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{v.contactPerson ?? v.phone ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(v.totalPurchases)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(v.totalPayments)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatINR(v.outstanding)}</TableCell>
                <TableCell className="text-right tabular-nums">{v.purchaseOrderCount}</TableCell>
                <TableCell>
                  <Badge variant={v.isActive ? "success" : "outline"}>{v.isActive ? "ACTIVE" : "INACTIVE"}</Badge>
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <VendorFormDialog
                      vendorId={v.id}
                      trigger="icon"
                      defaultValues={{
                        name: v.name,
                        contactPerson: v.contactPerson ?? undefined,
                        phone: v.phone ?? undefined,
                        email: v.email ?? undefined,
                        address: v.address ?? undefined,
                        gstNumber: v.gstNumber ?? undefined,
                        pan: v.pan ?? undefined,
                        category: v.category ?? undefined,
                        paymentTerms: v.paymentTerms ?? undefined,
                        status: v.isActive ? "ACTIVE" : "INACTIVE",
                      }}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {vendors.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No vendors yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
