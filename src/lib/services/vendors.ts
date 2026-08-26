import "server-only";
import { prisma } from "@/lib/db";

export async function getVendorsWithStats() {
  const vendors = await prisma.vendor.findMany({ orderBy: { name: "asc" } });

  const [expenseSums, invoiceCounts, paymentSums] = await Promise.all([
    prisma.expense.groupBy({
      by: ["vendorId"],
      where: { vendorId: { not: null }, status: { in: ["APPROVED", "PAID"] } },
      _sum: { totalAmount: true },
    }),
    prisma.invoice.groupBy({ by: ["vendorId"], _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.payment.groupBy({ by: ["vendorId"], where: { status: "PAID" }, _sum: { amount: true } }),
  ]);

  const expenseMap = new Map(expenseSums.map((e) => [e.vendorId, Number(e._sum?.totalAmount ?? 0)]));
  const invoiceCountMap = new Map(invoiceCounts.map((i) => [i.vendorId, i._count._all]));
  const invoiceSumMap = new Map(invoiceCounts.map((i) => [i.vendorId, Number(i._sum?.totalAmount ?? 0)]));
  const paymentMap = new Map(paymentSums.map((p) => [p.vendorId, Number(p._sum?.amount ?? 0)]));

  return vendors.map((v) => {
    const totalInvoiced = invoiceSumMap.get(v.id) ?? 0;
    const totalPaid = paymentMap.get(v.id) ?? 0;
    const invoiceCount = invoiceCountMap.get(v.id) ?? 0;
    return {
      ...v,
      totalPurchases: expenseMap.get(v.id) ?? 0,
      totalPayments: totalPaid,
      outstanding: Math.max(0, totalInvoiced - totalPaid),
      invoiceCount,
      averageInvoiceValue: invoiceCount > 0 ? totalInvoiced / invoiceCount : 0,
    };
  });
}
