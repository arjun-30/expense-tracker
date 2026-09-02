"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requirePermission } from "@/lib/rbac";
import { ROLES } from "@/lib/rbac-client";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { nextSequenceNumber, withSequenceRetry } from "@/lib/services/sequence";
import type { ActionResult } from "@/lib/actions/expenses";

const PURCHASE_PERMISSIONS = ["purchases.manage"];
const PAYMENT_PERMISSIONS = ["payments.create"];

const poItemSchema = z.object({
  consumableId: z.string().optional().nullable(),
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).default(0),
});

const poSchema = z.object({
  vendorId: z.string().min(1),
  expectedDelivery: z.coerce.date().optional().nullable(),
  items: z.array(poItemSchema).min(1, "Add at least one item"),
});
export type PurchaseOrderInput = z.infer<typeof poSchema>;

export async function createPurchaseOrderAction(input: PurchaseOrderInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, PURCHASE_PERMISSIONS);
  const parsed = poSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  const itemsWithTotals = data.items.map((it) => ({
    ...it,
    total: Math.round(it.quantity * it.unitPrice * (1 + it.gstPercent / 100) * 100) / 100,
  }));
  const totalAmount = itemsWithTotals.reduce((sum, it) => sum + it.total, 0);

  const po = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const poNumber = await nextSequenceNumber(tx.purchaseOrder, "PO");
      return tx.purchaseOrder.create({
        data: {
          companyId: session.companyId,
          poNumber,
          vendorId: data.vendorId,
          expectedDelivery: data.expectedDelivery ?? null,
          totalAmount,
          createdById: session.sub,
          status: "ORDERED",
          items: { create: itemsWithTotals.map(({ consumableId, description, quantity, unitPrice, gstPercent, total }) => ({
            consumableId: consumableId || null,
            description,
            quantity,
            unitPrice,
            gstPercent,
            total,
          })) },
        },
      });
    })
  );

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "PurchaseOrder", entityId: po.id, newValue: po });
  revalidatePath("/purchases");
  return { success: true, id: po.id };
}

export async function receiveGoodsAction(purchaseOrderId: string): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, PURCHASE_PERMISSIONS);

  const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId }, include: { items: true } });
  if (!po) return { success: false, error: "Purchase order not found" };
  if (po.status === "RECEIVED" || po.status === "CANCELLED") {
    return { success: false, error: `Purchase order already ${po.status.toLowerCase()}` };
  }

  await prisma.$transaction(async (tx) => {
    for (const item of po.items) {
      const remaining = Number(item.quantity) - Number(item.receivedQuantity);
      if (remaining <= 0) continue;
      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: { receivedQuantity: item.quantity },
      });
      if (item.consumableId) {
        await tx.consumable.update({
          where: { id: item.consumableId },
          data: { currentStock: { increment: remaining } },
        });
        await tx.consumableStockMovement.create({
          data: {
            consumableId: item.consumableId,
            movementType: "PURCHASE",
            quantity: remaining,
            referenceType: "purchase_order",
            referenceId: po.id,
            unitCost: item.unitPrice,
            totalCost: remaining * Number(item.unitPrice),
            performedById: session.sub,
          },
        });
      }
    }
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: "RECEIVED" },
    });
  });

  await audit({ companyId: session.companyId, userId: session.sub, action: "RECEIVE_GOODS", entityType: "PurchaseOrder", entityId: po.id });
  revalidatePath("/purchases");
  revalidatePath("/spare-parts");
  return { success: true, id: po.id };
}

// Invoicing was dropped entirely (OPEN_DECISIONS.md #5) — payments link
// directly to expenses and vendors, with no invoice step in between.
const paymentSchema = z.object({
  vendorId: z.string().min(1),
  expenseId: z.string().optional().nullable(),
  amount: z.coerce.number().positive(),
  paymentDate: z.coerce.date(),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "NEFT", "RTGS", "CHEQUE", "CREDIT"]),
  referenceNumber: z.string().optional().nullable(),
});
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function createPaymentAction(input: PaymentInput): Promise<ActionResult> {
  const session = await requireSession();
  requirePermission(session, PAYMENT_PERMISSIONS);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const data = parsed.data;

  let expense = null;
  if (data.expenseId) {
    expense = await prisma.expense.findUnique({ where: { id: data.expenseId }, include: { payments: true } });
    if (!expense) return { success: false, error: "Expense not found" };
    const alreadyPaid = expense.payments
      .filter((p) => p.status === "PAID")
      .reduce((sum, p) => sum + Number(p.amount), 0);
    if (alreadyPaid + data.amount > Number(expense.totalAmount) + 0.01) {
      return { success: false, error: "Payment amount exceeds the outstanding expense balance" };
    }
  }

  const payment = await withSequenceRetry(() =>
    prisma.$transaction(async (tx) => {
      const paymentNumber = await nextSequenceNumber(tx.payment, "PAY");
      return tx.payment.create({
        data: {
          companyId: session.companyId,
          paymentNumber,
          vendorId: data.vendorId,
          expenseId: data.expenseId || null,
          amount: data.amount,
          paymentDate: data.paymentDate,
          method: data.method,
          referenceNumber: data.referenceNumber || null,
          status: "PAID",
          createdById: session.sub,
        },
      });
    })
  );

  await audit({ companyId: session.companyId, userId: session.sub, action: "CREATE", entityType: "Payment", entityId: payment.id, newValue: payment });
  await notify({
    companyId: session.companyId,
    roleName: ROLES.ADMIN,
    type: "pending_payment",
    title: "Payment recorded",
    message: `Payment ${payment.paymentNumber} of ₹${data.amount.toLocaleString("en-IN")} recorded.`,
    entityType: "Payment",
    entityId: payment.id,
  });

  revalidatePath("/payments");
  revalidatePath("/purchases");
  return { success: true, id: payment.id };
}
