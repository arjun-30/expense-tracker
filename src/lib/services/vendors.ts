import "server-only";
import { prisma } from "@/lib/db";

// Invoicing was removed (OPEN_DECISIONS.md #5) — "outstanding" is now derived
// from purchase orders (what was ordered) vs. payments (what was paid),
// rather than from invoice totals.
export async function getVendorsWithStats(companyId: string) {
  const vendors = await prisma.vendor.findMany({ where: { companyId }, orderBy: { name: "asc" } });

  const [expenseSums, poSums, paymentSums] = await Promise.all([
    prisma.expense.groupBy({
      by: ["vendorId"],
      where: { companyId, vendorId: { not: null }, status: { in: ["APPROVED", "PAID"] } },
      _sum: { totalAmount: true },
    }),
    prisma.purchaseOrder.groupBy({ by: ["vendorId"], where: { companyId }, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.payment.groupBy({ by: ["vendorId"], where: { companyId, status: "PAID" }, _sum: { amount: true } }),
  ]);

  const expenseMap = new Map(expenseSums.map((e) => [e.vendorId, Number(e._sum?.totalAmount ?? 0)]));
  const poCountMap = new Map(poSums.map((p) => [p.vendorId, p._count._all]));
  const poSumMap = new Map(poSums.map((p) => [p.vendorId, Number(p._sum?.totalAmount ?? 0)]));
  const paymentMap = new Map(paymentSums.map((p) => [p.vendorId, Number(p._sum?.amount ?? 0)]));

  return vendors.map((v) => {
    const totalOrdered = poSumMap.get(v.id) ?? 0;
    const totalPaid = paymentMap.get(v.id) ?? 0;
    const purchaseOrderCount = poCountMap.get(v.id) ?? 0;
    return {
      ...v,
      totalPurchases: expenseMap.get(v.id) ?? 0,
      totalPayments: totalPaid,
      outstanding: Math.max(0, totalOrdered - totalPaid),
      purchaseOrderCount,
      averagePurchaseOrderValue: purchaseOrderCount > 0 ? totalOrdered / purchaseOrderCount : 0,
    };
  });
}
